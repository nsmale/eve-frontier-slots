"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const LINE_PAYS = [
  { symbols: ["S1", "S2", "S3", "S4"], label: "Spaceships (any)", tier: "Low", pays: [[3, 5], [4, 25], [5, 100]] },
  { symbols: ["M1", "M2", "M3"], label: "Tribe logos (any)", tier: "Mid", pays: [[3, 15], [4, 75], [5, 300]] },
  { symbols: ["H1"], label: "Star (rare)", tier: "High", pays: [[3, 50], [4, 250], [5, 1000]] },
  { symbols: ["W"], label: "Wild (5×)", tier: "Wild", pays: [[5, 2500]] },
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
        className="btn-ghost"
        style={{ fontSize: 11 }}
      >
        {open ? "▲" : "▼"} Paytable
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="hud-panel"
              style={{ marginTop: 12, padding: "20px 24px" }}
            >
              <p className="heading-caps" style={{ fontSize: 11, color: "var(--mint)", marginBottom: 16 }}>
                Line Pays <span style={{ opacity: 0.5 }}>× credits per line</span>
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 8 }} className="hud-label">Symbol</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 8 }}>3×</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 8 }}>4×</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 8 }}>5×</th>
                  </tr>
                </thead>
                <tbody>
                  {LINE_PAYS.map((row) => (
                    <tr key={row.tier} style={{ borderTop: "1px solid rgba(24,124,155,0.15)" }}>
                      <td style={{ padding: "10px 0" }}>
                        <div className="flex items-center gap-2">
                          {row.symbols.map((s) => (
                            <Image key={s} src={`/symbols/${s}.svg`} alt={s} width={22} height={22} />
                          ))}
                          <span style={{ fontSize: 13, color: "var(--mint)", fontFamily: "var(--font-mono)" }}>
                            {row.label}
                          </span>
                        </div>
                      </td>
                      {([3, 4, 5] as const).map((n) => {
                        const entry = (row.pays as readonly (readonly [number, number])[]).find(([k]) => k === n);
                        return (
                          <td key={n} style={{ textAlign: "center", padding: "10px 0" }}>
                            <span style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 13,
                              color: entry ? "var(--white)" : "rgba(181,227,216,0.2)",
                            }}>
                              {entry ? entry[1] : "—"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="heading-caps" style={{ fontSize: 11, color: "var(--mint)", marginTop: 20, marginBottom: 12 }}>
                Scatter Pays <span style={{ opacity: 0.5 }}>× total bet · any position</span>
              </p>
              <div className="flex gap-3 flex-wrap">
                {SCATTER_PAYS.map(({ count, payout }) => (
                  <div
                    key={count}
                    className="flex items-center gap-2"
                    style={{
                      border: "1px solid rgba(251,151,124,0.25)",
                      background: "rgba(251,151,124,0.05)",
                      padding: "8px 14px",
                    }}
                  >
                    <div className="flex gap-0.5">
                      {Array.from({ length: count }).map((_, i) => (
                        <Image key={i} src="/symbols/SC.svg" alt="scatter" width={18} height={18} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--coral)" }}>
                      {payout}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: 16, fontSize: 11, fontFamily: "var(--font-mono)", color: "rgba(181,227,216,0.3)" }}>
                Wild substitutes for all symbols except Scatter. Left-to-right from reel 1.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
