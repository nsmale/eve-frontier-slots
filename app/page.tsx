"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSmartObject } from "@evefrontier/dapp-kit";
import { useWallet } from "@/lib/chain/WalletContext";
import { queryClient } from "@/components/Providers";
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import PlayerHUD from "@/components/PlayerHUD";
import ReelGrid from "@/components/ReelGrid";
import LineSelector from "@/components/LineSelector";
import CreditSelector from "@/components/CreditSelector";
import BetSummary from "@/components/BetSummary";
import Paytable from "@/components/Paytable";
import { fetchPlayerFuelBalance } from "@/lib/chain/query";
import GlobalStats from "@/components/GlobalStats";
import JackpotDisplay from "@/components/JackpotDisplay";
import { useSlotStore, initStore } from "@/lib/store";
import { buildSpinTransaction, parseSpinResult, gridFromEvent } from "@/lib/chain/spin";
import { buildDepositTransaction, buildWithdrawTransaction } from "@/lib/chain/deposit";
import { isChainConfigured, NETWORK } from "@/lib/chain/config";
import { evaluate } from "@/lib/engine/evaluate";
import { useQuery } from "@tanstack/react-query";
import { fetchCharacterInfo } from "@/lib/chain/character";

const suiClient = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });

async function fetchEventsWithRetry(digest: string, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const tx = await suiClient.getTransactionBlock({
        digest,
        options: { showEvents: true },
      });
      return tx.events ?? [];
    } catch {
      if (i === retries - 1) throw new Error("Could not fetch transaction events");
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return [];
}

