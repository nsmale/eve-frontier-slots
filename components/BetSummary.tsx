"use client";

import { motion } from "framer-motion";
import { useSlotStore } from "@/lib/store";

interface Props {
  onSpin:        () => void;
  chainPending?: boolean;
  chainBalance?: number | null; // undefined = local mode, null = loading, number = loaded
}

export default function BetSummary({ onSpin, chainPending = false, chainBalance }: Props) {
  const localBalance   = useSlotStore((s) => s.balance);
  const lines          = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning       = useSlotStore((s) => s.spinning);
  const totalBet       = lines * creditsPerLine;

  const onChain        = chainBalance !== undefined;
  const effectiveBal   = onChain ? (chainBalance ?? 0) : localBalance;
  const hasBalance     = effectiveBal >= totalBet;
  // Button is only truly disabled while an action is in progress
  const actionBusy     = spinning || chainPending;

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
            {totalBet}<span className="hud-label" style={{ marginLeft: 5, fontSize: 9 }}>
              {onChain ? "FUEL" : "CR"}
            </span>
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

      {/* Spin button — clickable even when balance is low so user gets feedback */}
      <motion.button
        whileTap={{ scale: actionBusy ? 1 : 0.97 }}
        onClick={onSpin}
        disabled={actionBusy}
        className="btn-primary"
        style={{
          minWidth: 160,
          position: "relative",
          overflow: "hidden",
          opacity: !hasBalance && !actionBusy ? 0.5 : 1,
        }}
      >
        {chainPending ? (
          <span className="flex items-center justify-center gap-3">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #0A0A0A", borderTopColor: "transparent", borderRadius: "50%" }}
            />
            Submitting
          </span>
        ) : spinning ? (
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
