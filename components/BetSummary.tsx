"use client";

import { motion } from "framer-motion";
import { useSlotStore } from "@/lib/store";

interface Props {
  onSpin: () => void;
}

export default function BetSummary({ onSpin }: Props) {
  const balance = useSlotStore((s) => s.balance);
  const lines = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);
  const totalBet = lines * creditsPerLine;
  const canSpin = balance >= totalBet && !spinning;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Bet readout */}
      <div className="flex items-center gap-6">
        <div>
          <p className="hud-label" style={{ marginBottom: 2 }}>Bet</p>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--teal)",
            letterSpacing: "0.05em",
          }}>
            {totalBet}<span className="hud-label" style={{ marginLeft: 5, fontSize: 9 }}>CR</span>
          </p>
        </div>
        <div style={{ borderLeft: "1px solid rgba(24,124,155,0.2)", paddingLeft: 16 }}>
          <p className="hud-label" style={{ marginBottom: 2 }}>Lines × Cr</p>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "rgba(181,227,216,0.5)",
          }}>
            {lines} × {creditsPerLine}
          </p>
        </div>
      </div>

      {/* Spin button */}
      <motion.button
        whileTap={{ scale: canSpin ? 0.97 : 1 }}
        onClick={onSpin}
        disabled={!canSpin}
        className="btn-primary"
        style={{
          minWidth: 160,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {spinning ? (
          <span className="flex items-center justify-center gap-3">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #0A0A0A", borderTopColor: "transparent", borderRadius: "50%" }}
            />
            Spinning
          </span>
        ) : (
          "Spin"
        )}
      </motion.button>
    </div>
  );
}
