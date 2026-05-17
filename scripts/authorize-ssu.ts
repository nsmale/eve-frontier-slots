/**
 * One-time admin script: register the slots extension on the SSU.
 *
 * PTB flow:
 *   1. character::borrow_owner_cap<StorageUnit>(character, receiving_ssu_owner_cap)
 *   2. slots::authorize_on_ssu(ssu, &ssu_owner_cap)
 *   3. character::return_owner_cap<StorageUnit>(character, ssu_owner_cap, receipt)
 *
 * Run:
 *   npx tsx scripts/authorize-ssu.ts
 *
 * Requires env vars (or edit the constants below):
 *   SUI_PRIVATE_KEY  — bech32 sui private key (suiprivkey1...)
 */

import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// ── Config ─────────────────────────────────────────────────────────────────────

const WORLD_PACKAGE_ID =
  "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

const SLOT_PACKAGE_ID =
  "0xd151911ac454210853fcf446cf097b7a502478dc9ca111136bf5eaa92aa37823";

const CHARACTER_ID =
  "0xd60d54d6679dc150779c99abac7e1d20923982dfc9d0135a4305e0483e1953e6";

const SSU_ID =
  "0x0450cb46b80e7b7de9508959e8f750383fa0dd65935ec489fb7ce0fdd0bec0cc";

// OwnerCap<StorageUnit> owned by the Character — authorized_object_id == SSU_ID
const OWNER_CAP_OF_SSU_ID =
  "0x13b157475210774481ea5066a18fb857cf3443921b44219cd0c46ebc414540f0";

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Set SUI_PRIVATE_KEY env var (bech32 suiprivkey1...)");
  }

  const keypair = Ed25519Keypair.fromSecretKey(privateKey);
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log("Sender:", sender);

  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet") });

  // Fetch current version/digest for the OwnerCap<StorageUnit> (Receiving<> arg)
  const ownerCapObj = await client.getObject({
    id: OWNER_CAP_OF_SSU_ID,
    options: { showVersion: true, showDigest: true },
  });
  if (!ownerCapObj.data) throw new Error("OwnerCap<StorageUnit> not found");

  const ownerCapRef = {
    objectId: OWNER_CAP_OF_SSU_ID,
    version:  ownerCapObj.data.version!,
    digest:   ownerCapObj.data.digest!,
  };

  const storageUnitType = `${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`;

  const tx = new Transaction();
  tx.setSender(sender);

  // Step 1: borrow OwnerCap<StorageUnit> from Character
  const [ssuOwnerCap, receipt] = tx.moveCall({
    target: `${WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
    typeArguments: [storageUnitType],
    arguments: [
      tx.object(CHARACTER_ID),
      tx.receivingRef(ownerCapRef),
    ],
  });

  // Step 2: authorize the slots extension on the SSU
  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::authorize_on_ssu`,
    arguments: [
      tx.object(SSU_ID),
      ssuOwnerCap,
    ],
  });

  // Step 3: return OwnerCap<StorageUnit> to Character
  tx.moveCall({
    target: `${WORLD_PACKAGE_ID}::character::return_owner_cap`,
    typeArguments: [storageUnitType],
    arguments: [
      tx.object(CHARACTER_ID),
      ssuOwnerCap,
      receipt,
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status.status === "success") {
    console.log("✓ authorize_on_ssu succeeded:", result.digest);
  } else {
    console.error("✗ Transaction failed:", result.effects?.status);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
