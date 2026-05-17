"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJackpotPools } from "@/lib/chain/query";
import { isChainConfigured } from "@/lib/chain/config";

interface Props {
  winAmount?: number;
  spinning?:  boolean;
}

export default function JackpotDisplay({ winAmount = 0, spinning = false }: Props) {
  const { data } = useQuery({
    queryKey: ["jackpots"],
    queryFn: fetchJackpotPools,
    enabled: isChainConfigured,
    refetchInterval: 12_000,
    staleTime: 10_000,
  });

  const fmt = (n: number | undefined) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const tiers = [
    { label: "MINI",  value: data?.mini,  color: "#B5E3D8", glow: "rgba(181,227,216,0.3)" },
    { label: "MAJOR", value: data?.major, color: "#FB977C", glow: "rgba(251,151,124,0.4)" },
    { label: "GRAND", value: data?.grand, color: "#E53535", glow: "rgba(229,53,53,0.5)"   },
  ] as const;

  const showWinner = winAmount > 0 && !spinning;

  return (
    /* Fixed height so the page doesn't shift when toggling between jackpots and winner */
    <div style={{ height: 84, display: "flex", alignItems: "stretch" }}>
    <AnimatePresence mode="wait">
      {showWinner ? (
        /* ── Winner banner ─────────────────────────────────────────────── */
        <motion.div
          key="winner"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 360, damping: 22 }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "0 24px",
            background: "rgba(229,53,53,0.08)",
            border: "1.5px solid rgba(229,53,53,0.5)",
            boxShadow: "0 0 40px rgba(229,53,53,0.2), inset 0 0 24px rgba(229,53,53,0.05)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Sweeping shimmer */}
          <motion.div
            animate={{ x: ["−120%", "120%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
            style={{
              position: "absolute",
              top: 0, bottom: 0,
              width: "40%",
              background: "linear-gradient(90deg, transparent, rgba(229,53,53,0.18), transparent)",
              pointerEvents: "none",
            }}
          />

          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "rgba(229,53,53,0.7)",
          }}>
            Winner
          </span>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <motion.span
              key={winAmount}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.08 }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "var(--red)",
                textShadow: "0 0 32px rgba(229,53,53,0.6)",
              }}
            >
              {winAmount.toLocaleString()}
            </motion.span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.18em",
              color: "rgba(229,53,53,0.6)",
            }}>
              FUEL
            </span>
          </div>
        </motion.div>
      ) : (
        /* ── Jackpot boxes ──────────────────────────────────────────────── */
        <motion.div
          key="jackpots"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ flex: 1, display: "flex", gap: 12, justifyContent: "center", alignItems: "stretch" }}
        >
          {tiers.map(({ label, value, color, glow }) => (
            <div
              key={label}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: "rgba(5,5,5,0.9)",
                border: `1px solid ${color}22`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: `${color}99`,
              }}>
                {label} JACKPOT
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={String(value)}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 20,
                    fontWeight: 700,
                    color,
                    textShadow: value ? `0 0 16px ${glow}` : "none",
                    letterSpacing: "0.04em",
                  }}
                >
                  {fmt(value)}
                </motion.span>
              </AnimatePresence>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                color: `${color}55`,
                letterSpacing: "0.15em",
              }}>
                FUEL
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
