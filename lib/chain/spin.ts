// Build the on-chain spin transaction.
// spin() is entry-only in Move — it must be the sole call in its PTB to satisfy
// sui::random's re-roll prevention requirement.

import { Transaction } from "@mysten/sui/transactions";
import { SLOT_CONFIG_ID, SLOT_PACKAGE_ID, SUI_RANDOM_ID } from "./config";
import type { SymbolId } from "@/lib/engine/symbols";
import type { Grid } from "@/lib/engine/spin";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpinResultEvent {
  player:           string;
  character_id:     string;
  /** Flat 15-byte array: reel0_row0, reel0_row1, reel0_row2, reel1_row0, … */
  grid:             number[];
  lines:            number;
  credits_per_line: string;
  total_bet:        string;
  line_payout:      string;
  scatter_count:    number;
  scatter_payout:   string;
  jackpot_type:     number;   // 0=none 1=mini 2=major 3=grand
  jackpot_payout:   string;
  total_payout:     string;
  new_balance:      string;
  mini_pool:        string;
  major_pool:       string;
  grand_pool:       string;
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
  playerAddress:   string;
  characterId:     string;
  lines:           number;   // 1–5
  creditsPerLine:  number;   // fuel units per line per spin
}

export function buildSpinTransaction({
  playerAddress,
  characterId,
  lines,
  creditsPerLine,
}: BuildSpinTxArgs): Transaction {
  const tx = new Transaction();
  tx.setSender(playerAddress);

  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::spin`,
    arguments: [
      tx.object(characterId),
      tx.object(SLOT_CONFIG_ID),
      tx.object(SUI_RANDOM_ID),
      tx.pure.u8(lines),
      tx.pure.u64(creditsPerLine),
    ],
  });

  return tx;
}

// ── Parse SpinResult event from transaction effects ────────────────────────

export function parseSpinResult(
  events: { type: string; parsedJson?: unknown }[],
): SpinResultEvent | null {
  const ev = events.find((e) => e.type?.endsWith("::slots::SpinResult"));
  if (!ev?.parsedJson) return null;
  return ev.parsedJson as SpinResultEvent;
}
