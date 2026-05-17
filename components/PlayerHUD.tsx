"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/chain/WalletContext";
import { useSlotStore } from "@/lib/store";
import { fetchPlayerFuelBalance } from "@/lib/chain/query";
import { isChainConfigured } from "@/lib/chain/config";

function abbrev(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PlayerHUD() {
  const { isConnected, walletAddress, character, isLoadingChar, handleConnect, handleDisconnect } =
    useWallet();

  const useChain = isChainConfigured && isConnected;

  const { data: fuelBalance, isLoading: balLoading } = useQuery({
    queryKey: ["fuelBalance", character?.characterId],
    queryFn: () => fetchPlayerFuelBalance(character!.characterId),
    enabled: useChain && !!character,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const localBalance = useSlotStore((s) => s.balance);
  const lines = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);
  const addCredits = useSlotStore((s) => s.addCredits);

  const totalBet = lines * creditsPerLine;

  const isLoadingBalance = useChain && (isLoadingChar || balLoading);
  const displayBalance = useChain ? (isLoadingBalance ? null : (fuelBalance ?? 0)) : localBalance;
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
              {useChain ? "Fuel Balance" : "Player Balance"}
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
                    {displayBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>
                      {useChain ? "FUEL" : "CR"}
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
                {useChain ? "FUEL" : "CR"}
              </span>
            </p>
          </div>

          {/* Wallet controls */}
          {useChain ? (
            <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <p className="hud-label" style={{ fontSize: 9 }}>
                {character ? abbrev(character.characterId) : abbrev(walletAddress!)}
              </p>
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
              {isConnected ? (
                <button
                  className="btn-ghost"
                  onClick={handleConnect}
                  disabled={spinning}
                  style={{ borderColor: "var(--teal)", color: "var(--teal)", opacity: spinning ? 0.4 : 1 }}
                >
                  Connect Wallet
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
