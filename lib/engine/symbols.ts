export const SYMBOL_IDS = ["S1", "S2", "S3", "S4", "M1", "M2", "M3", "H1", "W", "SC"] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

export type SymbolTier = "low" | "mid" | "high" | "wild" | "scatter";

export interface SymbolDef {
  id: SymbolId;
  tier: SymbolTier;
  label: string;
  color: string;
  shape: "circle" | "hex" | "star" | "diamond" | "ring";
}

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  S1: { id: "S1", tier: "low", label: "SHIP-1", color: "#3b82f6", shape: "circle" },
  S2: { id: "S2", tier: "low", label: "SHIP-2", color: "#22c55e", shape: "circle" },
  S3: { id: "S3", tier: "low", label: "SHIP-3", color: "#eab308", shape: "circle" },
  S4: { id: "S4", tier: "low", label: "SHIP-4", color: "#f97316", shape: "circle" },
  M1: { id: "M1", tier: "mid", label: "TRIBE-1", color: "#a855f7", shape: "hex" },
  M2: { id: "M2", tier: "mid", label: "TRIBE-2", color: "#ec4899", shape: "hex" },
  M3: { id: "M3", tier: "mid", label: "TRIBE-3", color: "#14b8a6", shape: "hex" },
  H1: { id: "H1", tier: "high", label: "STAR", color: "#fbbf24", shape: "star" },
  W: { id: "W", tier: "wild", label: "WILD", color: "#1a1a1a", shape: "diamond" },
  SC: { id: "SC", tier: "scatter", label: "SCATTER", color: "#ef4444", shape: "ring" },
};

export function isWild(id: SymbolId): boolean {
  return id === "W";
}

export function isScatter(id: SymbolId): boolean {
  return id === "SC";
}

export function getTier(id: SymbolId): SymbolTier {
  return SYMBOLS[id].tier;
}
