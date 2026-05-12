import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  BannerComposition,
  BannerLayer,
  BannerTextFieldKey,
  CiState,
  ImageFitMode,
  OverlayDirection,
  StudioState,
} from "./types";
import { BANNER_FORMATS, getFormatById } from "../data/formats";
import { buildDefaultComposition, DEFAULT_TEXT_FIELDS } from "../data/defaultComposition";
import { getLayoutTemplate } from "../data/layoutTemplates";
import { getBrandPreset } from "../ci/brandPresets";

type Action =
  | { type: "set-active-format"; formatId: string }
  | { type: "toggle-format"; formatId: string }
  | { type: "set-text"; field: BannerTextFieldKey; value: string }
  | { type: "set-background"; formatId: string; url?: string }
  | { type: "set-bg-fit"; formatId: string; fit: ImageFitMode }
  | { type: "set-overlay"; formatId: string; direction: OverlayDirection; strength: number }
  | { type: "set-template"; formatId: string; templateId: string }
  | { type: "set-logo"; formatId: string; url?: string }
  | { type: "patch-layer"; formatId: string; layerId: string; patch: Partial<BannerLayer> }
  | { type: "add-layer"; formatId: string; layer: BannerLayer }
  | { type: "remove-layer"; formatId: string; layerId: string }
  | { type: "select-layer"; layerId?: string }
  | { type: "toggle-safe-area" }
  | { type: "reorder-layer"; formatId: string; layerId: string; direction: "forward" | "backward" }
  | { type: "reset-format-layout"; formatId: string }
  | { type: "reset-layer"; formatId: string; layerId: string }
  | { type: "set-format-scale"; formatId: string; scale: number }
  | { type: "set-master-image"; formatId: string; url?: string }
  | { type: "push-reframe-history"; formatId: string; url: string }
  | { type: "rollback-reframe"; formatId: string }
  | { type: "clear-reframe-history"; formatId: string }
  | { type: "set-vehicle"; vehicleId: string | null | undefined }
  | { type: "set-banner-project-id"; id: string | undefined }
  | { type: "set-project-title"; title: string }
  | { type: "set-ci"; patch: Partial<CiState> }
  | { type: "apply-brand-preset"; brandKey: string }
  | { type: "hydrate"; state: StudioState }
  | { type: "undo" }
  | { type: "redo" };

const initialFormatId = BANNER_FORMATS[0].id;

function buildDefaultCi(): CiState {
  const p = getBrandPreset("custom");
  return {
    brandKey: p.key,
    fontDisplay: p.fonts.display,
    fontBody: p.fonts.body,
    googleFonts: p.googleFonts,
    colors: { ...p.colors },
    logoMode: "original",
    logoCustomColor: "#ffffff",
    useDealerLogo: false,
  };
}

const initialPresent: StudioState = {
  selectedFormatIds: [initialFormatId],
  activeFormatId: initialFormatId,
  textFields: { ...DEFAULT_TEXT_FIELDS },
  compositions: {
    [initialFormatId]: buildDefaultComposition(initialFormatId),
  },
  showSafeArea: false,
  ci: buildDefaultCi(),
};

function ensureComposition(state: StudioState, formatId: string): BannerComposition {
  return state.compositions[formatId] ?? buildDefaultComposition(formatId);
}

function presentReducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "set-active-format": {
      const comps = { ...state.compositions };
      if (!comps[action.formatId]) comps[action.formatId] = buildDefaultComposition(action.formatId);
      const selected = state.selectedFormatIds.includes(action.formatId)
        ? state.selectedFormatIds
        : [...state.selectedFormatIds, action.formatId];
      return { ...state, activeFormatId: action.formatId, selectedFormatIds: selected, compositions: comps };
    }
    case "toggle-format": {
      const isSelected = state.selectedFormatIds.includes(action.formatId);
      const selected = isSelected
        ? state.selectedFormatIds.filter((id) => id !== action.formatId)
        : [...state.selectedFormatIds, action.formatId];
      const comps = { ...state.compositions };
      if (!isSelected && !comps[action.formatId]) {
        comps[action.formatId] = buildDefaultComposition(action.formatId);
      }
      const active = selected.includes(state.activeFormatId)
        ? state.activeFormatId
        : selected[0] ?? initialFormatId;
      return { ...state, selectedFormatIds: selected, compositions: comps, activeFormatId: active };
    }
    case "set-text":
      return { ...state, textFields: { ...state.textFields, [action.field]: action.value } };
    case "set-background": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, backgroundImageUrl: action.url } },
      };
    }
    case "set-bg-fit": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, backgroundFit: action.fit } },
      };
    }
    case "set-overlay": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: {
          ...state.compositions,
          [action.formatId]: { ...c, overlayDirection: action.direction, overlayStrength: action.strength },
        },
      };
    }
    case "set-template": {
      const c = ensureComposition(state, action.formatId);
      const f = getFormatById(action.formatId);
      const newLayers = getLayoutTemplate(action.templateId).build(f.width, f.height);
      const merged = newLayers.map((nl) => {
        const prev = c.layers.find((p) => p.id === nl.id);
        return prev ? { ...nl, visible: prev.visible } : nl;
      });
      return {
        ...state,
        compositions: {
          ...state.compositions,
          [action.formatId]: { ...c, selectedTemplateId: action.templateId, layers: merged },
        },
      };
    }
    case "set-logo": {
      const c = ensureComposition(state, action.formatId);
      const layers = c.layers.map((l) => (l.id === "logo" ? { ...l, visible: !!action.url } : l));
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, logoUrl: action.url, layers } },
      };
    }
    case "patch-layer": {
      const c = ensureComposition(state, action.formatId);
      const layers = c.layers.map((l) => (l.id === action.layerId ? { ...l, ...action.patch } : l));
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers } },
      };
    }
    case "add-layer": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers: [...c.layers, action.layer] } },
      };
    }
    case "remove-layer": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: {
          ...state.compositions,
          [action.formatId]: { ...c, layers: c.layers.filter((l) => l.id !== action.layerId) },
        },
        selectedLayerId: state.selectedLayerId === action.layerId ? undefined : state.selectedLayerId,
      };
    }
    case "select-layer":
      return { ...state, selectedLayerId: action.layerId };
    case "toggle-safe-area":
      return { ...state, showSafeArea: !state.showSafeArea };
    case "reorder-layer": {
      const c = ensureComposition(state, action.formatId);
      const idx = c.layers.findIndex((l) => l.id === action.layerId);
      if (idx < 0) return state;
      const newLayers = [...c.layers];
      const targetIdx = action.direction === "forward" ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= newLayers.length) return state;
      [newLayers[idx], newLayers[targetIdx]] = [newLayers[targetIdx], newLayers[idx]];
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers: newLayers } },
      };
    }
    case "reset-format-layout": {
      const c = ensureComposition(state, action.formatId);
      const f = getFormatById(action.formatId);
      const layers = getLayoutTemplate(c.selectedTemplateId).build(f.width, f.height);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers, scale: 1 } },
      };
    }
    case "reset-layer": {
      const c = ensureComposition(state, action.formatId);
      const f = getFormatById(action.formatId);
      const tmplLayers = getLayoutTemplate(c.selectedTemplateId).build(f.width, f.height);
      const def = tmplLayers.find((l) => l.id === action.layerId);
      if (!def) return state;
      const layers = c.layers.map((l) => (l.id === action.layerId ? { ...def, visible: l.visible } : l));
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers } },
      };
    }
    case "set-format-scale": {
      const c = ensureComposition(state, action.formatId);
      const scale = Math.max(0.5, Math.min(1.6, action.scale));
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, scale } },
      };
    }
    case "set-master-image": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, masterImageUrl: action.url } },
      };
    }
    case "push-reframe-history": {
      const c = ensureComposition(state, action.formatId);
      const next = [...(c.reframeHistory ?? []), action.url].slice(-8);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, reframeHistory: next } },
      };
    }
    case "rollback-reframe": {
      const c = ensureComposition(state, action.formatId);
      const hist = [...(c.reframeHistory ?? [])];
      if (hist.length === 0) return state;
      const prev = hist.pop()!;
      return {
        ...state,
        compositions: {
          ...state.compositions,
          [action.formatId]: { ...c, backgroundImageUrl: prev, reframeHistory: hist },
        },
      };
    }
    case "clear-reframe-history": {
      const c = ensureComposition(state, action.formatId);
      return {
        ...state,
        compositions: { ...state.compositions, [action.formatId]: { ...c, reframeHistory: [] } },
      };
    }
    case "set-vehicle":
      return { ...state, vehicleId: action.vehicleId };
    case "set-banner-project-id":
      return { ...state, bannerProjectId: action.id };
    case "set-project-title":
      return { ...state, projectTitle: action.title };
    case "set-ci": {
      const cur = state.ci ?? buildDefaultCi();
      return { ...state, ci: { ...cur, ...action.patch, colors: { ...cur.colors, ...(action.patch.colors ?? {}) } } };
    }
    case "apply-brand-preset": {
      const p = getBrandPreset(action.brandKey);
      const cur = state.ci ?? buildDefaultCi();
      return {
        ...state,
        ci: {
          ...cur,
          brandKey: p.key,
          fontDisplay: p.fonts.display,
          fontBody: p.fonts.body,
          googleFonts: p.googleFonts,
          colors: { ...p.colors },
        },
      };
    }
    case "hydrate":
      return { ...state, ...action.state, ci: action.state.ci ?? state.ci ?? buildDefaultCi() };
    default:
      return state;
  }
}

