import type { SymbolId, SymbolTier } from "./symbols";

/**
 * Line win multipliers × credits-per-line.
 * Keyed by tier then match length (3, 4, 5).
 */
export const LINE_PAY: Record<Exclude<SymbolTier, "scatter">, Record<3 | 4 | 5, number>> = {
  low: { 3: 5, 4: 25, 5: 100 },
  mid: { 3: 15, 4: 75, 5: 300 },
  high: { 3: 50, 4: 250, 5: 1000 },
  wild: { 3: 0, 4: 0, 5: 2500 },
};

/** Scatter pays × total bet */
export const SCATTER_PAY: Record<2 | 3 | 4 | 5, number> = {
  2: 2,
  3: 5,
  4: 20,
  5: 50,
};

export function getLinePay(tier: Exclude<SymbolTier, "scatter">, count: 3 | 4 | 5): number {
  return LINE_PAY[tier][count] ?? 0;
}

export function getScatterPay(count: number): number {
  if (count < 2) return 0;
  const c = Math.min(count, 5) as 2 | 3 | 4 | 5;
  return SCATTER_PAY[c] ?? 0;
}

/**
 * Determine the effective tier for a run of symbols after wild substitution.
 * A run is a consecutive left-anchored slice of the active payline.
 * Returns null if the run is all wilds (handled separately as 5-wild).
 */
export function resolveLineTier(symbols: SymbolId[]): Exclude<SymbolTier, "scatter"> | null {
  const nonWild = symbols.find((s) => s !== "W");
  if (!nonWild) return "wild";
  const tier = nonWild === "H1" ? "high" : ["M1", "M2", "M3"].includes(nonWild) ? "mid" : "low";
  return tier;
}
