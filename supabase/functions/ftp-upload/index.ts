import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  try {
    const body = await req.json();
    const { project_id, action } = body;

    // Load FTP config
    const { data: ftpConfig, error: ftpErr } = await supabase
      .from("ftp_configs")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (ftpErr || !ftpConfig) {
      return new Response(
        JSON.stringify({ error: "Keine FTP-Konfiguration gefunden. Bitte zuerst unter Schnittstellen konfigurieren." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: test connection
    if (action === "test") {
      const testResult = await testFtpConnection(ftpConfig);
      return new Response(JSON.stringify(testResult), {
        status: testResult.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: upload project HTML
    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to read project (RLS scoped to user already verified)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error: projErr } = await adminClient
      .from("projects")
      .select("id, title, html_content")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return new Response(
        JSON.stringify({ error: "Projekt nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!project.html_content) {
      return new Response(
        JSON.stringify({ error: "Kein HTML-Inhalt vorhanden. Bitte zuerst eine Landingpage generieren." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize filename
    const filename = (project.title || "fahrzeug")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + ".html";

    const uploadResult = await uploadViaFtp(
      ftpConfig,
      filename,
      project.html_content
    );

    return new Response(JSON.stringify(uploadResult), {
      status: uploadResult.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface FtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  directory: string;
  is_sftp: boolean;
}

async function testFtpConnection(config: FtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    // Use raw TCP to test FTP connection
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const buf = new Uint8Array(1024);
    const n = await conn.read(buf);
    const banner = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";

    // Send USER command
    await conn.write(new TextEncoder().encode(`USER ${config.username}\r\n`));
    const userBuf = new Uint8Array(1024);
    const un = await conn.read(userBuf);
    const userResp = un ? new TextDecoder().decode(userBuf.subarray(0, un)) : "";

    // Send PASS command
    await conn.write(new TextEncoder().encode(`PASS ${config.password}\r\n`));
    const passBuf = new Uint8Array(1024);
    const pn = await conn.read(passBuf);
    const passResp = pn ? new TextDecoder().decode(passBuf.subarray(0, pn)) : "";

    // Send QUIT
    await conn.write(new TextEncoder().encode("QUIT\r\n"));
    conn.close();

    if (passResp.startsWith("230")) {
      return { success: true, message: "Verbindung erfolgreich! Login OK." };
    } else {
      return { success: false, message: `Login fehlgeschlagen: ${passResp.trim()}` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Verbindung fehlgeschlagen: ${err.message}`,
    };
  }
}

async function uploadViaFtp(
  config: FtpConfig,
  filename: string,
  content: string
): Promise<{ success: boolean; message: string; path?: string }> {
  try {
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    const send = async (cmd: string): Promise<string> => {
      await conn.write(new TextEncoder().encode(cmd + "\r\n"));
      return await read();
    };

    // Read banner
    await read();

    // Login
    await send(`USER ${config.username}`);
    const passResp = await send(`PASS ${config.password}`);
    if (!passResp.startsWith("230")) {
      conn.close();
      return { success: false, message: `Login fehlgeschlagen: ${passResp.trim()}` };
    }

    // Change directory
    if (config.directory && config.directory !== "/") {
      const cwdResp = await send(`CWD ${config.directory}`);
      if (!cwdResp.startsWith("250")) {
        conn.close();
        return { success: false, message: `Verzeichnis nicht gefunden: ${config.directory}` };
      }
    }

    // Enter passive mode
    const pasvResp = await send("PASV");
    const pasvMatch = pasvResp.match(/(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
    if (!pasvMatch) {
      conn.close();
      return { success: false, message: "Passiver Modus fehlgeschlagen" };
    }

    const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
    const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);

    const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });

    // Send STOR command
    const storResp = await send(`STOR ${filename}`);
    if (!storResp.startsWith("150") && !storResp.startsWith("125")) {
      dataConn.close();
      conn.close();
      return { success: false, message: `Upload fehlgeschlagen: ${storResp.trim()}` };
    }

    // Write file content
    await dataConn.write(new TextEncoder().encode(content));
    dataConn.close();

    // Read transfer complete
    const doneResp = await read();
    await send("QUIT");
    conn.close();

    const remotePath = config.directory.replace(/\/$/, "") + "/" + filename;

    if (doneResp.startsWith("226")) {
      return { success: true, message: `Erfolgreich hochgeladen: ${remotePath}`, path: remotePath };
    } else {
      return { success: true, message: `Upload abgeschlossen: ${remotePath}`, path: remotePath };
    }
  } catch (err: any) {
    return { success: false, message: `FTP-Fehler: ${err.message}` };
  }
}
