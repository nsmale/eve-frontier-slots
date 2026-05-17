"use client";

import { useState } from "react";
import { useWallet } from "@/lib/chain/WalletContext";
import { isChainConfigured } from "@/lib/chain/config";

interface Props {
  onDeposit:  (quantity: number) => void;
  onWithdraw: (quantity: number) => void;
  disabled:   boolean;
}

const STEP = 100;
const MIN  = 100;

export default function DepositWithdrawPanel({ onDeposit, onWithdraw, disabled }: Props) {
  const { isConnected, character, isLoadingChar } = useWallet();
  const [depositQty,  setDepositQty]  = useState(MIN);
  const [withdrawQty, setWithdrawQty] = useState(MIN);

  if (!isChainConfigured || !isConnected) return null;

  const notReady = isLoadingChar || !character;

  const inputStyle: React.CSSProperties = {
    background:   "rgba(0,0,0,0.6)",
    border:       "1px solid var(--teal-dim)",
    color:        "var(--white)",
    fontFamily:   "var(--font-mono)",
    fontSize:     13,
    padding:      "6px 10px",
    width:        90,
    textAlign:    "right",
  };

  return (
    <div
      style={{
        display:       "flex",
        gap:           16,
        justifyContent:"center",
        alignItems:    "center",
        padding:       "12px 0",
        flexWrap:      "wrap",
      }}
    >
      {/* Deposit */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="hud-label" style={{ fontSize: 10 }}>Deposit</span>
        <input
          type="number"
          min={MIN}
          step={STEP}
          value={depositQty}
          onChange={(e) => setDepositQty(Math.max(MIN, Number(e.target.value)))}
          style={inputStyle}
          disabled={disabled || notReady}
        />
        <span className="hud-label" style={{ fontSize: 9 }}>FUEL</span>
        <button
          className="btn-ghost"
          onClick={() => onDeposit(depositQty)}
          disabled={disabled || notReady || depositQty < MIN}
          style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
        >
          {notReady ? "…" : "Deposit"}
        </button>
      </div>

      <div style={{ width: 1, height: 24, background: "var(--teal-dim)" }} />

      {/* Withdraw */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="hud-label" style={{ fontSize: 10 }}>Withdraw</span>
        <input
          type="number"
          min={MIN}
          step={STEP}
          value={withdrawQty}
          onChange={(e) => setWithdrawQty(Math.max(MIN, Number(e.target.value)))}
          style={inputStyle}
          disabled={disabled || notReady}
        />
        <span className="hud-label" style={{ fontSize: 9 }}>FUEL</span>
        <button
          className="btn-ghost"
          onClick={() => onWithdraw(withdrawQty)}
          disabled={disabled || notReady || withdrawQty < MIN}
          style={{ borderColor: "var(--coral)", color: "var(--coral)" }}
        >
          {notReady ? "…" : "Withdraw"}
        </button>
      </div>
    </div>
  );
}
