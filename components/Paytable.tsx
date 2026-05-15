"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const LINE_PAYS = [
  { symbols: ["S1", "S2", "S3", "S4"], label: "Spaceships (any)", tier: "Low", pays: [[3, 5], [4, 25], [5, 100]] },
  { symbols: ["M1", "M2", "M3"], label: "Tribe logos (any)", tier: "Mid", pays: [[3, 15], [4, 75], [5, 300]] },
  { symbols: ["H1"], label: "Star (rare)", tier: "High", pays: [[3, 50], [4, 250], [5, 1000]] },
  { symbols: ["W"], label: "Wild (substitutes all except Scatter)", tier: "Wild", pays: [[5, 2500]] },
] as const;

const SCATTER_PAYS = [
  { count: 2, payout: "2× total bet" },
  { count: 3, payout: "5× total bet" },
  { count: 4, payout: "20× total bet" },
  { count: 5, payout: "50× total bet" },
];

export default function Paytable() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-mono text-slate-400 hover:text-slate-200 transition-colors border border-[#1e2d4a] px-3 py-1.5 rounded hover:border-slate-500"
      >
        <span>{open ? "▲" : "▼"}</span> Paytable
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-lg border border-[#1e2d4a] bg-[#080d18] text-sm">
              <h3 className="font-mono font-bold text-slate-200 mb-3 uppercase tracking-wider text-xs">
                Line Pays (× credits per line)
              </h3>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left pb-2">Symbol</th>
                    <th className="pb-2">3×</th>
                    <th className="pb-2">4×</th>
                    <th className="pb-2">5×</th>
                  </tr>
                </thead>
                <tbody>
                  {LINE_PAYS.map((row) => (
                    <tr key={row.tier} className="border-t border-[#1e2d4a]">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {row.symbols.map((s) => (
                            <Image
                              key={s}
                              src={`/symbols/${s}.svg`}
                              alt={s}
                              width={24}
                              height={24}
                            />
                          ))}
                          <span className="text-slate-300">{row.label}</span>
                        </div>
                      </td>
                      {([3, 4, 5] as const).map((n) => {
                        const entry = (row.pays as readonly (readonly [number, number])[]).find(
                          ([k]) => k === n
                        );
                        return (
                          <td key={n} className="text-center py-2 text-slate-300">
                            {entry ? entry[1] : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="font-mono font-bold text-slate-200 mt-4 mb-3 uppercase tracking-wider text-xs">
                Scatter Pays (× total bet, any position)
              </h3>
              <div className="flex gap-3 flex-wrap">
                {SCATTER_PAYS.map(({ count, payout }) => (
                  <div
                    key={count}
                    className="flex items-center gap-2 border border-red-900/40 bg-red-950/20 rounded px-3 py-1.5"
                  >
                    <div className="flex gap-0.5">
                      {Array.from({ length: count }).map((_, i) => (
                        <Image
                          key={i}
                          src="/symbols/SC.svg"
                          alt="scatter"
                          width={20}
                          height={20}
                        />
                      ))}
                    </div>
                    <span className="text-red-300">{payout}</span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-slate-500 text-xs">
                Wild substitutes for all symbols except Scatter. Wins paid left-to-right from reel 1.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
