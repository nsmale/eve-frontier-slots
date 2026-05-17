// Chain configuration for EVE Frontier Slot Terminal (fuel-based SSU extension)
// Targets Utopia (Sui testnet) by default.

export const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet";

// ── World contracts (Utopia testnet) ──────────────────────────────────────────
// Source: https://docs.evefrontier.com → Tools → Resources → Package IDs — Utopia

// World package original-id — used for type references (e.g. Character object types)
export const WORLD_PACKAGE_ID =
  process.env.NEXT_PUBLIC_WORLD_PACKAGE_ID ??
  "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

// World package current published-at — used as the call target in PTBs
// Stillness is version 1 (no upgrade), so original-id == published-at
export const WORLD_PACKAGE_CURRENT =
  process.env.NEXT_PUBLIC_WORLD_PACKAGE_CURRENT ??
  "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

export const OBJECT_REGISTRY_ID =
  process.env.NEXT_PUBLIC_OBJECT_REGISTRY_ID ??
  "0xc2b969a72046c47e24991d69472afb2216af9e91caf802684514f39706d7dc57";

// ── Slot machine contracts (set after deploying move-contracts/eve_slots) ──────

/** Slots package original-id — used for type references */
export const SLOT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_SLOT_PACKAGE_ID ??
  "0xd151911ac454210853fcf446cf097b7a502478dc9ca111136bf5eaa92aa37823";

/** Slots package current published-at — used as call target in PTBs
 *  v2 (2026-05-17): rebalanced paytable for 92% RTP */
export const SLOT_PACKAGE_CURRENT =
  process.env.NEXT_PUBLIC_SLOT_PACKAGE_CURRENT ??
  "0x851de0ffb0374eaecc797825fef5545b595cd258f457900fcf98b468d762491a";

/** SlotConfig shared object ID (created during init, emitted in publish output) */
export const SLOT_CONFIG_ID =
  process.env.NEXT_PUBLIC_SLOT_CONFIG_ID ??
  "0x13f73c11c973d87b7fe55033563452f05922a487bc172fcfc8bbefb5348ce8de";

/**
 * In-game type_id for the fuel accepted by this machine.
 * Find type IDs via the World API: https://world-api-utopia.uat.pub.evefrontier.com/docs
 * Common fuels: EU-90 Fuel, SOF-80 Fuel, etc.
 */
export const FUEL_TYPE_ID =
  Number(process.env.NEXT_PUBLIC_FUEL_TYPE_ID ?? "0");

// ── Sui system objects ─────────────────────────────────────────────────────────

/** Randomness beacon — always 0x8 on all Sui networks */
export const SUI_RANDOM_ID = "0x8";

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * True once the contract IDs are configured. SSU_ID is NOT checked here —
 * it comes from the ?ssu= URL param at runtime and is validated per-session.
 */
export const isChainConfigured = Boolean(
  SLOT_PACKAGE_ID && SLOT_CONFIG_ID && FUEL_TYPE_ID,
);
