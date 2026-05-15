"use client";

import { create } from "zustand";
import { evaluate, type EvaluateResult } from "./engine/evaluate";
import { drawGrid } from "./engine/spin";
import { cryptoRng } from "./rng/prng";
import type { Grid } from "./engine/spin";

export interface SessionStats {
  spins: number;
  wagered: number;
  won: number;
  biggestWin: number;
}

interface SlotState {
  balance: number;
  lines: 1 | 2 | 3 | 4 | 5;
  creditsPerLine: 1 | 5 | 10;
  spinning: boolean;
  grid: Grid | null;
  lastResult: EvaluateResult | null;
  stats: SessionStats;

  setLines: (lines: 1 | 2 | 3 | 4 | 5) => void;
  setCreditsPerLine: (cpl: 1 | 5 | 10) => void;
  executeSpin: () => { grid: Grid; result: EvaluateResult } | null;
  setSpinning: (v: boolean) => void;
  addWinToStats: (payout: number) => void;
  addCredits: (amount?: number) => void;
}

const STORAGE_KEY = "eve-slots-balance";
const STATS_KEY = "eve-slots-stats";
const INITIAL_BALANCE = 1000;

function loadBalance(): number {
  if (typeof window === "undefined") return INITIAL_BALANCE;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return isNaN(parsed) ? INITIAL_BALANCE : parsed;
}

function saveBalance(balance: number) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, String(balance));
  }
}

function loadStats(): SessionStats {
  if (typeof window === "undefined") return { spins: 0, wagered: 0, won: 0, biggestWin: 0 };
  try {
    const raw = sessionStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { spins: 0, wagered: 0, won: 0, biggestWin: 0 };
  } catch {
    return { spins: 0, wagered: 0, won: 0, biggestWin: 0 };
  }
}

function saveStats(stats: SessionStats) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
}

export const useSlotStore = create<SlotState>((set, get) => ({
  balance: INITIAL_BALANCE,
  lines: 5,
  creditsPerLine: 1,
  spinning: false,
  grid: null,
  lastResult: null,
  stats: { spins: 0, wagered: 0, won: 0, biggestWin: 0 },

  setLines: (lines) => set({ lines }),
  setCreditsPerLine: (creditsPerLine) => set({ creditsPerLine }),
  setSpinning: (v) => set({ spinning: v }),

  executeSpin: () => {
    const { balance, lines, creditsPerLine, spinning } = get();
    const totalBet = lines * creditsPerLine;
    if (spinning || balance < totalBet) return null;

    const grid = drawGrid(cryptoRng());
    const result = evaluate({ grid, lines, creditsPerLine });
    const newBalance = balance - totalBet + result.totalPayout;
    const stats = get().stats;
    const newStats: SessionStats = {
      spins: stats.spins + 1,
      wagered: stats.wagered + totalBet,
      won: stats.won + result.totalPayout,
      biggestWin: Math.max(stats.biggestWin, result.totalPayout),
    };

    saveBalance(newBalance);
    saveStats(newStats);

    set({ balance: newBalance, grid, lastResult: result, spinning: true, stats: newStats });
    return { grid, result };
  },

  addWinToStats: (payout) => {
    const stats = get().stats;
    const newStats = { ...stats, biggestWin: Math.max(stats.biggestWin, payout) };
    saveStats(newStats);
    set({ stats: newStats });
  },

  addCredits: (amount = 10) => {
    const newBalance = get().balance + amount;
    saveBalance(newBalance);
    set({ balance: newBalance });
  },
}));

export function initStore() {
  useSlotStore.setState({
    balance: loadBalance(),
    stats: loadStats(),
  });
}
