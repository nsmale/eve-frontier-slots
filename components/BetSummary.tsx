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
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Total bet</span>
        <span className="font-mono font-bold text-blue-300 text-lg">{totalBet}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Balance</span>
        <span
          className={[
            "font-mono font-bold text-lg transition-colors",
            balance < totalBet ? "text-red-400" : "text-slate-100",
          ].join(" ")}
        >
          {balance}
        </span>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onSpin}
        disabled={!canSpin}
        className={[
          "ml-auto px-8 py-3 rounded-lg font-bold font-mono text-lg tracking-widest uppercase transition-all border-2",
          canSpin
            ? "bg-blue-600 border-blue-400 text-white cursor-pointer shadow-[0_0_16px_rgba(59,130,246,0.5)] hover:bg-blue-500 hover:shadow-[0_0_24px_rgba(59,130,246,0.7)]"
            : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed",
        ].join(" ")}
      >
        {spinning ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Spinning
          </span>
        ) : (
          "Spin"
        )}
      </motion.button>
    </div>
  );
}
