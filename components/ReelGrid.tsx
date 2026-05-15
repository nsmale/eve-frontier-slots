"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SymbolId } from "@/lib/engine/symbols";
import { SYMBOL_IDS } from "@/lib/engine/symbols";
import { PAYLINES } from "@/lib/engine/paylines";
import type { LineWin } from "@/lib/engine/evaluate";
import type { Grid } from "@/lib/engine/spin";
import SymbolCell from "./SymbolCell";

const CELL_SIZE = 72;
const CELL_GAP = 6;

const REEL_STOP_DELAYS = [0, 200, 400, 600, 800]; // ms stagger
const SPIN_SYMBOL_CYCLE_MS = 80;

const ALL_SYMS = SYMBOL_IDS.filter((s) => s !== "SC" && s !== "W");

function randomSym(): SymbolId {
  return ALL_SYMS[Math.floor(Math.random() * ALL_SYMS.length)];
}

interface Props {
  finalGrid: Grid | null;
  spinning: boolean;
  activeLines: number;
  lineWins: LineWin[];
  onSpinComplete: () => void;
}

export default function ReelGrid({
  finalGrid,
  spinning,
  activeLines,
  lineWins,
  onSpinComplete,
}: Props) {
  const [displayGrid, setDisplayGrid] = useState<Grid>(() =>
    Array.from({ length: 5 }, () => ["S1", "S2", "S3"] as SymbolId[])
  );
  const [settledReels, setSettledReels] = useState<boolean[]>([
    true, true, true, true, true,
  ]);

  const intervalsRef = useRef<(ReturnType<typeof setInterval> | null)[]>([null, null, null, null, null]);
  const timersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null, null, null]);
  const completedRef = useRef(0);

  useEffect(() => {
    if (!spinning || !finalGrid) return;

    completedRef.current = 0;

    // Use startTransition so this setState doesn't count as a sync render cascade
    startTransition(() => {
      setSettledReels([false, false, false, false, false]);
    });

    const cyclingGrids: Grid = Array.from({ length: 5 }, (_, i) => [...displayGrid[i]] as SymbolId[]);
    const intervals = intervalsRef.current;
    const timers = timersRef.current;

    for (let reelIdx = 0; reelIdx < 5; reelIdx++) {
      intervals[reelIdx] = setInterval(() => {
        cyclingGrids[reelIdx] = [randomSym(), randomSym(), randomSym()];
        setDisplayGrid(cyclingGrids.map((r) => [...r] as SymbolId[]));
      }, SPIN_SYMBOL_CYCLE_MS);
    }

    const totalDuration = 1500;
    for (let reelIdx = 0; reelIdx < 5; reelIdx++) {
      const stopAt = totalDuration + REEL_STOP_DELAYS[reelIdx];
      const idx = reelIdx;
      timers[idx] = setTimeout(() => {
        if (intervals[idx]) {
          clearInterval(intervals[idx]!);
          intervals[idx] = null;
        }

        cyclingGrids[idx] = [...finalGrid[idx]] as SymbolId[];
        setDisplayGrid(cyclingGrids.map((r) => [...r] as SymbolId[]));

        setSettledReels((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });

        completedRef.current += 1;
        if (completedRef.current === 5) {
          onSpinComplete();
        }
      }, stopAt);
    }

    return () => {
      for (let i = 0; i < 5; i++) {
        if (intervals[i]) { clearInterval(intervals[i]!); intervals[i] = null; }
        if (timers[i]) { clearTimeout(timers[i]!); timers[i] = null; }
      }
    };
  }, [spinning, finalGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  const winningPositions = new Set<string>();
  for (const win of lineWins) {
    const payline = PAYLINES[win.lineIndex];
    for (let reel = 0; reel < win.matchCount; reel++) {
      winningPositions.add(`${reel}-${payline[reel]}`);
    }
  }
  const hasWin = lineWins.length > 0;

  return (
    <div className="relative">
      <div
        className={[
          "relative rounded-xl border-2 p-3 bg-[#080d18] transition-all duration-500",
          hasWin && !spinning
            ? "border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.3)]"
            : "border-[#1e2d4a]",
        ].join(" ")}
      >
        <div className="flex gap-[6px]">
          {displayGrid.map((reel, reelIdx) => (
            <div key={reelIdx} className="flex flex-col gap-[6px]">
              {reel.map((sym, rowIdx) => {
                const key = `${reelIdx}-${rowIdx}`;
                const isWinning = winningPositions.has(key) && !spinning;
                const isDimmed = hasWin && !spinning && !isWinning;
                return (
                  <motion.div
                    key={`${reelIdx}-${rowIdx}-${spinning ? "spin" : sym}`}
                    initial={settledReels[reelIdx] ? false : { y: -10, opacity: 0.5 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <SymbolCell
                      symbolId={sym}
                      size={CELL_SIZE}
                      isWinning={isWinning}
                      dimmed={isDimmed}
                    />
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>

        <PaylineOverlay
          activeLines={activeLines}
          winningLines={lineWins.map((w) => w.lineIndex)}
          spinning={spinning}
        />
      </div>
    </div>
  );
}

const PAYLINE_COLORS = ["#60a5fa", "#34d399", "#f97316", "#a78bfa", "#f472b6"];

interface OverlayProps {
  activeLines: number;
  winningLines: number[];
  spinning: boolean;
}

function PaylineOverlay({ activeLines, winningLines, spinning }: OverlayProps) {
  const w = 5 * CELL_SIZE + 4 * CELL_GAP;
  const h = 3 * CELL_SIZE + 2 * CELL_GAP;
  const cx = (reel: number) => reel * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
  const cy = (row: number) => row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

  return (
    <svg
      className="absolute inset-3 pointer-events-none"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
    >
      {PAYLINES.map((pl, idx) => {
        if (idx >= activeLines) return null;
        const isWinning = winningLines.includes(idx) && !spinning;
        const color = PAYLINE_COLORS[idx];
        const pts = pl.map((row, reel) => `${cx(reel)},${cy(row)}`).join(" ");
        return (
          <polyline
            key={idx}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth={isWinning ? 3 : 1}
            strokeOpacity={isWinning ? 0.9 : 0.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
