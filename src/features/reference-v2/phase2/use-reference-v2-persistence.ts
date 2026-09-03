import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";
import type { ReferenceIntakePersistInput } from "../phase1-5/AutomaticReferenceIntake";
import {
  createDefaultReferenceV2Orchestrator,
  type ReferenceV2PersistenceOrchestrator,
} from "./persistence-orchestrator";

/**
 * Reference V2 — Phase 2.6D: React-Bindung der durablen Persistenz.
 *
 * Der Hook haelt ausschliesslich den Business-Anker (vehicleId) und die
 * zugehoerige Workspace-ID. Er trifft keine Governance-Entscheidungen und
 * kennt keine Fahrzeugdaten — Marke/Modell/VIN werden nur zur Auswahl im
 * Admin-UI angezeigt und niemals persistiert oder in Prompts verwendet.
 */

export interface ReferenceV2VehicleOption {
  readonly id: string;
  readonly display: string;
}

export function useReferenceV2Persistence(options?: {
  readonly orchestrator?: ReferenceV2PersistenceOrchestrator;
  readonly onHydrated?: (master: VehicleMasterRecord) => void;
}) {
  const orchestrator = useMemo(
    () => options?.orchestrator ?? createDefaultReferenceV2Orchestrator(),
    [options?.orchestrator],
  );
  const onHydratedRef = useRef(options?.onHydrated);
  onHydratedRef.current = options?.onHydrated;

  const [vehicles, setVehicles] = useState<readonly ReferenceV2VehicleOption[]>(
    [],
  );
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from("vehicles")
      .select("id, title, brand, model, vin")
      .order("created_at", { ascending: false })
      .limit(200);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setVehicles(
      (data ?? []).map((v) => ({
        id: v.id,
        display:
          v.title?.trim() ||
          [v.brand, v.model].filter(Boolean).join(" ").trim() ||
          v.vin,
      })),
    );
  }, []);

  /** Waehlt den Anker und laedt einen bereits persistierten Master. */
  const selectVehicle = useCallback(
    async (nextVehicleId: string) => {
      setBusy(true);
      setError(null);
      setVehicleId(nextVehicleId);
      setWorkspaceId(null);
      try {
        const hydrated = await orchestrator.loadMaster(nextVehicleId);
        if (hydrated) {
          setWorkspaceId(hydrated.workspace.workspaceId);
          onHydratedRef.current?.(hydrated.master);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
      } finally {
        setBusy(false);
      }
    },
    [orchestrator],
  );

  /** Legt den durablen Workspace fuer einen lokal erzeugten Master an. */
  const bindMaster = useCallback(
    async (master: VehicleMasterRecord) => {
      if (!vehicleId) return null;
      setBusy(true);
      setError(null);
      try {
        const workspace = await orchestrator.ensureWorkspace(vehicleId, master);
        setWorkspaceId(workspace.workspaceId);
        return workspace;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [orchestrator, vehicleId],
  );

  const persistAsset = useCallback(
    async ({ asset, file, framing }: ReferenceIntakePersistInput) => {
      if (!vehicleId || !workspaceId) {
        throw new Error(
          "Kein Fahrzeug-Anker gebunden — Referenz bleibt nur lokal.",
        );
      }
      await orchestrator.persistAsset({
        vehicleId,
        workspaceId,
        asset,
        file,
        framing,
      });
    },
    [orchestrator, vehicleId, workspaceId],
  );

  return {
    vehicles,
    vehicleId,
    workspaceId,
    busy,
    error,
    loadVehicles,
    selectVehicle,
    bindMaster,
    persistAsset,
    persistenceReady: Boolean(vehicleId && workspaceId),
  };
}
