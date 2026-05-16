"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/chain/WalletContext";
import { useSlotStore } from "@/lib/store";
import { fetchEveBalance } from "@/lib/chain/query";
import { isChainConfigured } from "@/lib/chain/config";

function abbrev(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PlayerHUD() {
  const { isConnected, walletAddress, hasEveVault, handleConnect, handleDisconnect } = useWallet();

  // Chain balance (when connected + configured)
  const { data: eveBal, isLoading: balLoading } = useQuery({
    queryKey: ["eveBalance", walletAddress],
    queryFn: () => fetchEveBalance(walletAddress!),
    enabled: isChainConfigured && isConnected && !!walletAddress,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // Local balance (offline mode)
  const localBalance = useSlotStore((s) => s.balance);
  const lines = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);
  const addCredits = useSlotStore((s) => s.addCredits);

  const totalBet = lines * creditsPerLine;
  const useChain = isChainConfigured && isConnected;

  const displayBalance = useChain
    ? (balLoading ? null : (eveBal?.display ?? 0))
    : localBalance;

  const isLow = !useChain && localBalance < 50;

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
            <p className="hud-label" style={{ marginBottom: 4 }}>
              {useChain ? "LUX Balance" : "Player Balance"}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={String(displayBalance)}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="hud-value"
                style={{ color: isLow ? "var(--coral)" : "var(--white)" }}
              >
                {displayBalance == null ? (
                  <span style={{ fontSize: 14, color: "var(--teal-dim)" }}>…</span>
                ) : (
                  <>
                    {displayBalance.toLocaleString(undefined, { maximumFractionDigits: useChain ? 2 : 0 })}
                    <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>
                      {useChain ? "LUX" : "CR"}
                    </span>
                  </>
                )}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Total Bet */}
          <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 20 }}>
            <p className="hud-label" style={{ marginBottom: 4 }}>Total Bet</p>
            <p className="hud-value" style={{ color: "var(--teal)", fontSize: 18 }}>
              {totalBet}
              <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>
                {useChain ? "LUX" : "CR"}
              </span>
            </p>
          </div>

          {/* Wallet / Add Credits */}
          {useChain ? (
            <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <p className="hud-label" style={{ fontSize: 9 }}>{abbrev(walletAddress!)}</p>
              <button
                className="btn-ghost"
                onClick={handleDisconnect}
                disabled={spinning}
                style={{ borderColor: "var(--teal-dim)", color: "var(--teal-dim)", fontSize: 9, opacity: spinning ? 0.4 : 1 }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              {hasEveVault ? (
                <button
                  className="btn-ghost"
                  onClick={handleConnect}
                  disabled={spinning}
                  style={{
                    borderColor: "var(--teal)",
                    color: "var(--teal)",
                    opacity: spinning ? 0.4 : 1,
                  }}
                >
                  Connect Vault
                </button>
              ) : (
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
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
