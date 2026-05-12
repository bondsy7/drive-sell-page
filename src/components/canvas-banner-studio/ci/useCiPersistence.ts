import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CiState } from "../state/types";

/**
 * CI-Persistenz pro Händler.
 * - Lädt einmalig `profiles.ci_settings` und ruft `onLoaded(ci)` auf, sofern vorhanden.
 * - Speichert nachfolgende Änderungen debounced zurück.
 *
 * Speicherung erfolgt nur, wenn der User eingeloggt ist und sich der CI-State seit
 * dem letzten Schreibvorgang tatsächlich geändert hat.
 */
export function useCiPersistence(args: {
  userId: string | undefined;
  ci: CiState | undefined;
  onLoaded: (ci: Partial<CiState>) => void;
}) {
  const { userId, ci, onLoaded } = args;
  const loadedForUserRef = useRef<string | null>(null);
  const lastSavedJsonRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    if (!userId || loadedForUserRef.current === userId) return;
    loadedForUserRef.current = userId;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ci_settings")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const stored = (data?.ci_settings ?? null) as Partial<CiState> | null;
      if (stored && typeof stored === "object") {
        lastSavedJsonRef.current = JSON.stringify(stored);
        onLoaded(stored);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, onLoaded]);

  // Debounced autosave
  useEffect(() => {
    if (!userId || !ci) return;
    if (loadedForUserRef.current !== userId) return; // wait until initial load finished
    const json = JSON.stringify(ci);
    if (json === lastSavedJsonRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ ci_settings: ci as any })
        .eq("id", userId);
      if (!error) lastSavedJsonRef.current = json;
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, ci]);
}
