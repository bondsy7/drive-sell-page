import { useCallback, useMemo, useReducer } from "react";
import type {
  BannerComposition,
  BannerLayer,
  BannerTextFieldKey,
  ImageFitMode,
  OverlayDirection,
  StudioState,
} from "./types";
import { BANNER_FORMATS, getFormatById } from "../data/formats";
import { buildDefaultComposition, DEFAULT_TEXT_FIELDS } from "../data/defaultComposition";
import { getLayoutTemplate } from "../data/layoutTemplates";

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
  | { type: "select-layer"; layerId?: string }
  | { type: "toggle-safe-area" }
  | { type: "reorder-layer"; formatId: string; layerId: string; direction: "forward" | "backward" }
  | { type: "reset-format-layout"; formatId: string };

const initialFormatId = BANNER_FORMATS[0].id;

const initialState: StudioState = {
  selectedFormatIds: [initialFormatId],
  activeFormatId: initialFormatId,
  textFields: { ...DEFAULT_TEXT_FIELDS },
  compositions: {
    [initialFormatId]: buildDefaultComposition(initialFormatId),
  },
  showSafeArea: false,
};

function ensureComposition(state: StudioState, formatId: string): BannerComposition {
  return state.compositions[formatId] ?? buildDefaultComposition(formatId);
}

function reducer(state: StudioState, action: Action): StudioState {
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
      // Preserve visibility/text-field mapping from existing layers when ids match.
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
        compositions: { ...state.compositions, [action.formatId]: { ...c, layers } },
      };
    }
    default:
      return state;
  }
}

export function useCanvasBannerStore() {
  const [state, dispatch] = useReducer(reducer, initialState);

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
      setLogo: (url?: string, formatId = state.activeFormatId) =>
        dispatch({ type: "set-logo", formatId, url }),
      patchLayer: (layerId: string, patch: Partial<BannerLayer>, formatId = state.activeFormatId) =>
        dispatch({ type: "patch-layer", formatId, layerId, patch }),
      selectLayer: (layerId?: string) => dispatch({ type: "select-layer", layerId }),
      toggleSafeArea: () => dispatch({ type: "toggle-safe-area" }),
      reorderLayer: (layerId: string, direction: "forward" | "backward", formatId = state.activeFormatId) =>
        dispatch({ type: "reorder-layer", formatId, layerId, direction }),
      resetLayout: (formatId = state.activeFormatId) =>
        dispatch({ type: "reset-format-layout", formatId }),
    }),
    [state.activeFormatId],
  );

  // Utility: read the resolved color value for a token.
  const resolveColor = useCallback((token?: string): string => {
    if (!token) return "#ffffff";
    if (token.startsWith("#") || token.startsWith("rgb") || token.startsWith("hsl")) return token;
    if (typeof window === "undefined") return "#ffffff";
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
    return v ? `hsl(${v})` : "#ffffff";
  }, []);

  return { state, actions, activeComposition, activeFormat, resolveColor };
}

export type CanvasBannerStore = ReturnType<typeof useCanvasBannerStore>;
