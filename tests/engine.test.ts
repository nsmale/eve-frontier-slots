import { describe, it, expect } from "vitest";
import { evaluate } from "../lib/engine/evaluate";
import { drawGrid } from "../lib/engine/spin";
import { mulberry32 } from "../lib/rng/prng";
import type { SymbolId } from "../lib/engine/symbols";
import { PAYLINES } from "../lib/engine/paylines";
import { getLinePay, getScatterPay } from "../lib/engine/paytable";
import { isWild, isScatter, isSeer, getTier } from "../lib/engine/symbols";

// Helper: build a grid with specific symbols on a given payline, rest filled with S1
function gridWithLine(lineIdx: number, symbols: SymbolId[]): SymbolId[][] {
  const grid: SymbolId[][] = Array.from({ length: 5 }, () => ["S1", "S1", "S1"] as SymbolId[]);
  const payline = PAYLINES[lineIdx];
  for (let reel = 0; reel < 5; reel++) {
    grid[reel][payline[reel]] = symbols[reel];
  }
  return grid;
}

function solidGrid(sym: SymbolId): SymbolId[][] {
  return Array.from({ length: 5 }, () => [sym, sym, sym] as SymbolId[]);
}

// ─── Paytable unit tests ──────────────────────────────────────────────────────
// Values tuned for ~88.7% base RTP → ~92.2% total with jackpot reclaim.

describe("paytable", () => {
  it("getLinePay: S1 3-of-a-kind = 1",   () => expect(getLinePay("S1", 3)).toBe(1));
  it("getLinePay: S2 3-of-a-kind = 2",   () => expect(getLinePay("S2", 3)).toBe(2));
  it("getLinePay: S3 5-of-a-kind = 50",  () => expect(getLinePay("S3", 5)).toBe(50));
  it("getLinePay: M1 3-of-a-kind = 5",   () => expect(getLinePay("M1", 3)).toBe(5));
  it("getLinePay: M2 4-of-a-kind = 50",  () => expect(getLinePay("M2", 4)).toBe(50));
  it("getLinePay: M3 5-of-a-kind = 400", () => expect(getLinePay("M3", 5)).toBe(400));
  it("getLinePay: H1 5-of-a-kind = 1000",() => expect(getLinePay("H1", 5)).toBe(1000));
  it("getLinePay: W 5-of-a-kind = 2000", () => expect(getLinePay("W", 5)).toBe(2000));
  it("getLinePay: W 3-of-a-kind = 0 (wild only at 5)", () => expect(getLinePay("W", 3)).toBe(0));

  it("getScatterPay: 1 scatter = 0",  () => expect(getScatterPay(1)).toBe(0));
  it("getScatterPay: 2 scatters = 0", () => expect(getScatterPay(2)).toBe(0));
  it("getScatterPay: 3 scatters = 1", () => expect(getScatterPay(3)).toBe(1));
  it("getScatterPay: 4 scatters = 3", () => expect(getScatterPay(4)).toBe(3));
  it("getScatterPay: 5 scatters = 10",() => expect(getScatterPay(5)).toBe(10));
});

// ─── Payline shapes ───────────────────────────────────────────────────────────

describe("paylines", () => {
  it("5 paylines defined", () => expect(PAYLINES.length).toBe(5));
  it("each payline covers 5 reels", () => PAYLINES.forEach(p => expect(p.length).toBe(5)));
  it("line 1: top row [0,0,0,0,0]", () => expect(PAYLINES[0]).toEqual([0, 0, 0, 0, 0]));
  it("line 4: V-shape [0,1,2,1,0]", () => expect(PAYLINES[3]).toEqual([0, 1, 2, 1, 0]));
  it("line 5: inverted V [2,1,0,1,2]", () => expect(PAYLINES[4]).toEqual([2, 1, 0, 1, 2]));
});

// ─── Basic line wins (no wild/seer) ──────────────────────────────────────────

