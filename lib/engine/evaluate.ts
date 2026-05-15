import type { SymbolId } from "./symbols";
import { isWild, isScatter } from "./symbols";
import { PAYLINES } from "./paylines";
import { getLinePay, getScatterPay, resolveLineTier } from "./paytable";

export interface EvaluateInput {
  /** grid[reel][row] — 5 reels × 3 rows */
  grid: SymbolId[][];
  /** Number of active paylines (1–5). Lines are activated in order 1, 2, 3, 4, 5. */
  lines: 1 | 2 | 3 | 4 | 5;
  creditsPerLine: 1 | 5 | 10;
}

export interface LineWin {
  lineIndex: number;
  symbols: SymbolId[];
  matchCount: number;
  payout: number;
}

export interface EvaluateResult {
  lineWins: LineWin[];
  scatterCount: number;
  scatterPayout: number;
  totalPayout: number;
}

/**
 * Evaluate wins on a completed spin.
 *
 * Line wins: left-to-right consecutive starting at reel 0.
 * Wild (W) substitutes for any non-Scatter symbol.
 * Scatter (SC) pays regardless of payline position based on total count.
 *
 * Returns payout amounts in credits (not yet multiplied by credit value).
 */
export function evaluate(input: EvaluateInput): EvaluateResult {
  const { grid, lines, creditsPerLine } = input;
  const totalBet = lines * creditsPerLine;

  const lineWins: LineWin[] = [];

  for (let lineIdx = 0; lineIdx < lines; lineIdx++) {
    const payline = PAYLINES[lineIdx];
    const lineSymbols: SymbolId[] = payline.map((row, reel) => grid[reel][row]);

    const win = evaluateLine(lineSymbols, creditsPerLine);
    if (win) {
      lineWins.push({ lineIndex: lineIdx, ...win });
    }
  }

  const scatterCount = countScatters(grid);
  const scatterPayout = scatterCount >= 2 ? getScatterPay(scatterCount) * totalBet : 0;

  const totalPayout =
    lineWins.reduce((sum, w) => sum + w.payout, 0) + scatterPayout;

  return { lineWins, scatterCount, scatterPayout, totalPayout };
}

/**
 * Evaluate a single payline of 5 symbols.
 * Returns null if no win.
 */
function evaluateLine(
  symbols: SymbolId[],
  creditsPerLine: number
): Omit<LineWin, "lineIndex"> | null {
  const matchCount = countConsecutiveMatch(symbols);
  if (matchCount < 3) return null;

  const matchedSymbols = symbols.slice(0, matchCount);
  const tier = resolveLineTier(matchedSymbols);
  if (!tier) return null;

  const payout = getLinePay(tier, matchCount as 3 | 4 | 5) * creditsPerLine;
  if (payout === 0) return null;

  return { symbols: matchedSymbols, matchCount, payout };
}

/**
 * Count how many symbols from the left form a consecutive matching run.
 * Wild (W) extends any run. Scatter (SC) never participates in line wins.
 * Returns 0 if fewer than 3 match.
 */
function countConsecutiveMatch(symbols: SymbolId[]): number {
  const [first, ...rest] = symbols;

  if (isScatter(first)) return 0;

  // Find the base symbol (first non-wild from the left)
  let base: SymbolId | null = isWild(first) ? null : first;
  let count = 1;

  for (const sym of rest) {
    if (isScatter(sym)) break;
    if (isWild(sym)) {
      count++;
      continue;
    }
    if (base === null) {
      base = sym;
      count++;
    } else if (sym === base) {
      count++;
    } else {
      break;
    }
  }

  if (count < 3) return 0;

  // If the entire run is wilds (base still null), it's a 5-wild win
  if (base === null && count === 5) return 5;
  if (base === null) return 0;

  return count;
}

/**
 * Count scatter symbols anywhere in the 5×3 grid.
 */
function countScatters(grid: SymbolId[][]): number {
  let count = 0;
  for (const reel of grid) {
    for (const sym of reel) {
      if (isScatter(sym)) count++;
    }
  }
  return count;
}
