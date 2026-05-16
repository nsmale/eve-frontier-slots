"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { SYMBOL_ART, SYMBOLS } from "@/lib/engine/symbols";
import type { LineAnchor } from "@/lib/engine/paytable";
import { SYMBOL_LINE_PAY, SCATTER_PAY } from "@/lib/engine/paytable";

const LINE_ROWS: { anchor: LineAnchor; note?: string }[] = [
  { anchor: "S1" },
  { anchor: "S2" },
  { anchor: "S3" },
  { anchor: "M1" },
  { anchor: "M2" },
  { anchor: "M3" },
  { anchor: "H1" },
  { anchor: "W" },
];

const SCATTER_ROWS = Object.entries(SCATTER_PAY).map(([k, v]) => ({
  count: Number(k) as 2 | 3 | 4 | 5,
  mult: v,
}));

export default function Paytable() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="btn-ghost" style={{ fontSize: 11 }}>
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
            <div className="hud-panel" style={{ marginTop: 12, padding: "16px 20px" }}>
              <p className="heading-caps" style={{ fontSize: 10, color: "var(--mint)", marginBottom: 12 }}>
                Line Pays <span style={{ opacity: 0.5 }}>× credits per line</span>
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 6 }} className="hud-label">Symbol</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 6 }}>3×</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 6 }}>4×</th>
                    <th className="hud-label" style={{ textAlign: "center", paddingBottom: 6 }}>5×</th>
                  </tr>
                </thead>
                <tbody>
                  {LINE_ROWS.map(({ anchor, note }) => {
                    const pays = SYMBOL_LINE_PAY[anchor];
                    const def = SYMBOLS[anchor];
                    return (
                      <tr key={anchor} style={{ borderTop: "1px solid rgba(24,124,155,0.12)" }}>
                        <td style={{ padding: "7px 0" }}>
                          <div className="flex items-center gap-2">
                            <Image src={SYMBOL_ART[anchor]} alt={anchor} width={20} height={20} />
                            <span style={{ fontSize: 11, color: "var(--mint)", fontFamily: "var(--font-mono)" }}>
                              {def.label}{note && <span style={{ opacity: 0.5 }}> {note}</span>}
                            </span>
                          </div>
                        </td>
                        {([3, 4, 5] as const).map(n => (
                          <td key={n} style={{ textAlign: "center", padding: "7px 0" }}>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: 12,
                              color: pays[n] ? "var(--white)" : "rgba(181,227,216,0.2)",
                            }}>
                              {pays[n] ?? "—"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Seer note */}
              <p style={{ marginTop: 8, fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(181,227,216,0.35)" }}>
                <Image src={SYMBOL_ART["M4"]} alt="M4" width={14} height={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                Seer substitutes for all mid symbols. Seer-only runs pay at Char. Awakened rate.
              </p>

              {/* Scatter */}
              <p className="heading-caps" style={{ fontSize: 10, color: "var(--mint)", marginTop: 16, marginBottom: 10 }}>
                Scatter Pays <span style={{ opacity: 0.5 }}>× total bet · any position</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {SCATTER_ROWS.map(({ count, mult }) => (
                  <div key={count} className="flex items-center gap-2" style={{
                    border: "1px solid rgba(229,53,53,0.25)",
                    background: "rgba(229,53,53,0.05)",
                    padding: "6px 12px",
                  }}>
                    <div className="flex">
                      {Array.from({ length: count }).map((_, i) => (
                        <Image key={i} src={SYMBOL_ART["SC"]} alt="scatter" width={16} height={16} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--coral)" }}>
                      {mult}× total bet
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: 12, fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(181,227,216,0.3)" }}>
                Tribe Peace (wild) substitutes for all except Scatter and Seer. Left-to-right from reel 1.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