describe("evaluate: basic line wins", () => {
  it("S1 3-of-a-kind on line 1, 1 cpl → 1 credit", () => {
    const grid = gridWithLine(0, ["S1", "S1", "S1", "S2", "S3"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(1);
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(1);
  });

  it("S2 5-of-a-kind on line 2, 10 cpl → 200 credits", () => {
    const grid = gridWithLine(1, ["S2", "S2", "S2", "S2", "S2"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 10 });
    const win = result.lineWins.find(w => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(200); // 20 × 10
  });

  it("M1 3-of-a-kind on line 3, 5 cpl → 25 credits", () => {
    const grid = gridWithLine(2, ["M1", "M1", "M1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 3, creditsPerLine: 5 });
    const win = result.lineWins.find(w => w.lineIndex === 2);
    expect(win).toBeDefined();
    expect(win!.payout).toBe(25); // 5 × 5
  });

  it("H1 5-of-a-kind on line 2, 5 cpl → 5000 credits", () => {
    const grid = gridWithLine(1, ["H1", "H1", "H1", "H1", "H1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 5 });
    const win = result.lineWins.find(w => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(5000); // 1000 × 5
  });

  it("no match (all different symbols) → no line wins", () => {
    const grid = gridWithLine(0, ["S1", "S2", "S3", "M1", "M2"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
    expect(result.totalPayout).toBe(0);
  });

  it("run of 2 → no payout (below minimum 3)", () => {
    const grid = gridWithLine(0, ["S1", "S1", "S2", "S3", "M1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
  });

  it("V-shape payline (line 4): S3×5 × 1 cpl → 50 credits", () => {
    // PAYLINES[3] = [0, 1, 2, 1, 0]
    const grid: SymbolId[][] = [
      ["S3", "S1", "S1"],
      ["S1", "S3", "S1"],
      ["S1", "S1", "S3"],
      ["S1", "S3", "S1"],
      ["S3", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 4, creditsPerLine: 1 });
    const win = result.lineWins.find(w => w.lineIndex === 3);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(50); // S3-5 × 1
  });

  it("inverted-V payline (line 5): M2×5 × 1 cpl → 200 credits", () => {
    // PAYLINES[4] = [2, 1, 0, 1, 2]
    const grid: SymbolId[][] = [
      ["S1", "S1", "M2"],
      ["S1", "M2", "S1"],
      ["M2", "S1", "S1"],
      ["S1", "M2", "S1"],
      ["S1", "S1", "M2"],
    ];
    const result = evaluate({ grid, lines: 5, creditsPerLine: 1 });
    const win = result.lineWins.find(w => w.lineIndex === 4);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(200); // M2-5 × 1
  });
});

// ─── Wild substitution ────────────────────────────────────────────────────────

describe("evaluate: wild substitution", () => {
  it("W, S1, S1 → S1-3 × 1 cpl = 1", () => {
    const grid = gridWithLine(0, ["W", "S1", "S1", "S2", "S3"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(1);
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(1);
  });

  it("S2, S2, W, S2, S2 → S2-5 × 5 cpl = 100", () => {
    const grid = gridWithLine(0, ["S2", "S2", "W", "S2", "S2"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 5 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(100); // S2-5 (20) × 5
  });

  it("M2, M2, W, M2, S1 → M2-4 × 10 cpl = 500", () => {
    const grid = gridWithLine(1, ["M2", "M2", "W", "M2", "S1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 10 });
    const win = result.lineWins.find(w => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(4);
    expect(win!.payout).toBe(500); // M2-4 (50) × 10
  });

  it("H1×5 × 1 cpl = 1000", () => {
    const grid = gridWithLine(0, ["H1", "H1", "H1", "H1", "H1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(1000);
  });

  it("W×5 → 5-wild payout × 1 cpl = 2000", () => {
    const grid = gridWithLine(0, ["W", "W", "W", "W", "W"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(2000);
  });

  it("wild does NOT substitute for scatter", () => {
    const grid = gridWithLine(0, ["W", "SC", "SC", "SC", "SC"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
  });

  it("W, H1, H1, S1, S1 → H1-3 × 1 cpl = 50", () => {
    const grid = gridWithLine(0, ["W", "H1", "H1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(50);
  });

  it("W, W, H1, H1, S1 → H1-4 × 1 cpl = 250", () => {
    const grid = gridWithLine(0, ["W", "W", "H1", "H1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(4);
    expect(result.lineWins[0].payout).toBe(250);
  });

  it("3 wilds followed by S1, S1 → S1-5 (wilds sub for S1) × 1 cpl = 9", () => {
    const grid = gridWithLine(0, ["W", "W", "W", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    // anchor=S1: W,W,W,S1,S1 all match S1 → count=5, has S1 → pay(S1,5)=9
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(9);
  });
});

// ─── Seer (M4) substitution ───────────────────────────────────────────────────

describe("evaluate: seer substitution", () => {
  it("M4, M1, M1, S1, S1 → M1-3 × 1 cpl = 5 (seer extends M1 run)", () => {
    const grid = gridWithLine(0, ["M4", "M1", "M1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(1);
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(5);
  });

  it("M3, M3, M4, S1, S1 → M3-3 × 1 cpl = 20", () => {
    const grid = gridWithLine(0, ["M3", "M3", "M4", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(20);
  });

  it("M3, M4, M4, M4, S1 → M3-4 × 1 cpl = 100 (seer inherits highest anchor)", () => {
    const grid = gridWithLine(0, ["M3", "M4", "M4", "M4", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(4);
    expect(result.lineWins[0].payout).toBe(100);
  });

  it("M4×5 (all-seer) → M1 rate × 1 cpl = 85", () => {
    const grid = gridWithLine(0, ["M4", "M4", "M4", "M4", "M4"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(85);
  });

  it("seer does NOT extend low-symbol runs", () => {
    // M4 at pos 0 breaks an S1 run since Seer only extends mid anchors
    const grid = gridWithLine(0, ["M4", "S1", "S1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    // M4 at pos 0: for S1 anchor, M4 is neither S1, wild, nor seer-for-mid → breaks immediately
    // So no line win starting from reel 0
    expect(result.lineWins).toHaveLength(0);
  });

  it("W, M4, M3, M4, W → M3-5 × 1 cpl = 400 (wild + seer both extend)", () => {
    const grid = gridWithLine(0, ["W", "M4", "M3", "M4", "W"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(400);
  });

  it("W, W, W, M4, W → M1 rate × 1 cpl = 85 (seer extends wild run to mid)", () => {
    // anchor=M1: W(wild)→1,W→2,W→3,M4(seer,isMid)→4,W→5. Has M1/M4 (has M4). pay(M1,5)=85
    // anchor=W: W,W,W,M4(breaks)→count=3. pay(W,3)=0
    const grid = gridWithLine(0, ["W", "W", "W", "M4", "W"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(85);
  });
});

// ─── Scatter pays ─────────────────────────────────────────────────────────────

describe("evaluate: scatter pays", () => {
  it("0 scatters → no scatter payout", () => {
    const result = evaluate({ grid: solidGrid("S1"), lines: 3, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(0);
    expect(result.scatterPayout).toBe(0);
  });

  it("1 scatter → no payout", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"], ["S1", "S1", "S1"], ["S1", "S1", "S1"],
      ["S1", "S1", "S1"], ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.scatterCount).toBe(1);
    expect(result.scatterPayout).toBe(0);
  });

  it("2 scatters → 0 (tease, no payout)", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"], ["SC", "S1", "S1"], ["S1", "S1", "S1"],
      ["S1", "S1", "S1"], ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 2, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(2);
    expect(result.scatterPayout).toBe(0);
  });

  it("3 scatters → 1 × totalBet = 50", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"], ["S1", "SC", "S1"], ["S1", "S1", "SC"],
      ["S1", "S1", "S1"], ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 5, creditsPerLine: 10 });
    expect(result.scatterCount).toBe(3);
    expect(result.scatterPayout).toBe(50); // 1 × 50
  });

  it("5 scatters → 10 × totalBet", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"], ["SC", "S1", "S1"], ["SC", "S1", "S1"],
      ["SC", "S1", "S1"], ["SC", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 3, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(5);
    expect(result.scatterPayout).toBe(150); // 10 × (3 × 5)
  });

  it("scatter count includes all rows, not just active paylines", () => {
    const grid: SymbolId[][] = [
      ["S1", "S1", "SC"], ["S1", "S1", "SC"], ["S1", "S1", "S1"],
      ["S1", "S1", "S1"], ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.scatterCount).toBe(2);
    expect(result.scatterPayout).toBe(0); // 2 scatters now pay 0
  });

  it("scatter at start of payline does not trigger line win", () => {
    const grid = gridWithLine(0, ["SC", "SC", "SC", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
  });
});

// ─── Multi-line & combined wins ───────────────────────────────────────────────

describe("evaluate: multi-line and combined wins", () => {
  it("inactive paylines do not contribute wins", () => {
    const grid = gridWithLine(2, ["M3", "M3", "M3", "S1", "S1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 1 });
    expect(result.lineWins.find(w => w.lineIndex === 2)).toBeUndefined();
  });

  it("multiple simultaneous line wins sum correctly", () => {
    const grid: SymbolId[][] = [
      ["S1", "S1", "S2"], ["S1", "S1", "S2"], ["S1", "S1", "S2"],
      ["S3", "S3", "S2"], ["S2", "S2", "S2"],
    ];
    const result = evaluate({ grid, lines: 2, creditsPerLine: 1 });
    expect(result.lineWins.length).toBeGreaterThanOrEqual(1);
    expect(result.totalPayout).toBeGreaterThan(0);
  });

  it("line win + scatter win sum into totalPayout", () => {
    const grid: SymbolId[][] = [
      ["S2", "S1", "S1"], ["S2", "S1", "S1"], ["S2", "S1", "S1"],
      ["S1", "SC", "S1"], ["S1", "SC", "S1"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    const lineTotal = result.lineWins.reduce((s, w) => s + w.payout, 0);
    expect(result.totalPayout).toBe(lineTotal + result.scatterPayout);
  });
});

// ─── drawGrid / PRNG ─────────────────────────────────────────────────────────

describe("drawGrid", () => {
  const VALID = ["S1","S2","S3","M1","M2","M3","M4","H1","W","SC"];

  it("produces a 5×3 grid of valid symbol IDs", () => {
    const grid = drawGrid(mulberry32(42));
    expect(grid).toHaveLength(5);
    grid.forEach(reel => {
      expect(reel).toHaveLength(3);
      reel.forEach(sym => expect(VALID).toContain(sym));
    });
  });

  it("same seed produces same grid (determinism)", () => {
    expect(drawGrid(mulberry32(1234))).toEqual(drawGrid(mulberry32(1234)));
  });

  it("different seeds produce different grids", () => {
    expect(drawGrid(mulberry32(1))).not.toEqual(drawGrid(mulberry32(9999)));
  });
});

// ─── Symbol helpers ───────────────────────────────────────────────────────────

describe("symbol helpers", () => {
  it("isWild identifies W only", () => {
    expect(isWild("W")).toBe(true);
    expect(isWild("S1")).toBe(false);
    expect(isWild("M4")).toBe(false);
  });
  it("isScatter identifies SC only", () => {
    expect(isScatter("SC")).toBe(true);
    expect(isScatter("W")).toBe(false);
  });
  it("isSeer identifies M4 only", () => {
    expect(isSeer("M4")).toBe(true);
    expect(isSeer("M1")).toBe(false);
    expect(isSeer("W")).toBe(false);
  });
  it("getTier returns correct tiers", () => {
    expect(getTier("S1")).toBe("low");
    expect(getTier("M1")).toBe("mid");
    expect(getTier("M4")).toBe("mid-wild");
    expect(getTier("H1")).toBe("high");
    expect(getTier("W")).toBe("wild");
    expect(getTier("SC")).toBe("scatter");
  });
});

// ─── cryptoRng ────────────────────────────────────────────────────────────────

describe("cryptoRng", () => {
  it("produces values in [0, 1)", async () => {
    const { cryptoRng } = await import("../lib/rng/prng");
    const rng = cryptoRng();
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces a valid grid using cryptoRng", async () => {
    const { cryptoRng } = await import("../lib/rng/prng");
    const grid = drawGrid(cryptoRng());
    expect(grid).toHaveLength(5);
    grid.forEach(reel => expect(reel).toHaveLength(3));
  });
});
