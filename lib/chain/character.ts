// Character resolution utilities.
// PlayerProfile (wallet-owned) → Character (shared) → OwnerCap<Character> (owned by Character).

import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { NETWORK, WORLD_PACKAGE_ID } from "./config";

let _client: SuiClient | null = null;
function getClient(): SuiClient {
  if (!_client) _client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
  return _client;
}

export interface CharacterInfo {
  profileId:      string;
  characterId:    string;
  ownerCapId:     string;
  ownerCapVersion: string;
  ownerCapDigest:  string;
}

/** Fetch the CharacterInfo for a wallet address. Returns null if not found. */
export async function fetchCharacterInfo(walletAddress: string): Promise<CharacterInfo | null> {
  const client = getClient();

  // 1. Find the PlayerProfile owned by the wallet
  const profileResult = await client.getOwnedObjects({
    owner: walletAddress,
    filter: { StructType: `${WORLD_PACKAGE_ID}::character::PlayerProfile` },
    options: { showContent: true },
  });

  const profileObj = profileResult.data?.[0];
  if (!profileObj?.data?.content) return null;

  const profileFields = (profileObj.data.content as { fields?: { character_id?: string } }).fields;
  const characterId = profileFields?.character_id;
  if (!characterId) return null;

  // 2. Find OwnerCap<Character> owned by the Character object.
  // CRITICAL: filter by the fully-qualified generic type. Without <Character> the
  // result also includes OwnerCap<StorageUnit> entries for every SSU the player
  // owns, and capResult.data[0] would be the wrong cap → borrow_owner_cap<Character>
  // would fail with a type mismatch in the deposit PTB.
  const characterCapType =
    `${WORLD_PACKAGE_ID}::access::OwnerCap<${WORLD_PACKAGE_ID}::character::Character>`;

  const capResult = await client.getOwnedObjects({
    owner: characterId,
    filter: { StructType: characterCapType },
    options: { showContent: false },
  });

  const capObj = capResult.data?.[0];
  if (!capObj?.data) return null;

  return {
    profileId:       profileObj.data.objectId,
    characterId,
    ownerCapId:      capObj.data.objectId,
    ownerCapVersion: capObj.data.version,
    ownerCapDigest:  capObj.data.digest,
  };
}
