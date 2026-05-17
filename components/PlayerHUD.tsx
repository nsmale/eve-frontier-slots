"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/chain/WalletContext";
import { useSlotStore } from "@/lib/store";
import { fetchPlayerFuelBalance } from "@/lib/chain/query";
import { isChainConfigured } from "@/lib/chain/config";

const STEP = 100;
const MIN  = 100;

function abbrev(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  onDeposit?:             (qty: number) => void;
  onWithdraw?:            (qty: number) => void;
  depositWithdrawDisabled?: boolean;
}

export default function PlayerHUD({ onDeposit, onWithdraw, depositWithdrawDisabled = false }: Props) {
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

  const localBalance   = useSlotStore((s) => s.balance);
  const lines          = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const spinning       = useSlotStore((s) => s.spinning);
  const addCredits     = useSlotStore((s) => s.addCredits);

  const totalBet = lines * creditsPerLine;

  const isLoadingBalance = useChain && (isLoadingChar || balLoading);
  const displayBalance   = useChain ? (isLoadingBalance ? null : (fuelBalance ?? 0)) : localBalance;
  const isLow            = !useChain && localBalance < 50;

  const showDepositWithdraw = isChainConfigured && isConnected && onDeposit && onWithdraw;
  const notReady = isLoadingChar || !character;

  const [depositQty,  setDepositQty]  = useState(MIN);
  const [withdrawQty, setWithdrawQty] = useState(MIN);

  const inputStyle: React.CSSProperties = {
    background:  "rgba(0,0,0,0.6)",
    border:      "1px solid var(--teal-dim)",
    color:       "var(--white)",
    fontFamily:  "var(--font-mono)",
    fontSize:    12,
    padding:     "4px 8px",
    width:       76,
    textAlign:   "right",
  };

  return (
    <div className="hud-panel w-full" style={{ padding: "16px 24px" }}>

      {/* Row 1: Logo / Title  +  Wallet button */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 6, height: 32,
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

        {/* Wallet button — top-right, inline with title */}
        <div>
          {useChain ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
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
          ) : isConnected ? (
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
                color:        isLow ? "var(--coral)" : "var(--teal)",
                opacity: spinning ? 0.4 : 1,
              }}
            >
              + 10 Credits
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Balances + Deposit/Withdraw */}
      <div className="flex items-center flex-wrap gap-0">

        {/* Fuel Balance */}
        <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 16, paddingRight: 20 }}>
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
        <div style={{ borderLeft: "1px solid var(--teal-dim)", paddingLeft: 16, paddingRight: 20 }}>
          <p className="hud-label" style={{ marginBottom: 4 }}>Total Bet</p>
          <p className="hud-value" style={{ color: "var(--teal)", fontSize: 18 }}>
            {totalBet}
            <span className="hud-label" style={{ marginLeft: 6, fontSize: 9 }}>
              {useChain ? "FUEL" : "CR"}
            </span>
          </p>
        </div>

        {/* Deposit / Withdraw — inline, only when chain is connected */}
        {showDepositWithdraw && (
          <>
            <div style={{ width: 1, height: 36, background: "var(--teal-dim)", marginRight: 16 }} />

            {/* Deposit */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 12 }}>
              <span className="hud-label" style={{ fontSize: 10 }}>Deposit</span>
              <input
                type="number"
                min={MIN}
                step={STEP}
                value={depositQty}
                onChange={(e) => setDepositQty(Math.max(MIN, Number(e.target.value)))}
                style={inputStyle}
                disabled={depositWithdrawDisabled || notReady}
              />
              <span className="hud-label" style={{ fontSize: 9 }}>FUEL</span>
              <button
                className="btn-ghost"
                onClick={() => onDeposit!(depositQty)}
                disabled={depositWithdrawDisabled || notReady || depositQty < MIN}
                style={{ borderColor: "var(--teal)", color: "var(--teal)", fontSize: 11 }}
              >
                {notReady ? "…" : "Deposit"}
              </button>
            </div>

            {/* Withdraw */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="hud-label" style={{ fontSize: 10 }}>Withdraw</span>
              <input
                type="number"
                min={MIN}
                step={STEP}
                value={withdrawQty}
                onChange={(e) => setWithdrawQty(Math.max(MIN, Number(e.target.value)))}
                style={inputStyle}
                disabled={depositWithdrawDisabled || notReady}
              />
              <span className="hud-label" style={{ fontSize: 9 }}>FUEL</span>
              <button
                className="btn-ghost"
                onClick={() => onWithdraw!(withdrawQty)}
                disabled={depositWithdrawDisabled || notReady || withdrawQty < MIN}
                style={{ borderColor: "var(--coral)", color: "var(--coral)", fontSize: 11 }}
              >
                {notReady ? "…" : "Withdraw"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
