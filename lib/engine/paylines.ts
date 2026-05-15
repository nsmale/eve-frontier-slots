/**
 * Payline definitions. Each entry is [row_reel0, row_reel1, ..., row_reel4].
 * row 0 = top, row 1 = middle, row 2 = bottom.
 */
export const PAYLINES: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 0, 0], // Line 1 — Top
  [1, 1, 1, 1, 1], // Line 2 — Middle
  [2, 2, 2, 2, 2], // Line 3 — Bottom
  [0, 1, 2, 1, 0], // Line 4 — V-shape
  [2, 1, 0, 1, 2], // Line 5 — Inverted V
] as const;

export type PaylineIndex = 0 | 1 | 2 | 3 | 4;
