import type { SymbolId } from "./symbols";

/**
 * Reel strips — 5 strips, one per reel.
 * Symbol distribution targets from SPEC §4.2:
 *   Low (S1–S4):  ~16.25% each  → 4 × 13 = 52 stops per 80
 *   Mid (M1–M3):  ~7.67% each   → 3 ×  6 = 18 stops per 80  (but ≈ 7.5%)
 *   High (H1):    ~5%            → 1 ×  4 =  4 stops per 80
 *   Wild (W):     ~3%            → 1 ×  3 =  3 stops per 80
 *   Scatter (SC): ~3%            → 1 ×  3 =  3 stops per 80
 *
 * Total = 52 + 18 + 4 + 3 + 3 = 80 stops per reel.
 * Exact RTP tuning is done via /scripts/rtp-sim.ts; strip counts here are
 * the initial reasonable distribution.
 */

type Strip = SymbolId[];

function buildStrip(counts: Partial<Record<SymbolId, number>>): Strip {
  const strip: Strip = [];
  for (const [id, count] of Object.entries(counts) as [SymbolId, number][]) {
    for (let i = 0; i < count; i++) strip.push(id);
  }
  return strip;
}

const BASE_COUNTS: Partial<Record<SymbolId, number>> = {
  S1: 13, S2: 13, S3: 13, S4: 13,
  M1: 6,  M2: 6,  M3: 6,
  H1: 4,
  W:  3,
  SC: 3,
};

export const REEL_STRIPS: [Strip, Strip, Strip, Strip, Strip] = [
  buildStrip(BASE_COUNTS),
  buildStrip(BASE_COUNTS),
  buildStrip(BASE_COUNTS),
  buildStrip(BASE_COUNTS),
  buildStrip(BASE_COUNTS),
];

export const REEL_LENGTH = REEL_STRIPS[0].length;
