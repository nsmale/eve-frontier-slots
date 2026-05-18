// SSU auto-discovery for the slots dapp.
//
// When the game opens the dapp from inside an SSU, ideally the URL includes
// `?itemId=<game_item_id>&tenant=<network>` (handled by dapp-kit's
// useSmartObject) or `?ssu=<sui_object_id>` (our manual fallback). When neither
// is present we fall back to discovering which SSUs the player has authorised
// the slot machine on, by inspecting OwnerCap<StorageUnit> objects stored
// inside the player's Character and checking each SSU's extension field.

import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { NETWORK, SLOT_PACKAGE_ID, WORLD_PACKAGE_ID } from "./config";

const LS_KEY = "eve-slots-active-ssu";

let _client: SuiClient | null = null;
function getClient(): SuiClient {
  if (!_client) _client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
  return _client;
}

export interface DiscoveredSsu {
  ssuId:      string;
  ownerCapId: string;
  /** True when the SSU's extension field contains our slots package's SlotAuth witness. */
  slotsAuthorized: boolean;
}

/**
 * Find every SSU the player owns and flag which of them have the slot machine
 * extension authorised. Sorted so authorised SSUs come first.
 */
export async function discoverOwnedSsus(characterId: string): Promise<DiscoveredSsu[]> {
  const client = getClient();
  const ownerCapType =
    `${WORLD_PACKAGE_ID}::access::OwnerCap<${WORLD_PACKAGE_ID}::storage_unit::StorageUnit>`;

  // 1. Find every OwnerCap<StorageUnit> stored inside the player's character
  const capResult = await client.getOwnedObjects({
    owner: characterId,
    filter: { StructType: ownerCapType },
    options: { showContent: true },
  });

  const caps: { ssuId: string; ownerCapId: string }[] = [];
  for (const obj of capResult.data) {
    const fields = (obj.data?.content as { fields?: { authorized_object_id?: string } } | undefined)?.fields;
    const ssuId = fields?.authorized_object_id;
    if (ssuId && obj.data?.objectId) caps.push({ ssuId, ownerCapId: obj.data.objectId });
  }
  if (caps.length === 0) return [];

  // 2. Batch-fetch all SSUs and check each one's `extension` field for our SlotAuth
  const ssuObjs = await client.multiGetObjects({
    ids: caps.map((c) => c.ssuId),
    options: { showContent: true },
  });

  // SlotAuth type name appears in the extension field as e.g. "d1519...::slots::SlotAuth"
  // Compare without the leading "0x" so both raw-bytes and prefixed forms match.
  const slotsPackageBare = SLOT_PACKAGE_ID.replace(/^0x/, "").toLowerCase();
  const authorizedMap = new Map<string, boolean>();
  for (const obj of ssuObjs) {
    const id = obj.data?.objectId;
    if (!id) continue;
    const ext = (obj.data?.content as { fields?: { extension?: unknown } } | undefined)?.fields?.extension;
    const extStr = ext ? JSON.stringify(ext).toLowerCase() : "";
    authorizedMap.set(id, extStr.includes(slotsPackageBare) && extStr.includes("slots::slotauth"));
  }

  const out: DiscoveredSsu[] = caps.map((c) => ({
    ssuId: c.ssuId,
    ownerCapId: c.ownerCapId,
    slotsAuthorized: authorizedMap.get(c.ssuId) ?? false,
  }));

  // Authorised SSUs come first
  out.sort((a, b) => Number(b.slotsAuthorized) - Number(a.slotsAuthorized));
  return out;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

export function getStoredActiveSsu(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(LS_KEY); } catch { return null; }
}

export function setStoredActiveSsu(ssuId: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, ssuId); } catch {}
}

export function clearStoredActiveSsu(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(LS_KEY); } catch {}
}
