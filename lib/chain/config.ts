// Chain configuration for EVE Frontier Slot Terminal
// Targets Utopia (Sui testnet) by default.

export const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet";

// EVE token coin type on Utopia testnet
// Format: {evePackageId}::EVE::EVE
export const EVE_COIN_TYPE =
  process.env.NEXT_PUBLIC_EVE_COIN_TYPE ??
  "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE";

// Slot machine package ID (set after deploying move-contracts/eve_slots)
export const SLOT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_SLOT_PACKAGE_ID ?? "";

// SlotHouse shared object ID (set after create_house is called)
export const SLOT_HOUSE_ID =
  process.env.NEXT_PUBLIC_SLOT_HOUSE_ID ?? "";

// Sui Random singleton — always 0x8 on all Sui networks
export const SUI_RANDOM_ID = "0x8";

// EVE token decimals — 9 (1 EVE = 1_000_000_000 base units), same as SUI
export const EVE_DECIMALS = 9;
export const EVE_UNIT = BigInt(10 ** EVE_DECIMALS);

// True once both contract IDs are configured
export const isChainConfigured = Boolean(SLOT_PACKAGE_ID && SLOT_HOUSE_ID);
