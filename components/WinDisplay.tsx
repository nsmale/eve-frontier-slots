"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EvaluateResult } from "@/lib/engine/evaluate";

interface Props {
  result: EvaluateResult | null;
  creditsPerLine: number;
  spinning: boolean;
}

type WinTier = "none" | "win" | "bigWin";

function getTier(result: EvaluateResult | null, cpl: number): WinTier {
  if (!result || result.totalPayout === 0) return "none";
  if (result.totalPayout > 100 * cpl) return "bigWin";
  return "win";
}

export default function WinDisplay({ result, creditsPerLine, spinning }: Props) {
  const tier = spinning ? "none" : getTier(result, creditsPerLine);
  const [displayAmount, setDisplayAmount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!result || spinning || result.totalPayout === 0) {
      const raf = requestAnimationFrame(() => startTransition(() => setDisplayAmount(0)));
      return () => cancelAnimationFrame(raf);
    }
    const target = result.totalPayout;
    const duration = 900;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplayAmount(Math.floor(t * target));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [result, spinning]);

  return (
    <div className="flex items-center gap-4" style={{ minHeight: 48 }}>
      <span className="hud-label" style={{ minWidth: 52 }}>Last Win</span>

      <AnimatePresence mode="wait">
        {tier !== "none" ? (
          <motion.div
            key={`win-${result?.totalPayout}`}
            initial={{ scale: 0.7, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className={tier === "bigWin" ? "big-win-shake" : ""}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: tier === "bigWin" ? 26 : 22,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: tier === "bigWin" ? "var(--coral)" : "var(--teal)",
              padding: "4px 14px",
              border: `1px solid ${tier === "bigWin" ? "rgba(251,151,124,0.4)" : "var(--teal-dim)"}`,
              background: tier === "bigWin" ? "rgba(251,151,124,0.07)" : "rgba(24,124,155,0.07)",
            }}
          >
            {displayAmount}
            <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>CR</span>
            {tier === "bigWin" && (
              <span style={{
                marginLeft: 10,
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--coral)",
                textTransform: "uppercase",
              }}>
                Big Win
              </span>
            )}
          </motion.div>
        ) : (
          <motion.span
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: "rgba(181,227,216,0.2)" }}
          >
            —
          </motion.span>
        )}
      </AnimatePresence>

      {result && result.scatterCount >= 2 && !spinning && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--coral)",
            border: "1px solid rgba(251,151,124,0.35)",
            background: "rgba(251,151,124,0.07)",
            padding: "4px 10px",
          }}
        >
          {result.scatterCount}× Scatter
        </motion.span>
      )}
    </div>
  );
}