// Actions excluded from undo/redo history (transient or remote-driven).
const NON_UNDOABLE = new Set<Action["type"]>([
  "select-layer",
  "toggle-safe-area",
  "set-active-format",
  "set-banner-project-id",
  "set-vehicle",
  "hydrate",
  "undo",
  "redo",
]);

type MetaState = {
  present: StudioState;
  past: StudioState[];
  future: StudioState[];
};

const initialMeta: MetaState = { present: initialPresent, past: [], future: [] };
const HISTORY_LIMIT = 60;

function metaReducer(meta: MetaState, action: Action): MetaState {
  if (action.type === "undo") {
    if (meta.past.length === 0) return meta;
    const past = [...meta.past];
    const prev = past.pop()!;
    return { present: prev, past, future: [meta.present, ...meta.future].slice(0, HISTORY_LIMIT) };
  }
  if (action.type === "redo") {
    if (meta.future.length === 0) return meta;
    const [next, ...rest] = meta.future;
    return { present: next, past: [...meta.past, meta.present].slice(-HISTORY_LIMIT), future: rest };
  }
  const next = presentReducer(meta.present, action);
  if (next === meta.present) return meta;
  if (NON_UNDOABLE.has(action.type)) return { ...meta, present: next };
  return {
    present: next,
    past: [...meta.past, meta.present].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function useCanvasBannerStore() {
  const [meta, dispatch] = useReducer(metaReducer, initialMeta);
  const state = meta.present;

  const activeComposition = useMemo(
    () => state.compositions[state.activeFormatId] ?? buildDefaultComposition(state.activeFormatId),
    [state.compositions, state.activeFormatId],
  );

  const activeFormat = useMemo(() => getFormatById(state.activeFormatId), [state.activeFormatId]);

  const actions = useMemo(
    () => ({
      setActiveFormat: (formatId: string) => dispatch({ type: "set-active-format", formatId }),
      toggleFormat: (formatId: string) => dispatch({ type: "toggle-format", formatId }),
      setText: (field: BannerTextFieldKey, value: string) => dispatch({ type: "set-text", field, value }),
      setBackground: (url?: string, formatId = state.activeFormatId) =>
        dispatch({ type: "set-background", formatId, url }),
      setBgFit: (fit: ImageFitMode, formatId = state.activeFormatId) =>
        dispatch({ type: "set-bg-fit", formatId, fit }),
      setOverlay: (direction: OverlayDirection, strength: number, formatId = state.activeFormatId) =>
        dispatch({ type: "set-overlay", formatId, direction, strength }),
      setTemplate: (templateId: string, formatId = state.activeFormatId) =>
        dispatch({ type: "set-template", formatId, templateId }),
      setLogo: (
        url?: string,
        scope?: string | string[] | "all" | "current",
      ) => {
        let ids: string[];
        if (scope === "all") ids = state.selectedFormatIds;
        else if (Array.isArray(scope)) ids = scope;
        else if (typeof scope === "string" && scope !== "current") ids = [scope];
        else ids = [state.activeFormatId];
        ids.forEach((formatId) => dispatch({ type: "set-logo", formatId, url }));
      },
      patchLayer: (layerId: string, patch: Partial<BannerLayer>, formatId = state.activeFormatId) =>
        dispatch({ type: "patch-layer", formatId, layerId, patch }),
      addLayer: (layer: BannerLayer, formatId = state.activeFormatId) =>
        dispatch({ type: "add-layer", formatId, layer }),
      removeLayer: (layerId: string, formatId = state.activeFormatId) =>
        dispatch({ type: "remove-layer", formatId, layerId }),
      selectLayer: (layerId?: string) => dispatch({ type: "select-layer", layerId }),
      toggleSafeArea: () => dispatch({ type: "toggle-safe-area" }),
      reorderLayer: (layerId: string, direction: "forward" | "backward", formatId = state.activeFormatId) =>
        dispatch({ type: "reorder-layer", formatId, layerId, direction }),
      resetLayout: (formatId = state.activeFormatId) =>
        dispatch({ type: "reset-format-layout", formatId }),
      resetLayer: (layerId: string, formatId = state.activeFormatId) =>
        dispatch({ type: "reset-layer", formatId, layerId }),
      setFormatScale: (scale: number, formatId = state.activeFormatId) =>
        dispatch({ type: "set-format-scale", formatId, scale }),
      setMasterImage: (url: string | undefined, formatId = state.activeFormatId) =>
        dispatch({ type: "set-master-image", formatId, url }),
      pushReframeHistory: (url: string, formatId = state.activeFormatId) =>
        dispatch({ type: "push-reframe-history", formatId, url }),
      rollbackReframe: (formatId = state.activeFormatId) =>
        dispatch({ type: "rollback-reframe", formatId }),
      clearReframeHistory: (formatId = state.activeFormatId) =>
        dispatch({ type: "clear-reframe-history", formatId }),
      setVehicle: (vehicleId: string | null | undefined) =>
        dispatch({ type: "set-vehicle", vehicleId }),
      setBannerProjectId: (id: string | undefined) =>
        dispatch({ type: "set-banner-project-id", id }),
      setProjectTitle: (title: string) =>
        dispatch({ type: "set-project-title", title }),
      setCi: (patch: Partial<CiState>) => dispatch({ type: "set-ci", patch }),
      applyBrandPreset: (brandKey: string) => dispatch({ type: "apply-brand-preset", brandKey }),
      hydrate: (s: StudioState) => dispatch({ type: "hydrate", state: s }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
    }),
    [state.activeFormatId, state.selectedFormatIds],
  );

  const ciColors = state.ci?.colors;
  const resolveColor = useCallback((token?: string): string => {
    if (!token) return "#ffffff";
    if (token.startsWith("#") || token.startsWith("rgb") || token.startsWith("hsl")) return token;
    if (ciColors) {
      const t = token.toLowerCase();
      if (t === "primary" || t === "accent") return ciColors.primary;
      if (t === "secondary") return ciColors.secondary;
      if (t === "text" || t === "foreground") return ciColors.text;
      if (t === "bg" || t === "background") return ciColors.bg;
    }
    if (typeof window === "undefined") return "#ffffff";
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
    return v ? `hsl(${v})` : "#ffffff";
  }, [ciColors]);

  const canUndo = meta.past.length > 0;
  const canRedo = meta.future.length > 0;

  return { state, actions, activeComposition, activeFormat, resolveColor, canUndo, canRedo };
}

export type CanvasBannerStore = ReturnType<typeof useCanvasBannerStore>;