export default function Home() {
  const spinning     = useSlotStore((s) => s.spinning);
  const chainPending = useSlotStore((s) => s.chainPending);
  const setSpinning     = useSlotStore((s) => s.setSpinning);
  const setChainPending = useSlotStore((s) => s.setChainPending);
  const executeSpin     = useSlotStore((s) => s.executeSpin);
  const startChainSpin  = useSlotStore((s) => s.startChainSpin);
  const grid       = useSlotStore((s) => s.grid);
  const lastResult = useSlotStore((s) => s.lastResult);
  const lines          = useSlotStore((s) => s.lines);
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const totalBet       = lines * creditsPerLine;

  const localBalance   = useSlotStore((s) => s.balance);

  const { isConnected, walletAddress, character } = useWallet();
  const { assembly } = useSmartObject();
  const searchParams = useSearchParams();
  // Prefer the SSU the game passed via ?itemId= (resolved by dapp-kit) over ?ssu= fallback
  const ssuId = assembly?.id ?? searchParams.get("ssu") ?? "";

  const useChainMode = isChainConfigured && isConnected;

  // Mirror the fuel balance query (same cache key as PlayerHUD, no extra fetch)
  const { data: chainFuelBalance } = useQuery({
    queryKey: ["fuelBalance", character?.characterId],
    queryFn:  () => fetchPlayerFuelBalance(character!.characterId),
    enabled:  useChainMode && !!character,
    staleTime: 10_000,
  });

  const effectiveBalance = useChainMode ? (chainFuelBalance ?? null) : localBalance;

  // Insufficient-balance flip message (auto-dismiss after 3 s)
  const [showInsufficientFuel, setShowInsufficientFuel] = useState(false);
  const insufficientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function triggerInsufficientFuel() {
    if (insufficientTimer.current) clearTimeout(insufficientTimer.current);
    setShowInsufficientFuel(true);
    insufficientTimer.current = setTimeout(() => setShowInsufficientFuel(false), 3000);
  }

  // Deposit / withdraw error feedback (auto-dismiss after 6 s)
  const [chainError, setChainError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function reportError(msg: string) {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setChainError(msg);
    errorTimer.current = setTimeout(() => setChainError(null), 6000);
  }

  useEffect(() => { initStore(); }, []);

  const getDAppKit = () => import("@evefrontier/dapp-kit/config").then((m) => m.dAppKit);

  const getDigestFromResult = (result: unknown): string => {
    if (result && typeof result === "object") {
      if ("Transaction" in result && result.Transaction && typeof result.Transaction === "object" && "digest" in result.Transaction) {
        return (result.Transaction as { digest: string }).digest;
      }
      if ("digest" in result) return (result as { digest: string }).digest;
    }
    throw new Error("Could not extract digest from transaction result");
  };

  const invalidateFuelBalance = useCallback(() => {
    if (character) {
      queryClient.invalidateQueries({ queryKey: ["fuelBalance", character.characterId] });
    }
    queryClient.invalidateQueries({ queryKey: ["jackpots"] });
  }, [character]);

  // ── Spin ────────────────────────────────────────────────────────────────

  const handleSpin = useCallback(async () => {
    if (spinning || chainPending) return;

    // Reject and show message when balance is loaded but too low
    if (effectiveBalance !== null && totalBet > effectiveBalance) {
      triggerInsufficientFuel();
      return;
    }

    const useChain = isChainConfigured && !!ssuId && isConnected && !!walletAddress && !!character;

    if (useChain) {
      setChainPending(true);
      try {
        const tx = buildSpinTransaction({
          playerAddress:  walletAddress!,
          characterId:    character!.characterId,
          lines,
          creditsPerLine,
        });

        const dAppKit = await getDAppKit();
        const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        const digest = getDigestFromResult(result);
        const events = await fetchEventsWithRetry(digest);
        const spinEvent = parseSpinResult(events as { type: string; parsedJson?: unknown }[]);

        if (!spinEvent) throw new Error("SpinResult event not found in tx");

        const finalGrid = gridFromEvent(spinEvent.grid);
        const totalPayout = Number(spinEvent.total_payout);

        const localEval = evaluate({ grid: finalGrid, lines, creditsPerLine });
        const chainResult = { ...localEval, totalPayout };

        startChainSpin(finalGrid, chainResult, totalPayout);
        invalidateFuelBalance();
      } catch (err) {
        console.error("Chain spin failed:", err);
        setChainPending(false);
      }
    } else {
      executeSpin();
    }
  }, [spinning, chainPending, ssuId, isConnected, walletAddress, character, lines, creditsPerLine,
      effectiveBalance, totalBet, setChainPending, startChainSpin, executeSpin, invalidateFuelBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deposit ─────────────────────────────────────────────────────────────

  const handleDeposit = useCallback(async (quantity: number) => {
    if (!character || !walletAddress) return;
    if (!ssuId) { reportError("No SSU is active. Open the slots from inside an SSU."); return; }
    try {
      // OwnerCap version/digest changes after every use; refetch immediately before building tx
      const fresh = await fetchCharacterInfo(walletAddress);
      if (!fresh) throw new Error("Could not refresh character info");

      const tx = buildDepositTransaction({
        playerAddress: walletAddress,
        characterId:   fresh.characterId,
        ssuId,
        ownerCapRef: {
          objectId: fresh.ownerCapId,
          version:  fresh.ownerCapVersion,
          digest:   fresh.ownerCapDigest,
        },
        quantity,
      });
      const dAppKit = await getDAppKit();
      await dAppKit.signAndExecuteTransaction({ transaction: tx });
      invalidateFuelBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Deposit failed:", err);
      reportError(`Deposit failed: ${msg}. Did you drag fuel into the SSU first?`);
    }
  }, [character, walletAddress, ssuId, invalidateFuelBalance]);

  // ── Withdraw ────────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(async (quantity: number) => {
    if (!character || !walletAddress) return;
    if (!ssuId) { reportError("No SSU is active. Open the slots from inside an SSU."); return; }
    try {
      const tx = buildWithdrawTransaction({
        playerAddress: walletAddress,
        characterId:   character.characterId,
        ssuId,
        quantity,
      });
      const dAppKit = await getDAppKit();
      await dAppKit.signAndExecuteTransaction({ transaction: tx });
      invalidateFuelBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Withdraw failed:", err);
      reportError(`Withdraw failed: ${msg}`);
    }
  }, [character, walletAddress, ssuId, invalidateFuelBalance]);

  const handleSpinComplete = useCallback(() => { setSpinning(false); }, [setSpinning]);

  const winAmount = lastResult && !spinning ? lastResult.totalPayout : 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px 32px",
      }}
    >
      {/* ── Player HUD (with inline deposit/withdraw) ───────────────── */}
      <div style={{ width: "100%", maxWidth: 610 }}>
        <PlayerHUD
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          depositWithdrawDisabled={spinning || chainPending}
        />
      </div>

      {/* ── Chain error banner ─────────────────────────────────────── */}
      {chainError && (
        <div style={{ width: "100%", maxWidth: 610, marginTop: 8, padding: "8px 12px",
          background: "rgba(251,151,124,0.08)", border: "1px solid rgba(251,151,124,0.4)",
          color: "var(--coral)", fontFamily: "var(--font-mono)", fontSize: 11,
        }}>
          {chainError}
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 610,
          display: "flex",
          flexDirection: "column",
          marginTop: 12,
          gap: 0,
        }}
      >
        {/* ── Jackpot Display (becomes winner banner on win) ─────────── */}
        <div style={{ marginBottom: 10 }}>
          <JackpotDisplay winAmount={winAmount} spinning={spinning} />
        </div>

        {/* ── Reel Grid ─────────────────────────────────────────────── */}
        <ReelGrid
          finalGrid={grid}
          spinning={spinning}
          activeLines={lines}
          lineWins={lastResult && !spinning ? lastResult.lineWins : []}
          winAmount={winAmount}
          insufficientBalance={showInsufficientFuel}
          onSpinComplete={handleSpinComplete}
        />

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div
          className="hud-panel"
          style={{
            marginTop: 14,
            padding: "16px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div className="flex flex-wrap items-center gap-6">
            <LineSelector />
            <CreditSelector />
          </div>

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          <BetSummary
            onSpin={handleSpin}
            chainPending={chainPending}
            chainBalance={useChainMode ? (chainFuelBalance ?? null) : undefined}
          />

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          {/* Paytable button — position: relative so its panel overlays without shifting anything */}
          <div className="flex justify-end">
            <Paytable />
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 12 }}>
          <GlobalStats />
        </div>

        <p
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(181,227,216,0.12)",
            textTransform: "uppercase",
          }}
        >
          {isChainConfigured && ssuId
            ? "Utopia Testnet · On-Chain · Powered by Sui"
            : "Session only · Balance resets on new session"}
        </p>
      </div>
    </main>
  );
}
