"use client";

import { useEffect, useCallback } from "react";
import ReelGrid from "@/components/ReelGrid";
import LineSelector from "@/components/LineSelector";
import CreditSelector from "@/components/CreditSelector";
import BetSummary from "@/components/BetSummary";
import WinDisplay from "@/components/WinDisplay";
import Paytable from "@/components/Paytable";
import GlobalStats from "@/components/GlobalStats";
import { useSlotStore, initStore } from "@/lib/store";

export default function Home() {
  const spinning = useSlotStore((s) => s.spinning);
  const setSpinning = useSlotStore((s) => s.setSpinning);
  const executeSpin = useSlotStore((s) => s.executeSpin);
  const grid = useSlotStore((s) => s.grid);
  const lastResult = useSlotStore((s) => s.lastResult);
  const lines = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);

  useEffect(() => {
    initStore();
  }, []);

  const handleSpin = useCallback(() => {
    executeSpin();
  }, [executeSpin]);

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
  }, [setSpinning]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-6">
      {/* Header */}
      <header className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-mono font-bold">
            EVE
          </div>
          <h1 className="font-mono font-bold text-slate-200 tracking-wider text-sm uppercase">
            Frontier Slots
          </h1>
          <span className="text-[10px] font-mono text-slate-600 border border-slate-700 px-1.5 py-0.5 rounded">
            Stage 1
          </span>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Stage 2: LUX on Sui
        </div>
      </header>

      {/* Reel grid */}
      <ReelGrid
        finalGrid={grid}
        spinning={spinning}
        activeLines={lines}
        lineWins={lastResult && !spinning ? lastResult.lineWins : []}
        onSpinComplete={handleSpinComplete}
      />

      {/* Controls panel */}
      <div className="w-full max-w-2xl flex flex-col gap-4 rounded-xl border border-[#1e2d4a] bg-[#111827] p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <LineSelector />
          <CreditSelector />
        </div>

        <BetSummary onSpin={handleSpin} />

        <div className="flex items-center justify-between flex-wrap gap-3 border-t border-[#1e2d4a] pt-3">
          <WinDisplay
            result={lastResult}
            creditsPerLine={creditsPerLine}
            spinning={spinning}
          />
          <Paytable />
        </div>
      </div>

      {/* Stats panel */}
      <div className="w-full max-w-2xl rounded-xl border border-[#1e2d4a] bg-[#111827] px-6 py-3">
        <GlobalStats />
      </div>

      <p className="text-[10px] text-slate-700 font-mono">
        Session only · Balance resets on new session
      </p>
    </main>
  );
}
