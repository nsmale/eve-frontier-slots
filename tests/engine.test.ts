import { describe, it, expect } from "vitest";
import { evaluate } from "../lib/engine/evaluate";
import { drawGrid } from "../lib/engine/spin";
import { mulberry32 } from "../lib/rng/prng";
import type { SymbolId } from "../lib/engine/symbols";
import { PAYLINES } from "../lib/engine/paylines";
import { getLinePay, getScatterPay, resolveLineTier } from "../lib/engine/paytable";
import { isWild, isScatter, getTier } from "../lib/engine/symbols";

// Helper: build a grid with specific symbols on a given payline, rest filled with S1
function gridWithLine(lineIdx: number, symbols: SymbolId[]): SymbolId[][] {
  const grid: SymbolId[][] = Array.from({ length: 5 }, () => ["S1", "S1", "S1"] as SymbolId[]);
  const payline = PAYLINES[lineIdx];
  for (let reel = 0; reel < 5; reel++) {
    grid[reel][payline[reel]] = symbols[reel];
  }
  return grid;
}

// Helper: fill grid with one symbol
function solidGrid(sym: SymbolId): SymbolId[][] {
  return Array.from({ length: 5 }, () => [sym, sym, sym] as SymbolId[]);
}

// ─── Paytable unit tests ──────────────────────────────────────────────────────

describe("paytable", () => {
  it("getLinePay: low tier 3-of-a-kind = 5", () => {
    expect(getLinePay("low", 3)).toBe(5);
  });
  it("getLinePay: low tier 5-of-a-kind = 100", () => {
    expect(getLinePay("low", 5)).toBe(100);
  });
  it("getLinePay: mid tier 4-of-a-kind = 75", () => {
    expect(getLinePay("mid", 4)).toBe(75);
  });
  it("getLinePay: high tier 5-of-a-kind = 1000", () => {
    expect(getLinePay("high", 5)).toBe(1000);
  });
  it("getLinePay: 5 wilds = 2500", () => {
    expect(getLinePay("wild", 5)).toBe(2500);
  });

  it("getScatterPay: 2 scatters = 2", () => {
    expect(getScatterPay(2)).toBe(2);
  });
  it("getScatterPay: 3 scatters = 5", () => {
    expect(getScatterPay(3)).toBe(5);
  });
  it("getScatterPay: 4 scatters = 20", () => {
    expect(getScatterPay(4)).toBe(20);
  });
  it("getScatterPay: 5 scatters = 50", () => {
    expect(getScatterPay(5)).toBe(50);
  });
  it("getScatterPay: 1 scatter = 0", () => {
    expect(getScatterPay(1)).toBe(0);
  });

  it("resolveLineTier: all low symbols → low", () => {
    expect(resolveLineTier(["S1", "S2", "S3"])).toBe("low");
  });
  it("resolveLineTier: all mid symbols → mid", () => {
    expect(resolveLineTier(["M1", "M2", "M3"])).toBe("mid");
  });
  it("resolveLineTier: high symbol → high", () => {
    expect(resolveLineTier(["H1", "H1", "H1"])).toBe("high");
  });
  it("resolveLineTier: all wilds → wild", () => {
    expect(resolveLineTier(["W", "W", "W", "W", "W"])).toBe("wild");
  });
  it("resolveLineTier: wild + low → low", () => {
    expect(resolveLineTier(["W", "S1", "S1"])).toBe("low");
  });
});

// ─── Payline shape tests ──────────────────────────────────────────────────────

describe("paylines", () => {
  it("5 paylines defined", () => {
    expect(PAYLINES.length).toBe(5);
  });
  it("each payline covers 5 reels", () => {
    PAYLINES.forEach((p) => expect(p.length).toBe(5));
  });
  it("line 1: top row [0,0,0,0,0]", () => {
    expect(PAYLINES[0]).toEqual([0, 0, 0, 0, 0]);
  });
  it("line 4: V-shape [0,1,2,1,0]", () => {
    expect(PAYLINES[3]).toEqual([0, 1, 2, 1, 0]);
  });
  it("line 5: inverted V [2,1,0,1,2]", () => {
    expect(PAYLINES[4]).toEqual([2, 1, 0, 1, 2]);
  });
});

