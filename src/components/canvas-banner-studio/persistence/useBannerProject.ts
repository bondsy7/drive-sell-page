import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { StudioState } from "../state/types";

const AUTOSAVE_DELAY_MS = 3000;

interface Args {
  state: StudioState;
  onProjectIdAssigned: (id: string) => void;
}

/**
 * Persists the Banner Studio state to the `banner_projects` table with
 * a 3 s debounce. Creates a row on first save, updates afterwards.
 */
export function useBannerProject({ state, onProjectIdAssigned }: Args) {
  const { user } = useAuth();
  const timer = useRef<number | null>(null);
  const lastSerialized = useRef<string>("");
  const projectIdRef = useRef<string | undefined>(state.bannerProjectId);
  projectIdRef.current = state.bannerProjectId;

  const save = useCallback(async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      vehicle_id: state.vehicleId ?? null,
      title: state.projectTitle || "Banner-Entwurf",
      master_image_url: state.compositions[state.activeFormatId]?.backgroundImageUrl ?? null,
      state: state as unknown as Record<string, unknown>,
    };
    if (projectIdRef.current) {
      const { error } = await supabase
        .from("banner_projects")
        .update(payload)
        .eq("id", projectIdRef.current);
      if (error) console.warn("banner_projects update failed", error);
    } else {
      const { data, error } = await supabase
        .from("banner_projects")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        console.warn("banner_projects insert failed", error);
        return;
      }
      if (data?.id) {
        projectIdRef.current = data.id;
        onProjectIdAssigned(data.id);
      }
    }
  }, [state, user, onProjectIdAssigned]);

  // Debounced autosave on every state change.
  useEffect(() => {
    if (!user) return;
    const serialized = JSON.stringify({
      v: state.vehicleId,
      t: state.textFields,
      c: state.compositions,
      sf: state.selectedFormatIds,
      af: state.activeFormatId,
      title: state.projectTitle,
    });
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void save(); }, AUTOSAVE_DELAY_MS);
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
