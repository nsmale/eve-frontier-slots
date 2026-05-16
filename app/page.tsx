"use client";

import { useCallback, useEffect } from "react";
import PlayerHUD from "@/components/PlayerHUD";
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

  useEffect(() => { initStore(); }, []);

  const handleSpin = useCallback(() => { executeSpin(); }, [executeSpin]);
  const handleSpinComplete = useCallback(() => { setSpinning(false); }, [setSpinning]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px 32px",
      }}
    >
      {/* ── Player HUD ─────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 610 }}>
        <PlayerHUD />
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 610,
          display: "flex",
          flexDirection: "column",
          marginTop: 20,
          gap: 0,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <p
            className="heading-caps"
            style={{ fontSize: 10, color: "rgba(24,124,155,0.45)", letterSpacing: "0.3em" }}
          >
            — Reel Matrix —
          </p>
        </div>

        {/* ── Reel Grid ─────────────────────────────────────────────── */}
        <ReelGrid
          finalGrid={grid}
          spinning={spinning}
          activeLines={lines}
          lineWins={lastResult && !spinning ? lastResult.lineWins : []}
          winAmount={lastResult && !spinning ? lastResult.totalPayout : 0}
          onSpinComplete={handleSpinComplete}
        />

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div
          className="hud-panel"
          style={{
            marginTop: 24,
            padding: "28px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div className="flex flex-wrap items-center gap-8">
            <LineSelector />
            <CreditSelector />
          </div>

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          <BetSummary onSpin={handleSpin} />

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          <div className="flex items-center justify-between flex-wrap gap-4">
            <WinDisplay
              result={lastResult}
              creditsPerLine={creditsPerLine}
              spinning={spinning}
            />
            <Paytable />
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 20 }}>
          <GlobalStats />
        </div>

        <p
          style={{
            marginTop: 40,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(181,227,216,0.12)",
            textTransform: "uppercase",
          }}
        >
          Stage 1 · Session only · Balance resets on new session
        </p>
      </div>
    </main>
  );
}
