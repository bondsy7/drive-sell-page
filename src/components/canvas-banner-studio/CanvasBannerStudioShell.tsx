import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ProShell from "./CanvasBannerStudioProShell";
import QuickShell from "./CanvasBannerStudioQuickShell";
import QuickEditView from "./wizard/QuickEditView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_TEXT_FIELDS } from "./data/defaultComposition";
import type { DealerProfile } from "./ci/profileSources";
import type { StudioState } from "./state/types";

type Mode = "quick" | "pro";

const CanvasBannerStudioShell: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project");
  const initialMode: Mode = params.get("mode") === "pro" ? "pro" : "quick";
  const [mode, setMode] = useState<Mode>(initialMode);
  const { user } = useAuth();

  const [resumeState, setResumeState] = useState<StudioState | null>(null);
  const [loading, setLoading] = useState(false);
  const [dealerProfile, setDealerProfile] = useState<DealerProfile | null>(null);

  // Load saved canvas project for resume
  useEffect(() => {
    if (!projectId || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: row, error }, { data: profile }, { data: banks }] = await Promise.all([
        supabase
          .from("banner_projects")
          .select("id, title, vehicle_id, state")
          .eq("id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("company_name, contact_name, email, phone, whatsapp_number, website, address, postal_code, city, logo_url, primary_color, secondary_color, default_legal_text, leasing_bank, leasing_legal_text, financing_bank, financing_legal_text, facebook_url, instagram_url, x_url, tiktok_url, youtube_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("dealer_banks")
          .select("bank_type, bank_name, legal_text, sort_order")
          .eq("user_id", user.id)
          .order("sort_order"),
      ]);
      if (cancelled) return;
      if (error || !row) {
        toast.error("Canvas-Projekt konnte nicht geladen werden.");
        setParams({}, { replace: true });
        setLoading(false);
        return;
      }
      const st = (row.state ?? {}) as StudioState;
      // Ensure ids/title are taken from row (canonical) in case state is stale
      setResumeState({
        ...st,
        bannerProjectId: row.id,
        vehicleId: row.vehicle_id,
        projectTitle: row.title ?? st.projectTitle ?? "Banner-Entwurf",
      });
      if (profile) setDealerProfile({ ...(profile as DealerProfile), dealer_banks: banks ?? [] });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, user?.id]);

  if (projectId) {
    if (loading || !resumeState) {
      return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Canvas-Projekt wird geladen…
        </div>
      );
    }
    const formatIds = resumeState.selectedFormatIds?.length ? resumeState.selectedFormatIds : [];
    if (formatIds.length === 0) {
      toast.error("Projekt enthält keine Formate – bitte neu starten.");
      setParams({}, { replace: true });
      return null;
    }
    return (
      <QuickEditView
        initialFormatIds={formatIds}
        initialActiveFormatId={resumeState.activeFormatId ?? formatIds[0]}
        initialTextFields={resumeState.textFields ?? DEFAULT_TEXT_FIELDS}
        initialCompositions={resumeState.compositions ?? {}}
        ci={resumeState.ci}
        dealerProfile={dealerProfile}
        initialVehicleId={resumeState.vehicleId}
        initialProjectTitle={resumeState.projectTitle}
        initialBannerProjectId={resumeState.bannerProjectId}
        onBack={() => setParams({}, { replace: true })}
      />
    );
  }

  if (mode === "quick") {
    return <QuickShell onSwitchToPro={() => setMode("pro")} />;
  }
  return <ProShell onSwitchToQuick={() => setMode("quick")} />;
};

export default CanvasBannerStudioShell;
