import { REEL_STRIPS, REEL_LENGTH } from "./reels";
import type { SymbolId } from "./symbols";

export type Grid = SymbolId[][];

/**
 * Draw a 5×3 grid by sampling each reel strip.
 * rng must return floats in [0, 1).
 */
export function drawGrid(rng: () => number): Grid {
  return REEL_STRIPS.map((strip) => {
    const stop = Math.floor(rng() * REEL_LENGTH);
    return [
      strip[stop % REEL_LENGTH],
      strip[(stop + 1) % REEL_LENGTH],
      strip[(stop + 2) % REEL_LENGTH],
    ];
  });
}
