"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { SymbolId } from "@/lib/engine/symbols";
import { SYMBOL_IDS, SYMBOL_ART } from "@/lib/engine/symbols";
import { PAYLINES } from "@/lib/engine/paylines";
import type { LineWin } from "@/lib/engine/evaluate";
import type { Grid } from "@/lib/engine/spin";
import type { LineAnchor } from "@/lib/engine/paytable";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CELL     = 106;
const GAP      = 4;
const DRUM_W   = 106;
const DRUM_H   = CELL * 3 + GAP * 2;
const REEL_GAP = 8;

const REEL_STOP_DELAYS = [0, 200, 400, 600, 800];

const ROW_OPACITY = [0.55, 1, 0.55];

const PAYLINE_COLORS = ["#E53535", "#B5E3D8", "#FB977C", "#a78bfa", "#fbbf24"];

const ALL_SYMS = SYMBOL_IDS.filter((s) => s !== "SC" && s !== "W");
function randomSym(): SymbolId {
  return ALL_SYMS[Math.floor(Math.random() * ALL_SYMS.length)];
}

/** Build the startup grid so every symbol appears at least once across 5×3 = 15 cells. */
function makeInitialGrid(): Grid {
  const all = [...SYMBOL_IDS] as SymbolId[];           // 10 symbols
  const extra = Array.from({ length: 5 }, randomSym);  // 5 more random
  const cells = [...all, ...extra] as SymbolId[];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return Array.from({ length: 5 }, (_, ri) => cells.slice(ri * 3, ri * 3 + 3) as SymbolId[]);
}

/* ─── Video mapping ─────────────────────────────────────────────────────── */
const CHARACTER_ANCHORS: LineAnchor[] = ["M1", "M2", "M3"];
const SHIP_ANCHORS:      LineAnchor[] = ["S1", "S2", "S3"];
const TRIBE_ANCHORS:     LineAnchor[] = ["H1", "W"];

function pickStingVideo(lineWins: LineWin[]): "human" | "ship" | "war" | null {
  for (const w of lineWins) {
    if (w.matchCount < 5) continue;
    if ((CHARACTER_ANCHORS as string[]).includes(w.anchor)) return "human";
    if ((SHIP_ANCHORS as string[]).includes(w.anchor))      return "ship";
    if ((TRIBE_ANCHORS as string[]).includes(w.anchor))     return "war";
  }
  return null;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Props {
  finalGrid:          Grid | null;
  spinning:           boolean;
  activeLines:        number;
  lineWins:           LineWin[];
  winAmount:          number;
  insufficientBalance?: boolean;
  onSpinComplete:     () => void;
}

/* ─── ReelGrid ──────────────────────────────────────────────────────────── */
export default function ReelGrid({ finalGrid, spinning, activeLines, lineWins, winAmount, insufficientBalance = false, onSpinComplete }: Props) {
  const [displayGrid, setDisplayGrid] = useState<Grid>(makeInitialGrid);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);
  const [stingActive, setStingActive] = useState(false);

  const timersRef    = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null, null, null]);
  const completedRef = useRef(0);

  const humanRef = useRef<HTMLVideoElement>(null);
  const shipRef  = useRef<HTMLVideoElement>(null);
  const warRef   = useRef<HTMLVideoElement>(null);

  /* Reel stop logic */
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

  /* Sting video logic */
  useEffect(() => {
    const refs = [humanRef, shipRef, warRef];

    if (spinning) {
      refs.forEach((r) => {
        if (r.current) { r.current.pause(); r.current.currentTime = 0; }
      });
      setStingActive(false);
      return;
    }

    const sting = pickStingVideo(lineWins);
    if (!sting) return;

    const targetRef = sting === "human" ? humanRef : sting === "ship" ? shipRef : warRef;
    const el = targetRef.current;
    if (!el) return;

    el.currentTime = 0;
    el.play().catch(() => {});
    setStingActive(true);

    const onEnd = () => setStingActive(false);
    el.addEventListener("ended", onEnd, { once: true });
    return () => el.removeEventListener("ended", onEnd);
  }, [spinning, lineWins]);

  const winSet = new Set<string>();
  for (const win of lineWins) {
    const pl = PAYLINES[win.lineIndex];
    for (let r = 0; r < win.matchCount; r++) winSet.add(`${r}-${pl[r]}`);
  }
  const hasWin = lineWins.length > 0 && !spinning;

  const overlayW = 5 * DRUM_W + 4 * REEL_GAP;
  const cx = (ri: number)  => ri * (DRUM_W + REEL_GAP) + DRUM_W / 2;
  const cy = (row: number) => row * (CELL + GAP) + CELL / 2;

  /* ─── Sting video src picker ─────────────────────────────────────────── */
  const stingVideoSrc = stingActive
    ? (pickStingVideo(lineWins) === "human" ? "/artwork/sting-human.mp4"
      : pickStingVideo(lineWins) === "ship"  ? "/artwork/sting-ship-rift.mp4"
      : "/artwork/sting-war.mp4")
    : null;

  return (
    <div>
      {/* Preload all sting videos (hidden) */}
      <video ref={humanRef} src="/artwork/sting-human.mp4"     preload="auto" muted playsInline style={{ display: "none" }} />
      <video ref={shipRef}  src="/artwork/sting-ship-rift.mp4" preload="auto" muted playsInline style={{ display: "none" }} />
      <video ref={warRef}   src="/artwork/sting-war.mp4"       preload="auto" muted playsInline style={{ display: "none" }} />

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
        {/* WIN DETECTED label — only shown when there's a win */}
        {hasWin && (
          <div className="flex items-center justify-end" style={{ marginBottom: 10 }}>
            <span className="hud-label" style={{ color: "var(--red)" }}>
              WIN DETECTED
            </span>
          </div>
        )}

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

            {/* Insufficient balance overlay */}
          <AnimatePresence>
            {insufficientBalance && (
              <motion.div
                key="no-funds"
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -90 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 25,
                  background: "rgba(0,0,0,0.88)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  perspective: "600px",
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: "var(--coral)",
                    textShadow: "0 0 20px rgba(251,151,124,0.5)",
                  }}
                >
                  DEPOSIT FUEL TO PLAY
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sting video overlay */}
          {stingActive && stingVideoSrc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.65)",
              }}
            >
              <video
                autoPlay
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              >
                <source src={stingVideoSrc} type="video/mp4" />
              </video>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ReelDrum ──────────────────────────────────────────────────────────── */
