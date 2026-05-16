"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJackpotBalances } from "@/lib/chain/query";
import { isChainConfigured } from "@/lib/chain/config";

export default function JackpotDisplay() {
  const { data } = useQuery({
    queryKey: ["jackpots"],
    queryFn: fetchJackpotBalances,
    enabled: isChainConfigured,
    refetchInterval: 12_000,
    staleTime: 10_000,
  });

  const fmt = (n: number | undefined) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const tiers = [
    { label: "MINI",  value: data?.mini,  color: "#B5E3D8", glow: "rgba(181,227,216,0.3)" },
    { label: "MAJOR", value: data?.major, color: "#FB977C", glow: "rgba(251,151,124,0.4)" },
    { label: "GRAND", value: data?.grand, color: "#E53535", glow: "rgba(229,53,53,0.5)" },
  ] as const;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        justifyContent: "center",
        alignItems: "stretch",
      }}
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
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: `${color}99`,
            }}
          >
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
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              color: `${color}55`,
              letterSpacing: "0.15em",
            }}
          >
            LUX
          </span>
        </div>
      ))}
    </div>
  );
}
