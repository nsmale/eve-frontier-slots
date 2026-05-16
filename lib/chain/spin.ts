// Build the on-chain spin transaction.
// Caller is responsible for signing + submitting via dappKit.signAndExecuteTransaction.

import { Transaction } from "@mysten/sui/transactions";
import {
  EVE_COIN_TYPE,
  EVE_UNIT,
  SLOT_HOUSE_ID,
  SLOT_PACKAGE_ID,
  SUI_RANDOM_ID,
} from "./config";
import type { SymbolId } from "@/lib/engine/symbols";
import type { Grid } from "@/lib/engine/spin";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpinResultEvent {
  player: string;
  total_bet: string;
  /** Flat 15-byte array: reel0_row0, reel0_row1, reel0_row2, reel1_row0, … */
  grid: number[];
  line_payout: string;
  scatter_count: number;
  scatter_payout: string;
  jackpot_type: number;       // 0=none 1=mini 2=major 3=grand
  jackpot_payout: string;
  total_payout: string;
  mini_jackpot_balance: string;
  major_jackpot_balance: string;
  grand_jackpot_balance: string;
}

// ── Symbol index map (Move u8 → SymbolId) ─────────────────────────────────

const INDEX_TO_SYM: SymbolId[] = ["S1","S2","S3","M1","M2","M3","M4","H1","W","SC"];

export function gridFromEvent(flat: number[]): Grid {
  const grid: Grid = [];
  for (let r = 0; r < 5; r++) {
    grid.push([
      INDEX_TO_SYM[flat[r * 3]],
      INDEX_TO_SYM[flat[r * 3 + 1]],
      INDEX_TO_SYM[flat[r * 3 + 2]],
    ] as [SymbolId, SymbolId, SymbolId]);
  }
  return grid;
}

// ── Transaction builder ────────────────────────────────────────────────────

export interface BuildSpinTxArgs {
  playerAddress: string;
  /** All EVE Coin object IDs owned by the player (used to merge + split). */
  eveCoins: { objectId: string; balance: string }[];
  lines: number;          // 1–5
  creditsPerLine: number; // 1, 5, or 10 (in whole LUX / EVE units)
}

export function buildSpinTransaction({
  playerAddress,
  eveCoins,
  lines,
  creditsPerLine,
}: BuildSpinTxArgs): Transaction {
  const tx = new Transaction();

  // zkLogin requires explicit sender
  tx.setSender(playerAddress);

  const totalBetUnits = BigInt(lines) * BigInt(creditsPerLine) * EVE_UNIT;

  // Merge all EVE coins into the first one, then split the exact bet amount
  if (eveCoins.length === 0) throw new Error("No EVE coins found in wallet");

  const primaryCoin = tx.object(eveCoins[0].objectId);

  if (eveCoins.length > 1) {
    tx.mergeCoins(
      primaryCoin,
      eveCoins.slice(1).map((c) => tx.object(c.objectId)),
    );
  }

  const [betCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(totalBetUnits)]);

  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::spin`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(SLOT_HOUSE_ID),
      tx.object(SUI_RANDOM_ID),
      betCoin,
      tx.pure.u8(lines),
    ],
  });

  return tx;
}

// ── Parse SpinResult event from transaction effects ────────────────────────

export function parseSpinResult(
  events: { type: string; parsedJson?: unknown }[],
): SpinResultEvent | null {
  const ev = events.find((e) =>
    e.type?.endsWith("::slots::SpinResult"),
  );
  if (!ev?.parsedJson) return null;
  return ev.parsedJson as SpinResultEvent;
}
