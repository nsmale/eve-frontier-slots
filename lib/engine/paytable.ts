/** Anchors that a payline run can resolve to */
export type LineAnchor = "S1" | "S2" | "S3" | "M1" | "M2" | "M3" | "H1" | "W";

export const LINE_ANCHORS: LineAnchor[] = ["S1", "S2", "S3", "M1", "M2", "M3", "H1", "W"];

/**
 * Per-symbol line-pay multipliers × credits-per-line.
 * W only pays at 5-of-a-kind.
 * Tuned for ~88.7% base-game RTP. With long-run jackpot reclaim (200+100+50
 * bps = 3.5%) the total player RTP averages ~92.2%. House margin ~7.8%.
 */
const SYMBOL_LINE_PAY: Record<LineAnchor, Partial<Record<3 | 4 | 5, number>>> = {
  S1: { 3: 1,   4: 3,    5: 9    },
  S2: { 3: 2,   4: 7,    5: 20   },
  S3: { 3: 3,   4: 15,   5: 50   },
  M1: { 3: 5,   4: 22,   5: 85   },
  M2: { 3: 10,  4: 50,   5: 200  },
  M3: { 3: 20,  4: 100,  5: 400  },
  H1: { 3: 50,  4: 250,  5: 1000 },
  W:  {                  5: 2000 },
};

/** Scatter pays × total bet. 2-scatter intentionally pays 0. */
export const SCATTER_PAY: Record<2 | 3 | 4 | 5, number> = { 2: 0, 3: 1, 4: 3, 5: 10 };

export function getLinePay(anchor: LineAnchor, count: 3 | 4 | 5): number {
  return SYMBOL_LINE_PAY[anchor][count] ?? 0;
}

export function getScatterPay(count: number): number {
  if (count < 2) return 0;
  const c = Math.min(count, 5) as 2 | 3 | 4 | 5;
  return SCATTER_PAY[c] ?? 0;
}

/** Expose full table for the Paytable UI component */
export { SYMBOL_LINE_PAY };