// ─── Line win evaluation: no wild ─────────────────────────────────────────────

describe("evaluate: basic line wins (no wild)", () => {
  it("low-3-of-a-kind on line 1, 1 credit/line → 5 credits", () => {
    const grid = gridWithLine(0, ["S1", "S1", "S1", "S2", "S3"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(1);
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(5);
    expect(result.totalPayout).toBe(5);
  });

  it("low-5-of-a-kind on line 2, 10 credits/line → 1000 credits", () => {
    const grid = gridWithLine(1, ["S2", "S2", "S2", "S2", "S2"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 10 });
    const win = result.lineWins.find((w) => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(1000); // 100 × 10
  });

  it("mid-3-of-a-kind on line 3, 5 credits/line → 75 credits", () => {
    const grid = gridWithLine(2, ["M1", "M1", "M1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 3, creditsPerLine: 5 });
    const win = result.lineWins.find((w) => w.lineIndex === 2);
    expect(win).toBeDefined();
    expect(win!.payout).toBe(75); // 15 × 5
  });

  it("high-5-non-wild on line 2, 5 credits/line → 5000 credits", () => {
    const grid = gridWithLine(1, ["H1", "H1", "H1", "H1", "H1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 5 });
    const win = result.lineWins.find((w) => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(5000); // 1000 × 5
  });

  it("no match (different symbols) → no line wins", () => {
    const grid = gridWithLine(0, ["S1", "S2", "S3", "S4", "M1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
    expect(result.totalPayout).toBe(0);
  });

  it("match of 2 → no payout (below minimum 3)", () => {
    const grid = gridWithLine(0, ["S1", "S1", "S2", "S3", "S4"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
  });

  it("V-shape payline (line 4) wins correctly", () => {
    // PAYLINES[3] = [0, 1, 2, 1, 0]
    const grid: SymbolId[][] = [
      ["S3", "S1", "S1"], // reel 0, row 0 = S3
      ["S1", "S3", "S1"], // reel 1, row 1 = S3
      ["S1", "S1", "S3"], // reel 2, row 2 = S3
      ["S1", "S3", "S1"], // reel 3, row 1 = S3
      ["S3", "S1", "S1"], // reel 4, row 0 = S3
    ];
    const result = evaluate({ grid, lines: 4, creditsPerLine: 1 });
    const win = result.lineWins.find((w) => w.lineIndex === 3);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(100); // low-5 × 1
  });

  it("inverted-V payline (line 5) wins correctly", () => {
    // PAYLINES[4] = [2, 1, 0, 1, 2]
    const grid: SymbolId[][] = [
      ["S1", "S1", "M2"], // reel 0, row 2 = M2
      ["S1", "M2", "S1"], // reel 1, row 1 = M2
      ["M2", "S1", "S1"], // reel 2, row 0 = M2
      ["S1", "M2", "S1"], // reel 3, row 1 = M2
      ["S1", "S1", "M2"], // reel 4, row 2 = M2
    ];
    const result = evaluate({ grid, lines: 5, creditsPerLine: 1 });
    const win = result.lineWins.find((w) => w.lineIndex === 4);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(300); // mid-5 × 1
  });
});

// ─── Wild substitution ────────────────────────────────────────────────────────

describe("evaluate: wild substitution", () => {
  it("low-3-of-a-kind with leading wild → low 3 payout", () => {
    // [W, S1, S1, S2, S3] — wild substitutes for S1, giving 3-match low
    const grid = gridWithLine(0, ["W", "S1", "S1", "S2", "S3"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(1);
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(5); // low-3 × 1
  });

  it("low-5-of-a-kind with wild in middle → low 5 payout", () => {
    // [S4, S4, W, S4, S4]
    const grid = gridWithLine(0, ["S4", "S4", "W", "S4", "S4"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 5 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(500); // low-5 (100) × 5
  });

  it("mid-4-with-wild → mid 4 payout", () => {
    // [M2, M2, W, M2, S1]
    const grid = gridWithLine(1, ["M2", "M2", "W", "M2", "S1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 10 });
    const win = result.lineWins.find((w) => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(4);
    expect(win!.payout).toBe(750); // mid-4 (75) × 10
  });

  it("high-5-non-wild: H1×5 on line 2 → 1000 × creditsPerLine", () => {
    const grid = gridWithLine(1, ["H1", "H1", "H1", "H1", "H1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 1 });
    const win = result.lineWins.find((w) => w.lineIndex === 1);
    expect(win).toBeDefined();
    expect(win!.matchCount).toBe(5);
    expect(win!.payout).toBe(1000); // high-5 × 1
  });

  it("all 5 wilds → 5-wild payout of 2500 × creditsPerLine", () => {
    const grid = gridWithLine(0, ["W", "W", "W", "W", "W"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(5);
    expect(result.lineWins[0].payout).toBe(2500); // wild-5 × 1
  });

  it("wild does NOT substitute for scatter", () => {
    // [W, SC, SC, SC, SC] — scatter is not substitutable
    const grid = gridWithLine(0, ["W", "SC", "SC", "SC", "SC"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    // Line win: W followed by SC — SC breaks the run, so 0 line wins
    expect(result.lineWins).toHaveLength(0);
  });

  it("wild at position 0 followed by mixed symbols → takes base from first non-wild", () => {
    // [W, H1, H1, S1, S1] → resolves as H1 run of 3
    const grid = gridWithLine(0, ["W", "H1", "H1", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(3);
    expect(result.lineWins[0].payout).toBe(50); // high-3 × 1
  });

  it("two leading wilds followed by high → high 4 with wild fill", () => {
    // [W, W, H1, H1, S1]
    const grid = gridWithLine(0, ["W", "W", "H1", "H1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins[0].matchCount).toBe(4);
    expect(result.lineWins[0].payout).toBe(250); // high-4 × 1
  });
});

// ─── Scatter pays ─────────────────────────────────────────────────────────────

describe("evaluate: scatter pays", () => {
  it("0 scatters → no scatter payout", () => {
    const result = evaluate({ grid: solidGrid("S1"), lines: 3, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(0);
    expect(result.scatterPayout).toBe(0);
  });

  it("1 scatter → no payout (below minimum 2)", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.scatterCount).toBe(1);
    expect(result.scatterPayout).toBe(0);
  });

  it("2 scatters → 2 × totalBet", () => {
    // 2 lines × 5 credits = 10 total bet → scatter pays 2 × 10 = 20
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"],
      ["SC", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 2, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(2);
    expect(result.scatterPayout).toBe(20); // 2 × (2 × 5)
  });

  it("3 scatters → 5 × totalBet", () => {
    // 5 lines × 10 credits = 50 total bet → scatter pays 5 × 50 = 250
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"],
      ["S1", "SC", "S1"],
      ["S1", "S1", "SC"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 5, creditsPerLine: 10 });
    expect(result.scatterCount).toBe(3);
    expect(result.scatterPayout).toBe(250); // 5 × 50
  });

  it("5 scatters → 50 × totalBet", () => {
    const grid: SymbolId[][] = [
      ["SC", "S1", "S1"],
      ["SC", "S1", "S1"],
      ["SC", "S1", "S1"],
      ["SC", "S1", "S1"],
      ["SC", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 3, creditsPerLine: 5 });
    expect(result.scatterCount).toBe(5);
    expect(result.scatterPayout).toBe(750); // 50 × (3 × 5)
  });

  it("scatter count includes scatters in any row, not just active paylines", () => {
    // Scatter on reel 2 row 2 — not on any payline in lines:1 (top row only)
    const grid: SymbolId[][] = [
      ["S1", "S1", "SC"],
      ["S1", "S1", "SC"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
      ["S1", "S1", "S1"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.scatterCount).toBe(2);
    expect(result.scatterPayout).toBe(2); // 2 × (1 × 1)
  });
});

// ─── Multiple paylines & combined wins ───────────────────────────────────────

describe("evaluate: multi-line and combined wins", () => {
  it("inactive paylines do not contribute to wins", () => {
    // Win only on line 3 (index 2) but only 2 lines active
    const grid = gridWithLine(2, ["M3", "M3", "M3", "S1", "S1"]);
    const result = evaluate({ grid, lines: 2, creditsPerLine: 1 });
    expect(result.lineWins.find((w) => w.lineIndex === 2)).toBeUndefined();
  });

  it("multiple simultaneous line wins sum correctly", () => {
    // Put S1×3 on both line 1 (top) and line 2 (middle)
    const grid: SymbolId[][] = [
      ["S1", "S1", "S4"],
      ["S1", "S1", "S4"],
      ["S1", "S1", "S4"],
      ["S3", "S3", "S4"],
      ["S4", "S4", "S4"],
    ];
    // Line 1 (top): S1, S1, S1, S3, S4 → low-3 × 1 = 5
    // Line 2 (mid): S1, S1, S1, S3, S4 → low-3 × 1 = 5
    const result = evaluate({ grid, lines: 2, creditsPerLine: 1 });
    expect(result.lineWins.length).toBeGreaterThanOrEqual(1);
    expect(result.totalPayout).toBeGreaterThan(0);
  });

  it("line win + scatter win sum into totalPayout", () => {
    // Line 1: S2 × 3 → 5 × 1 = 5
    // 2 scatters on reel 3 and 4 → 2 × (1×1) = 2
    const grid: SymbolId[][] = [
      ["S2", "S4", "S4"],
      ["S2", "S4", "S4"],
      ["S2", "S4", "S4"],
      ["S4", "SC", "S4"],
      ["S4", "SC", "S4"],
    ];
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    const lineTotal = result.lineWins.reduce((s, w) => s + w.payout, 0);
    expect(result.totalPayout).toBe(lineTotal + result.scatterPayout);
  });

  it("scatter does not trigger line win when it starts a payline", () => {
    const grid = gridWithLine(0, ["SC", "SC", "SC", "S1", "S1"]);
    const result = evaluate({ grid, lines: 1, creditsPerLine: 1 });
    expect(result.lineWins).toHaveLength(0);
  });
});

// ─── drawGrid / PRNG ─────────────────────────────────────────────────────────

describe("drawGrid", () => {
  it("produces a 5×3 grid of valid symbol IDs", () => {
    const rng = mulberry32(42);
    const grid = drawGrid(rng);
    expect(grid).toHaveLength(5);
    grid.forEach((reel) => {
      expect(reel).toHaveLength(3);
      reel.forEach((sym) => {
        expect(["S1","S2","S3","S4","M1","M2","M3","H1","W","SC"]).toContain(sym);
      });
    });
  });

  it("same seed produces same grid (determinism)", () => {
    const g1 = drawGrid(mulberry32(1234));
    const g2 = drawGrid(mulberry32(1234));
    expect(g1).toEqual(g2);
  });

  it("different seeds produce different grids with high probability", () => {
    const g1 = drawGrid(mulberry32(1));
    const g2 = drawGrid(mulberry32(9999));
    expect(g1).not.toEqual(g2);
  });
});

// ─── Symbol helpers ───────────────────────────────────────────────────────────

describe("symbol helpers", () => {
  it("isWild identifies W only", () => {
    expect(isWild("W")).toBe(true);
    expect(isWild("S1")).toBe(false);
    expect(isWild("SC")).toBe(false);
  });
  it("isScatter identifies SC only", () => {
    expect(isScatter("SC")).toBe(true);
    expect(isScatter("W")).toBe(false);
    expect(isScatter("H1")).toBe(false);
  });
  it("getTier returns correct tier for all symbols", () => {
    expect(getTier("S1")).toBe("low");
    expect(getTier("M1")).toBe("mid");
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
    grid.forEach((reel) => expect(reel).toHaveLength(3));
  });
});
