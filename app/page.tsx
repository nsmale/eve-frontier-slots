"use client";

import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/lib/chain/WalletContext";
import { queryClient } from "@/components/Providers";
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import PlayerHUD from "@/components/PlayerHUD";
import ReelGrid from "@/components/ReelGrid";
import LineSelector from "@/components/LineSelector";
import CreditSelector from "@/components/CreditSelector";
import BetSummary from "@/components/BetSummary";
import WinDisplay from "@/components/WinDisplay";
import Paytable from "@/components/Paytable";
import GlobalStats from "@/components/GlobalStats";
import JackpotDisplay from "@/components/JackpotDisplay";
import DepositWithdrawPanel from "@/components/DepositWithdrawPanel";
import { useSlotStore, initStore } from "@/lib/store";
import { buildSpinTransaction, parseSpinResult, gridFromEvent } from "@/lib/chain/spin";
import { buildDepositTransaction, buildWithdrawTransaction } from "@/lib/chain/deposit";
import { isChainConfigured, NETWORK } from "@/lib/chain/config";
import { evaluate } from "@/lib/engine/evaluate";

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

  const { isConnected, walletAddress, character } = useWallet();
  const searchParams = useSearchParams();
  const ssuId = searchParams.get("ssu") ?? "";

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
      setChainPending, startChainSpin, executeSpin, invalidateFuelBalance]);

  // ── Deposit ─────────────────────────────────────────────────────────────

  const handleDeposit = useCallback(async (quantity: number) => {
    if (!character || !walletAddress) return;
    try {
      const tx = buildDepositTransaction({
        playerAddress: walletAddress,
        characterId:   character.characterId,
        ssuId,
        ownerCapRef: {
          objectId: character.ownerCapId,
          version:  character.ownerCapVersion,
          digest:   character.ownerCapDigest,
        },
        quantity,
      });
      const dAppKit = await getDAppKit();
      await dAppKit.signAndExecuteTransaction({ transaction: tx });
      invalidateFuelBalance();
    } catch (err) {
      console.error("Deposit failed:", err);
    }
  }, [character, walletAddress, ssuId, invalidateFuelBalance]);

  // ── Withdraw ────────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(async (quantity: number) => {
    if (!character || !walletAddress) return;
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
      console.error("Withdraw failed:", err);
    }
  }, [character, walletAddress, ssuId, invalidateFuelBalance]);

  const handleSpinComplete = useCallback(() => { setSpinning(false); }, [setSpinning]);

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
      {/* ── Player HUD ─────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 610 }}>
        <PlayerHUD />
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 610,
          display: "flex",
          flexDirection: "column",
          marginTop: 20,
          gap: 0,
        }}
      >
        {/* ── Jackpot Display ───────────────────────────────────────── */}
        {isChainConfigured && (
          <div style={{ marginBottom: 16 }}>
            <JackpotDisplay />
          </div>
        )}

        {/* ── Reel Grid ─────────────────────────────────────────────── */}
        <ReelGrid
          finalGrid={grid}
          spinning={spinning}
          activeLines={lines}
          lineWins={lastResult && !spinning ? lastResult.lineWins : []}
          winAmount={lastResult && !spinning ? lastResult.totalPayout : 0}
          onSpinComplete={handleSpinComplete}
        />

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div
          className="hud-panel"
          style={{
            marginTop: 24,
            padding: "28px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div className="flex flex-wrap items-center gap-8">
            <LineSelector />
            <CreditSelector />
          </div>

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          <BetSummary onSpin={handleSpin} chainPending={chainPending} />

          <div style={{ height: 1, background: "rgba(24,124,155,0.12)" }} />

          <div className="flex items-center justify-between flex-wrap gap-4">
            <WinDisplay
              result={lastResult}
              creditsPerLine={creditsPerLine}
              spinning={spinning}
            />
            <Paytable />
          </div>
        </div>

        {/* ── Deposit / Withdraw ────────────────────────────────────── */}
        <DepositWithdrawPanel
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          disabled={spinning || chainPending}
        />

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 20 }}>
          <GlobalStats />
        </div>

        <p
          style={{
            marginTop: 40,
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
