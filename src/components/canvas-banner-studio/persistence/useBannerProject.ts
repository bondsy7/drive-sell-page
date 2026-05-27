import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { StudioState, BannerComposition } from "../state/types";

const AUTOSAVE_DELAY_MS = 3000;

interface Args {
  state: StudioState;
  onProjectIdAssigned: (id: string) => void;
}

/** Upload a data: URL to the `banners` bucket and return the public URL. */
async function uploadDataUrl(
  userId: string,
  vehicleId: string | null | undefined,
  dataUrl: string,
): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = (blob.type.split("/")[1] || "png").split(";")[0];
    const folder = vehicleId ? `${userId}/${vehicleId}` : `${userId}/no-vehicle`;
    const path = `_banner-state/${folder}/state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("banners")
      .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
    if (error) {
      console.warn("[banner-state] upload failed", error);
      return null;
    }
    return supabase.storage.from("banners").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn("[banner-state] upload exception", e);
    return null;
  }
}

/**
 * Replace any embedded data: URLs inside the studio state with uploaded
 * storage URLs. Without this the JSON payload can balloon to several MB and
 * the PostgREST request hangs or fails, leaving the UI stuck in "saving".
 */
async function offloadDataUrls(state: StudioState, userId: string): Promise<StudioState> {
  const cache = new Map<string, string | null>();
  const vehicleId = state.vehicleId ?? null;

  async function externalize(url: string | undefined): Promise<string | undefined> {
    if (!url || !url.startsWith("data:")) return url;
    if (cache.has(url)) return cache.get(url) ?? undefined;
    const uploaded = await uploadDataUrl(userId, vehicleId, url);
    cache.set(url, uploaded);
    return uploaded ?? undefined; // drop on failure so the row can still save
  }

  const nextCompositions: Record<string, BannerComposition> = {};
  for (const [id, comp] of Object.entries(state.compositions)) {
    const bg = await externalize(comp.backgroundImageUrl);
    const master = await externalize(comp.masterImageUrl);
    const reframeHistory = comp.reframeHistory
      ? (await Promise.all(comp.reframeHistory.map((u) => externalize(u)))).filter(
          (x): x is string => !!x,
        )
      : undefined;
    const layers = await Promise.all(
      comp.layers.map(async (l) =>
        l.imageUrl && l.imageUrl.startsWith("data:")
          ? { ...l, imageUrl: await externalize(l.imageUrl) }
          : l,
      ),
    );
    nextCompositions[id] = {
      ...comp,
      backgroundImageUrl: bg,
      masterImageUrl: master,
      reframeHistory,
      layers,
    };
  }

  return { ...state, compositions: nextCompositions };
}

/**
 * Persists the Banner Studio state to the `banner_projects` table with
 * a 3 s debounce. Creates a row on first save, updates afterwards.
 */
export function useBannerProject({ state, onProjectIdAssigned }: Args) {
  const { user } = useAuth();
  const timer = useRef<number | null>(null);
  const lastSerialized = useRef<string>("");
  const inFlight = useRef<boolean>(false);
  const projectIdRef = useRef<string | undefined>(state.bannerProjectId);
  projectIdRef.current = state.bannerProjectId;
  const stateRef = useRef<StudioState>(state);
  stateRef.current = state;

  const save = useCallback(async () => {
    if (!user) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const cleanState = await offloadDataUrls(stateRef.current, user.id);
      const master =
        cleanState.compositions[cleanState.activeFormatId]?.backgroundImageUrl ?? null;
      const payload = {
        user_id: user.id,
        vehicle_id: cleanState.vehicleId ?? null,
        title: cleanState.projectTitle || "Banner-Entwurf",
        master_image_url: master && !master.startsWith("data:") ? master : null,
        state: cleanState as any,
      };
      if (projectIdRef.current) {
        const { error } = await supabase
          .from("banner_projects")
          .update(payload)
          .eq("id", projectIdRef.current);
        if (error) {
          console.warn("banner_projects update failed", error);
          throw new Error(error.message);
        }
      } else {
        const { data, error } = await supabase
          .from("banner_projects")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          console.warn("banner_projects insert failed", error);
          throw new Error(error.message);
        }
        if (data?.id) {
          projectIdRef.current = data.id;
          onProjectIdAssigned(data.id);
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [user, onProjectIdAssigned]);

  // Debounced autosave on every state change.
  useEffect(() => {
    if (!user) return;
    const serialized = JSON.stringify({
      v: state.vehicleId,
      t: state.textFields,
      cKeys: Object.keys(state.compositions),
      sf: state.selectedFormatIds,
      af: state.activeFormatId,
      title: state.projectTitle,
    });
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void save().catch((e) => console.warn("autosave failed", e));
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, user, save]);

  return { saveNow: save };
}

/**
 * Uploads an exported banner blob to the public `banners` bucket so it shows
 * up in the dashboard / vehicle detail page.
 */
export async function uploadBannerToStorage(opts: {
  userId: string;
  vehicleId?: string | null;
  blob: Blob;
  filename: string;
  contentType: string;
}): Promise<string | null> {
  const folder = opts.vehicleId ? `${opts.userId}/${opts.vehicleId}` : `${opts.userId}/no-vehicle`;
  const path = `${folder}/${Date.now()}-${opts.filename}`;
  const { error } = await supabase.storage
    .from("banners")
    .upload(path, opts.blob, { contentType: opts.contentType, upsert: false });
  if (error) {
    console.warn("banner upload failed", error);
    return null;
  }
  const { data } = supabase.storage.from("banners").getPublicUrl(path);
  return data.publicUrl;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const r = await fetch(dataUrl);
  return r.blob();
}
