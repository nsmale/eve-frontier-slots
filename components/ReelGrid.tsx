"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { SymbolId } from "@/lib/engine/symbols";
import { SYMBOL_IDS, SYMBOL_ART } from "@/lib/engine/symbols";
import { PAYLINES } from "@/lib/engine/paylines";
import type { LineWin } from "@/lib/engine/evaluate";
import type { Grid } from "@/lib/engine/spin";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CELL = 72;
const GAP = 6;
const DRUM_W = 94;
const DRUM_H = CELL * 3 + GAP * 2;

const REEL_STOP_DELAYS = [0, 200, 400, 600, 800];

// Barrel curvature for settled symbols only
const ROW_ROTATIONS = [28, 0, -28];
const ROW_SCALE_X = [0.80, 1, 0.80];
const ROW_OPACITY = [0.5, 1, 0.5];

const PAYLINE_COLORS = ["#E53535", "#B5E3D8", "#FB977C", "#a78bfa", "#fbbf24"];

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
  winAmount: number;
  onSpinComplete: () => void;
}

/* ─── ReelGrid ──────────────────────────────────────────────────────────── */
export default function ReelGrid({ finalGrid, spinning, activeLines, lineWins, winAmount, onSpinComplete }: Props) {
  const [displayGrid, setDisplayGrid] = useState<Grid>(() =>
    Array.from({ length: 5 }, () => ["S1", "S2", "S3"] as SymbolId[])
  );
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);

  const timersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null, null, null]);
  const completedRef = useRef(0);

  useEffect(() => {
    if (!spinning || !finalGrid) return;

    completedRef.current = 0;
    startTransition(() => {
      setSpinningReels([true, true, true, true, true]);
    });

    const timers = timersRef.current;

    for (let ri = 0; ri < 5; ri++) {
      const idx = ri;
      timers[idx] = setTimeout(() => {
        setDisplayGrid((prev) =>
          prev.map((r, i) => (i === idx ? ([...finalGrid[idx]] as SymbolId[]) : r))
        );
        setSpinningReels((p) => { const n = [...p]; n[idx] = false; return n; });
        completedRef.current += 1;
        if (completedRef.current === 5) onSpinComplete();
      }, 1500 + REEL_STOP_DELAYS[idx]);
    }

    return () => {
      for (let i = 0; i < 5; i++) {
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

  const REEL_GAP = 10;
  const overlayW = 5 * DRUM_W + 4 * REEL_GAP;
  const cx = (ri: number) => ri * (DRUM_W + REEL_GAP) + DRUM_W / 2;
  const cy = (row: number) => row * (CELL + GAP) + CELL / 2;

  return (
    <div>
      {/* Win banner above reels */}
      <div style={{ minHeight: 52, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {winAmount > 0 && !spinning && (
          <motion.div
            key={winAmount}
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "10px 28px",
              border: "1px solid var(--red-dim)",
              background: "rgba(229,53,53,0.07)",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--red-dim)",
            }}>
              Win
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "var(--red)",
              textShadow: "0 0 20px rgba(229,53,53,0.5)",
            }}>
              {winAmount.toLocaleString()}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--red-dim)", letterSpacing: "0.15em" }}>
              CR
            </span>
          </motion.div>
        )}
      </div>

      {/* Outer frame */}
      <div
        style={{
          padding: "20px 24px",
          background: "rgba(5,5,5,0.9)",
          border: `1px solid ${hasWin ? "rgba(229,53,53,0.3)" : "rgba(24,124,155,0.2)"}`,
          transition: "border-color 0.4s",
          position: "relative",
        }}
      >
        {/* Top label bar */}
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span className="hud-label">Reel Matrix</span>
          <span className="hud-label" style={{ color: hasWin ? "var(--red)" : "rgba(181,227,216,0.3)" }}>
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
                  strokeOpacity={isWin ? 0.9 : 0.15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={isWin ? "none" : "4 4"}
                />
              );
            })}
          </svg>
        </div>

        {/* Reel number labels */}
        <div className="flex" style={{ gap: REEL_GAP, marginTop: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="hud-label" style={{ width: DRUM_W, textAlign: "center", color: "rgba(181,227,216,0.3)", fontSize: 9 }}>
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
  winRows: boolean[];
  hasWin: boolean;
}

function ReelDrum({ symbols, isSpinning, winRows, hasWin }: DrumProps) {
  // Generate 16 random symbols (8 unique + 8 duplicate) for seamless scroll loop
  const tape = useMemo(() => {
    if (!isSpinning) return [] as SymbolId[];
    const half = Array.from({ length: 8 }, randomSym);
    return [...half, ...half] as SymbolId[];
  }, [isSpinning]);

  return (
    <div style={{ position: "relative", width: DRUM_W, height: DRUM_H, flexShrink: 0 }}>
      {/* Win pulse ring */}
      {hasWin && !isSpinning && (
        <div
          className="win-glow"
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: "1.5px solid var(--red-dim)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Oval outer bezel */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        border: isSpinning
          ? "1.5px solid rgba(24,124,155,0.7)"
          : hasWin
          ? "1.5px solid rgba(229,53,53,0.5)"
          : "1px solid rgba(24,124,155,0.15)",
        boxShadow: isSpinning
          ? "0 0 16px rgba(24,124,155,0.35)"
          : hasWin
          ? "0 0 18px rgba(229,53,53,0.25)"
          : "none",
        transition: "all 0.3s",
        zIndex: 3,
        pointerEvents: "none",
      }} />

      {/* Oval clip viewport */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#060606",
      }}>
        {isSpinning ? (
          /* Scrolling drum tape — perpendicular to screen, front-on */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: GAP,
              filter: "blur(0.8px)",
              animation: "drumRoll 0.55s linear infinite",
              willChange: "transform",
              paddingLeft: (DRUM_W - CELL) / 2,
              paddingRight: (DRUM_W - CELL) / 2,
            }}
          >
            {tape.map((sym, i) => (
              <div key={i} style={{ width: CELL, height: CELL, flexShrink: 0 }}>
                <Image src={SYMBOL_ART[sym]} alt={sym} width={CELL} height={CELL} draggable={false} />
              </div>
            ))}
          </div>
        ) : (
          /* Settled symbols with barrel perspective */
          <div style={{
            perspective: "380px",
            perspectiveOrigin: "50% 50%",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: GAP,
          }}>
            {symbols.map((sym, rowIdx) => {
              const isWin = winRows[rowIdx];
              return (
                <motion.div
                  key={`${rowIdx}-${sym}`}
                  initial={{ y: -8, opacity: 0.3 }}
                  animate={{ y: 0, opacity: ROW_OPACITY[rowIdx] }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  style={{
                    width: CELL,
                    height: CELL,
                    transform: `rotateX(${ROW_ROTATIONS[rowIdx]}deg) scaleX(${ROW_SCALE_X[rowIdx]})`,
                    transformOrigin: "center center",
                    flexShrink: 0,
                    outline: isWin ? "2px solid var(--red)" : "none",
                    boxShadow: isWin ? "0 0 16px rgba(229,53,53,0.65)" : "none",
                    transition: "outline 0.25s, box-shadow 0.25s",
                  }}
                >
                  <Image
                    src={SYMBOL_ART[sym]}
                    alt={sym}
                    width={CELL}
                    height={CELL}
                    draggable={false}
                    style={{
                      filter: hasWin && !isWin
                        ? "saturate(0.15) brightness(0.35)"
                        : "none",
                      transition: "filter 0.3s",
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Top/bottom gradient fades */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "32%",
          background: "linear-gradient(to bottom, #060606 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
          background: "linear-gradient(to top, #060606 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Center hairline */}
        <div style={{
          position: "absolute", top: "50%", left: "8%", right: "8%",
          height: 1, marginTop: -0.5,
          background: hasWin ? "rgba(229,53,53,0.35)" : "rgba(24,124,155,0.2)",
          transition: "background 0.4s",
          pointerEvents: "none", zIndex: 4,
        }} />
      </div>
    </div>
  );
}
