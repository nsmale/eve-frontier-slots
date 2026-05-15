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

function getTier(result: EvaluateResult | null, creditsPerLine: number): WinTier {
  if (!result || result.totalPayout === 0) return "none";
  if (result.totalPayout > 100 * creditsPerLine) return "bigWin";
  return "win";
}

export default function WinDisplay({ result, creditsPerLine, spinning }: Props) {
  const tier = spinning ? "none" : getTier(result, creditsPerLine);
  const [displayAmount, setDisplayAmount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (!result || spinning || result.totalPayout === 0) {
      // Defer clear to avoid synchronous setState in effect body
      const raf = requestAnimationFrame(() => {
        startTransition(() => setDisplayAmount(0));
      });
      return () => cancelAnimationFrame(raf);
    }

    const target = result.totalPayout;
    const duration = 800;
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
    <div className="flex items-center gap-3 h-10">
      <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Last win</span>
      <AnimatePresence mode="wait">
        {tier !== "none" ? (
          <motion.div
            key={`win-${result?.totalPayout}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={[
              "font-mono font-bold text-xl px-3 py-1 rounded",
              tier === "bigWin"
                ? "text-yellow-300 big-win-shake bg-yellow-400/10 border border-yellow-400/40"
                : "text-green-400 bg-green-400/10 border border-green-400/30",
            ].join(" ")}
          >
            {displayAmount}
            {tier === "bigWin" && (
              <span className="ml-2 text-xs text-yellow-400 uppercase tracking-wider">
                Big Win!
              </span>
            )}
          </motion.div>
        ) : (
          <motion.span
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-slate-600 font-mono text-xl"
          >
            —
          </motion.span>
        )}
      </AnimatePresence>

      {result && result.scatterCount >= 2 && !spinning && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs font-bold font-mono text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-1 rounded"
        >
          {result.scatterCount}× SCATTER
        </motion.span>
      )}
    </div>
  );
}