interface DrumProps {
  symbols:   SymbolId[];
  isSpinning: boolean;
  winRows:   boolean[];
  hasWin:    boolean;
}

function ReelDrum({ symbols, isSpinning, winRows, hasWin }: DrumProps) {
  const tape = useMemo(() => {
    if (!isSpinning) return [] as SymbolId[];
    const half = Array.from({ length: 8 }, randomSym);
    return [...half, ...half] as SymbolId[];
  }, [isSpinning]);

  return (
    <div style={{ position: "relative", width: DRUM_W, height: DRUM_H, flexShrink: 0 }}>
      {/* Win glow border */}
      {hasWin && !isSpinning && (
        <div
          className="win-glow"
          style={{
            position: "absolute",
            inset: -2,
            border: "1.5px solid var(--red-dim)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Rectangular bezel */}
      <div style={{
        position: "absolute",
        inset: 0,
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

      {/* Rectangular clip viewport */}
      <div style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#060606",
      }}>
        {isSpinning ? (
          /* Scrolling drum tape */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: GAP,
              filter: "blur(0.8px)",
              animation: "drumRoll 0.55s linear infinite",
              willChange: "transform",
            }}
          >
            {tape.map((sym, i) => (
              <div key={i} style={{ width: CELL, height: CELL, flexShrink: 0 }}>
                <Image src={SYMBOL_ART[sym]} alt={sym} width={CELL} height={CELL} draggable={false} />
              </div>
            ))}
          </div>
        ) : (
          /* Settled symbols */
          <div style={{
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

        {/* Subtle edge fades for spinning effect */}
        {isSpinning && (
          <>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "20%",
              background: "linear-gradient(to bottom, #060606 0%, transparent 100%)",
              pointerEvents: "none", zIndex: 2,
            }} />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "20%",
              background: "linear-gradient(to top, #060606 0%, transparent 100%)",
              pointerEvents: "none", zIndex: 2,
            }} />
          </>
        )}
      </div>
    </div>
  );
}
