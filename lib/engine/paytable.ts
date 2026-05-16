/** Anchors that a payline run can resolve to */
export type LineAnchor = "S1" | "S2" | "S3" | "M1" | "M2" | "M3" | "H1" | "W";

export const LINE_ANCHORS: LineAnchor[] = ["S1", "S2", "S3", "M1", "M2", "M3", "H1", "W"];

/**
 * Per-symbol line-pay multipliers × credits-per-line.
 * W only pays at 5-of-a-kind.
 */
const SYMBOL_LINE_PAY: Record<LineAnchor, Partial<Record<3 | 4 | 5, number>>> = {
  S1: { 3: 3,   4: 12,   5: 45    },
  S2: { 3: 7,   4: 30,   5: 100   },
  S3: { 3: 15,  4: 75,   5: 250   },
  M1: { 3: 20,  4: 100,  5: 400   },
  M2: { 3: 50,  4: 250,  5: 1000  },
  M3: { 3: 100, 4: 500,  5: 2000  },
  H1: { 3: 250, 4: 1250, 5: 5000  },
  W:  {                  5: 10000 },
};

/** Scatter pays × total bet */
export const SCATTER_PAY: Record<2 | 3 | 4 | 5, number> = { 2: 2, 3: 5, 4: 20, 5: 50 };

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
