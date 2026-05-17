// Deposit and withdraw transaction builders.
//
// Deposit PTB flow (player moves fuel from SSU owned inventory → house pool):
//   1. character::borrow_owner_cap<Character>(character, Receiving<OwnerCap<Character>>)
//   2. storage_unit::withdraw_by_owner<Character>(ssu, character, cap, fuel_type_id, qty) → Item
//   3. slots::accept_deposit(ssu, character, config, item)
//   4. character::return_owner_cap<Character>(character, cap, receipt)
//
// Withdraw PTB flow (house pool → player's SSU owned inventory):
//   slots::withdraw_fuel(ssu, character, config, quantity)

import { Transaction } from "@mysten/sui/transactions";
import {
  FUEL_TYPE_ID,
  SLOT_CONFIG_ID,
  SLOT_PACKAGE_ID,
  WORLD_PACKAGE_ID,
  WORLD_PACKAGE_CURRENT,
} from "./config";

// ── Deposit ────────────────────────────────────────────────────────────────

export interface BuildDepositTxArgs {
  playerAddress: string;
  characterId:   string;
  ssuId:         string;
  /** Version and digest of the OwnerCap<Character> object (for Receiving<> arg). */
  ownerCapRef:   { objectId: string; version: string; digest: string };
  quantity:      number;  // fuel units
}

export function buildDepositTransaction({
  playerAddress,
  characterId,
  ssuId,
  ownerCapRef,
  quantity,
}: BuildDepositTxArgs): Transaction {
  const tx = new Transaction();
  tx.setSender(playerAddress);

  // Type uses original-id (how Character objects are typed on-chain)
  const characterType = `${WORLD_PACKAGE_ID}::character::Character`;

  // Step 1: borrow OwnerCap from inside the Character
  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PACKAGE_CURRENT}::character::borrow_owner_cap`,
    typeArguments: [characterType],
    arguments: [
      tx.object(characterId),
      tx.receivingRef(ownerCapRef),
    ],
  });

  // Step 2: withdraw fuel item from player's SSU owned inventory
  const [item] = tx.moveCall({
    target: `${WORLD_PACKAGE_CURRENT}::storage_unit::withdraw_by_owner`,
    typeArguments: [characterType],
    arguments: [
      tx.object(ssuId),
      tx.object(characterId),
      cap,
      tx.pure.u64(FUEL_TYPE_ID),
      tx.pure.u32(quantity),
    ],
  });

  // Step 3: deposit into house pool, credit player balance
  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::accept_deposit`,
    arguments: [
      tx.object(ssuId),
      tx.object(characterId),
      tx.object(SLOT_CONFIG_ID),
      item,
    ],
  });

  // Step 4: return OwnerCap to Character
  tx.moveCall({
    target: `${WORLD_PACKAGE_CURRENT}::character::return_owner_cap`,
    typeArguments: [characterType],
    arguments: [
      tx.object(characterId),
      cap,
      receipt,
    ],
  });

  return tx;
}

// ── Withdraw ───────────────────────────────────────────────────────────────

export interface BuildWithdrawTxArgs {
  playerAddress: string;
  characterId:   string;
  ssuId:         string;
  quantity:      number;  // fuel units
}

export function buildWithdrawTransaction({
  playerAddress,
  characterId,
  ssuId,
  quantity,
}: BuildWithdrawTxArgs): Transaction {
  const tx = new Transaction();
  tx.setSender(playerAddress);

  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::withdraw_fuel`,
    arguments: [
      tx.object(ssuId),
      tx.object(characterId),
      tx.object(SLOT_CONFIG_ID),
      tx.pure.u64(quantity),
    ],
  });

  return tx;
}
