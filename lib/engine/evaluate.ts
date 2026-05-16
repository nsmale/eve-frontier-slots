import type { SymbolId } from "./symbols";
import { isWild, isSeer, isScatter, isMidAnchor } from "./symbols";
import { PAYLINES } from "./paylines";
import type { LineAnchor } from "./paytable";
import { LINE_ANCHORS, getLinePay, getScatterPay } from "./paytable";

export interface EvaluateInput {
  /** grid[reel][row] — 5 reels × 3 rows */
  grid: SymbolId[][];
  lines: 1 | 2 | 3 | 4 | 5;
  creditsPerLine: 1 | 5 | 10;
}

export interface LineWin {
  lineIndex: number;
  anchor: LineAnchor;
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

export function evaluate(input: EvaluateInput): EvaluateResult {
  const { grid, lines, creditsPerLine } = input;
  const totalBet = lines * creditsPerLine;
  const lineWins: LineWin[] = [];

  for (let lineIdx = 0; lineIdx < lines; lineIdx++) {
    const payline = PAYLINES[lineIdx];
    const cells: SymbolId[] = payline.map((row, reel) => grid[reel][row]);
    const win = evaluateLine(cells, creditsPerLine);
    if (win) lineWins.push({ lineIndex: lineIdx, ...win });
  }

  const scatterCount = countScatters(grid);
  const scatterPayout = scatterCount >= 2 ? getScatterPay(scatterCount) * totalBet : 0;
  const totalPayout = lineWins.reduce((s, w) => s + w.payout, 0) + scatterPayout;

  return { lineWins, scatterCount, scatterPayout, totalPayout };
}

function cellMatchesAnchor(cell: SymbolId, anchor: LineAnchor): boolean {
  if (isScatter(cell)) return false;
  if ((cell as string) === anchor) return true;               // exact match (incl. W===W)
  if (anchor !== "W" && isWild(cell)) return true;           // wild subs for non-wild anchor
  if (isMidAnchor(anchor) && isSeer(cell)) return true;      // seer subs for M1/M2/M3
  return false;
}

function hasRequiredActual(anchor: LineAnchor, run: SymbolId[]): boolean {
  if (anchor === "W") return true;
  if (anchor === "M1") return run.some(s => s === "M1" || isSeer(s));
  return run.some(s => (s as string) === anchor);
}

function evaluateLine(
  cells: SymbolId[],
  creditsPerLine: number
): Omit<LineWin, "lineIndex"> | null {
  let best: Omit<LineWin, "lineIndex"> | null = null;

  for (const anchor of LINE_ANCHORS) {
    let count = 0;
    for (const cell of cells) {
      if (!cellMatchesAnchor(cell, anchor)) break;
      count++;
    }
    if (count < 3) continue;

    const run = cells.slice(0, count);
    if (!hasRequiredActual(anchor, run)) continue;

    const payout = getLinePay(anchor, count as 3 | 4 | 5) * creditsPerLine;
    if (payout === 0) continue;

    if (!best || payout > best.payout) {
      best = { anchor, symbols: run, matchCount: count, payout };
    }
  }

  return best;
}

function countScatters(grid: SymbolId[][]): number {
  let n = 0;
  for (const reel of grid) for (const sym of reel) if (isScatter(sym)) n++;
  return n;
}
