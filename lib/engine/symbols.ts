export const SYMBOL_IDS = ["S1", "S2", "S3", "M1", "M2", "M3", "M4", "H1", "W", "SC"] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

export type SymbolTier = "low" | "mid" | "mid-wild" | "high" | "wild" | "scatter";

export interface SymbolDef {
  id: SymbolId;
  tier: SymbolTier;
  label: string;
  color: string;
  shape: "circle" | "hex" | "star" | "diamond" | "ring";
}

/** Maps each symbol to its artwork PNG path under /public */
export const SYMBOL_ART: Record<SymbolId, string> = {
  S1: "/artwork/ships-reiver-awakened.png",
  S2: "/artwork/ships-reiver-initated.png",
  S3: "/artwork/ships-reiver-ascended.png",
  M1: "/artwork/character-awakened.png",
  M2: "/artwork/character-initiated.png",
  M3: "/artwork/character-ascended.png",
  M4: "/artwork/character-seers.png",
  H1: "/artwork/tribe-war.png",
  W:  "/artwork/tribe-peace.png",
  SC: "/artwork/rift-red.png",
};

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  S1: { id: "S1", tier: "low",      label: "Reiver Awakened",  color: "#3b82f6", shape: "circle" },
  S2: { id: "S2", tier: "low",      label: "Reiver Initiated", color: "#22c55e", shape: "circle" },
  S3: { id: "S3", tier: "low",      label: "Reiver Ascended",  color: "#eab308", shape: "circle" },
  M1: { id: "M1", tier: "mid",      label: "Char. Awakened",   color: "#a855f7", shape: "hex" },
  M2: { id: "M2", tier: "mid",      label: "Char. Initiated",  color: "#ec4899", shape: "hex" },
  M3: { id: "M3", tier: "mid",      label: "Char. Ascended",   color: "#14b8a6", shape: "hex" },
  M4: { id: "M4", tier: "mid-wild", label: "Seer (mid wild)",  color: "#f0e040", shape: "diamond" },
  H1: { id: "H1", tier: "high",     label: "Tribe War",        color: "#fbbf24", shape: "star" },
  W:  { id: "W",  tier: "wild",     label: "Tribe Peace",      color: "#ffffff", shape: "diamond" },
  SC: { id: "SC", tier: "scatter",  label: "Rift Red",         color: "#ef4444", shape: "ring" },
};

export function isWild(id: SymbolId): boolean    { return id === "W"; }
export function isSeer(id: SymbolId): boolean    { return id === "M4"; }
export function isScatter(id: SymbolId): boolean { return id === "SC"; }
/** M1 / M2 / M3 are the anchors that Seer can extend */
export function isMidAnchor(id: SymbolId): boolean { return id === "M1" || id === "M2" || id === "M3"; }
export function getTier(id: SymbolId): SymbolTier  { return SYMBOLS[id].tier; }
