import type { SymbolId } from "./symbols";

type Strip = SymbolId[];

function buildStrip(counts: Partial<Record<SymbolId, number>>): Strip {
  const strip: Strip = [];
  for (const [id, count] of Object.entries(counts) as [SymbolId, number][]) {
    for (let i = 0; i < count; i++) strip.push(id);
  }
  return strip;
}

// Total: 18+14+10+10+7+5+5+4+4+3 = 80
const BASE_COUNTS: Partial<Record<SymbolId, number>> = {
  S1: 18, S2: 14, S3: 10,
  M1: 10, M2: 7,  M3: 5, M4: 5,
  H1: 4,
  W:  4,
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
