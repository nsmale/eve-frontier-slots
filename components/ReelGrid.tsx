"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { SymbolId } from "@/lib/engine/symbols";
import { SYMBOL_IDS } from "@/lib/engine/symbols";
import { PAYLINES } from "@/lib/engine/paylines";
import type { LineWin } from "@/lib/engine/evaluate";
import type { Grid } from "@/lib/engine/spin";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CELL = 80;
const GAP = 6;
const DRUM_W = 112;
const DRUM_H = CELL * 3 + GAP * 2;

const REEL_STOP_DELAYS = [0, 200, 400, 600, 800];
const CYCLE_MS = 75;

// Barrel: top/bottom rows curve away from viewer
const ROW_ROTATIONS = [28, 0, -28];
const ROW_SCALE_X = [0.80, 1, 0.80];
const ROW_OPACITY = [0.5, 1, 0.5];

const PAYLINE_COLORS = ["#187C9B", "#B5E3D8", "#FB977C", "#a78bfa", "#fbbf24"];

const ALL_SYMS = SYMBOL_IDS.filter((s) => s !== "SC" && s !== "W");
function randomSym(): SymbolId {
  return ALL_SYMS[Math.floor(Math.random() * ALL_SYMS.length)];
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Props {
  finalGrid: Grid | null;
  spinning: boolean;
  activeLines: number;
  lineWins: LineWin[];
  onSpinComplete: () => void;
}

/* ─── ReelGrid ──────────────────────────────────────────────────────────── */
export default function ReelGrid({ finalGrid, spinning, activeLines, lineWins, onSpinComplete }: Props) {
  const [displayGrid, setDisplayGrid] = useState<Grid>(() =>
    Array.from({ length: 5 }, () => ["S1", "S2", "S3"] as SymbolId[])
  );
  const [settledReels, setSettledReels] = useState<boolean[]>([true, true, true, true, true]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);

  const intervalsRef = useRef<(ReturnType<typeof setInterval> | null)[]>([null, null, null, null, null]);
  const timersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null, null, null]);
  const completedRef = useRef(0);

  useEffect(() => {
    if (!spinning || !finalGrid) return;

    completedRef.current = 0;
    startTransition(() => {
      setSettledReels([false, false, false, false, false]);
      setSpinningReels([true, true, true, true, true]);
    });

    const cyclingGrids: Grid = Array.from({ length: 5 }, (_, i) => [...displayGrid[i]] as SymbolId[]);
    const intervals = intervalsRef.current;
    const timers = timersRef.current;

    for (let ri = 0; ri < 5; ri++) {
      intervals[ri] = setInterval(() => {
        cyclingGrids[ri] = [randomSym(), randomSym(), randomSym()];
        setDisplayGrid(cyclingGrids.map((r) => [...r] as SymbolId[]));
      }, CYCLE_MS);
    }

    for (let ri = 0; ri < 5; ri++) {
      const idx = ri;
      timers[idx] = setTimeout(() => {
        if (intervals[idx]) { clearInterval(intervals[idx]!); intervals[idx] = null; }
        cyclingGrids[idx] = [...finalGrid[idx]] as SymbolId[];
        setDisplayGrid(cyclingGrids.map((r) => [...r] as SymbolId[]));
        setSettledReels((p) => { const n = [...p]; n[idx] = true; return n; });
        setSpinningReels((p) => { const n = [...p]; n[idx] = false; return n; });
        completedRef.current += 1;
        if (completedRef.current === 5) onSpinComplete();
      }, 1500 + REEL_STOP_DELAYS[idx]);
    }

    return () => {
      for (let i = 0; i < 5; i++) {
        if (intervals[i]) { clearInterval(intervals[i]!); intervals[i] = null; }
        if (timers[i]) { clearTimeout(timers[i]!); timers[i] = null; }
      }
    };
  }, [spinning, finalGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  const winSet = new Set<string>();
  for (const win of lineWins) {
    const pl = PAYLINES[win.lineIndex];
    for (let r = 0; r < win.matchCount; r++) winSet.add(`${r}-${pl[r]}`);
  }
  const hasWin = lineWins.length > 0 && !spinning;

  const REEL_GAP = 16;
  const overlayW = 5 * DRUM_W + 4 * REEL_GAP;
  const cx = (ri: number) => ri * (DRUM_W + REEL_GAP) + DRUM_W / 2;
  const cy = (row: number) => row * (CELL + GAP) + CELL / 2;

  return (
    <div>
      {/* Outer frame */}
      <div
        style={{
          padding: "20px 24px",
          background: "rgba(5,5,5,0.9)",
          border: "1px solid rgba(24,124,155,0.2)",
          position: "relative",
        }}
      >
        {/* Top label bar */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 16 }}
        >
          <span className="hud-label">Reel Matrix</span>
          <span className="hud-label" style={{ color: hasWin ? "var(--teal)" : "rgba(181,227,216,0.3)" }}>
            {hasWin ? "WIN DETECTED" : "STANDBY"}
          </span>
        </div>

        {/* Drum row */}
        <div style={{ position: "relative" }}>
          <div className="flex" style={{ gap: REEL_GAP }}>
            {displayGrid.map((reel, ri) => (
              <ReelDrum
                key={ri}
                symbols={reel}
                isSpinning={spinningReels[ri]}
                isSettled={settledReels[ri]}
                winRows={Array.from({ length: 3 }, (_, row) => winSet.has(`${ri}-${row}`) && !spinning)}
                hasWin={hasWin}
              />
            ))}
          </div>

          {/* Payline SVG */}
          <svg
            style={{
              position: "absolute", top: 0, left: 0,
              width: overlayW, height: DRUM_H,
              pointerEvents: "none",
            }}
            viewBox={`0 0 ${overlayW} ${DRUM_H}`}
          >
            {PAYLINES.map((pl, idx) => {
              if (idx >= activeLines) return null;
              const isWin = lineWins.some((w) => w.lineIndex === idx) && !spinning;
              const pts = pl.map((row, ri) => `${cx(ri)},${cy(row)}`).join(" ");
              return (
                <polyline
                  key={idx}
                  points={pts}
                  fill="none"
                  stroke={PAYLINE_COLORS[idx]}
                  strokeWidth={isWin ? 2.5 : 1}
                  strokeOpacity={isWin ? 0.85 : 0.15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={isWin ? "none" : "4 4"}
                />
              );
            })}
          </svg>
        </div>

        {/* Bottom label row — reel numbers */}
        <div className="flex" style={{ gap: REEL_GAP, marginTop: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="hud-label"
              style={{
                width: DRUM_W,
                textAlign: "center",
                color: "rgba(181,227,216,0.3)",
                fontSize: 9,
              }}
            >
              R{n}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ReelDrum ──────────────────────────────────────────────────────────── */
interface DrumProps {
  symbols: SymbolId[];
  isSpinning: boolean;
  isSettled: boolean;
  winRows: boolean[];
  hasWin: boolean;
}

function ReelDrum({ symbols, isSpinning, isSettled, winRows, hasWin }: DrumProps) {
  return (
    <div style={{ position: "relative", width: DRUM_W, height: DRUM_H, flexShrink: 0 }}>
      {/* Spinning indicator ring */}
      {isSpinning && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            inset: -5,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "var(--teal)",
            borderRightColor: "rgba(24,124,155,0.25)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Oval outer bezel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: isSpinning
            ? "1.5px solid rgba(24,124,155,0.7)"
            : hasWin
            ? "1.5px solid rgba(24,124,155,0.4)"
            : "1px solid rgba(24,124,155,0.15)",
          boxShadow: isSpinning ? "0 0 16px rgba(24,124,155,0.35)" : "none",
          transition: "all 0.3s",
          zIndex: 3,
          pointerEvents: "none",
        }}
      />

      {/* Oval clip viewport */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#060606",
        }}
      >
        {/* Barrel perspective */}
        <div
          style={{
            perspective: "380px",
            perspectiveOrigin: "50% 50%",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: GAP,
            filter: isSpinning ? "blur(0.7px)" : "none",
            transition: "filter 0.12s",
          }}
        >
          {symbols.map((sym, rowIdx) => {
            const isWin = winRows[rowIdx];
            return (
              <motion.div
                key={`${rowIdx}-${isSpinning ? "s" : sym}`}
                initial={isSettled ? false : { y: -8, opacity: 0.3 }}
                animate={{ y: 0, opacity: ROW_OPACITY[rowIdx] }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
                style={{
                  width: CELL,
                  height: CELL,
                  transform: `rotateX(${ROW_ROTATIONS[rowIdx]}deg) scaleX(${ROW_SCALE_X[rowIdx]})`,
                  transformOrigin: "center center",
                  flexShrink: 0,
                  outline: isWin ? "2px solid var(--teal)" : "none",
                  boxShadow: isWin ? "0 0 14px rgba(24,124,155,0.6)" : "none",
                  transition: "outline 0.25s, box-shadow 0.25s",
                }}
              >
                <Image
                  src={`/symbols/${sym}.svg`}
                  alt={sym}
                  width={CELL}
                  height={CELL}
                  draggable={false}
                  priority={false}
                  style={{
                    filter: hasWin && !isWin && !isSpinning
                      ? "saturate(0.15) brightness(0.35)"
                      : "none",
                    transition: "filter 0.3s",
                  }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Top/bottom gradient fades — simulate drum curvature */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "30%",
          background: "linear-gradient(to bottom, #060606 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "30%",
          background: "linear-gradient(to top, #060606 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Center win-line hairline */}
        <div style={{
          position: "absolute", top: "50%", left: "8%", right: "8%",
          height: 1, marginTop: -0.5,
          background: "rgba(24,124,155,0.2)",
          pointerEvents: "none", zIndex: 2,
        }} />
      </div>
    </div>
  );
}
