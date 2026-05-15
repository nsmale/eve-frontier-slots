"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSlotStore } from "@/lib/store";

export default function PlayerHUD() {
  const balance = useSlotStore((s) => s.balance);
  const lines = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);
  const addCredits = useSlotStore((s) => s.addCredits);
  const totalBet = lines * creditsPerLine;
  const isLow = balance < 50;

  return (
    <div className="hud-panel w-full" style={{ padding: "16px 24px" }}>
      <div className="flex items-center justify-between flex-wrap gap-4">

        {/* Logo / title */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 6,
            height: 32,
            background: "linear-gradient(to bottom, #187C9B, #1C2A39)",
          }} />
          <div>
            <p className="heading-caps" style={{ fontSize: 11, color: "var(--mint)", marginBottom: 2 }}>
              EVE Frontier
            </p>
            <p className="heading-caps" style={{ fontSize: 16, color: "var(--white)" }}>
              Slot Terminal
            </p>
          </div>
        </div>

        {/* Balance cluster */}
        <div className="flex items-center gap-6">
          {/* Player Balance */}
          <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 20 }}>
            <p className="hud-label" style={{ marginBottom: 4 }}>Player Balance</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={balance}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="hud-value"
                style={{ color: isLow ? "var(--coral)" : "var(--white)" }}
              >
                {balance.toLocaleString()}
                <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>CR</span>
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Total Bet */}
          <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 20 }}>
            <p className="hud-label" style={{ marginBottom: 4 }}>Total Bet</p>
            <p className="hud-value" style={{ color: "var(--teal)", fontSize: 18 }}>
              {totalBet}
              <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>CR</span>
            </p>
          </div>

          {/* Add Credits */}
          <button
            className="btn-ghost"
            onClick={() => addCredits(10)}
            disabled={spinning}
            style={{
              borderColor: isLow ? "var(--coral)" : "var(--teal)",
              color: isLow ? "var(--coral)" : "var(--teal)",
              opacity: spinning ? 0.4 : 1,
            }}
          >
            + 10 Credits
          </button>
        </div>

      </div>
    </div>
  );
}
