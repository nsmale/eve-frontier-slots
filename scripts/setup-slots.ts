/**
 * One-time admin script: call slots::setup to set the fuel type ID.
 *
 * Run:
 *   FUEL_TYPE_ID=<number> npx tsx scripts/setup-slots.ts
 *
 * Find fuel type IDs via the EVE Frontier World API.
 * Requires env:
 *   SUI_PRIVATE_KEY  — bech32 suiprivkey1...
 *   FUEL_TYPE_ID     — numeric in-game type ID for the accepted fuel
 */

import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const SLOT_PACKAGE_ID =
  "0xd151911ac454210853fcf446cf097b7a502478dc9ca111136bf5eaa92aa37823";

const SLOT_CONFIG_ID =
  "0x13f73c11c973d87b7fe55033563452f05922a487bc172fcfc8bbefb5348ce8de";

const ADMIN_CAP_ID =
  "0x82e434c9d0513fadbd96d21daee56da238743be7ec3b3b0752208f23382804d5";

async function main() {
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set SUI_PRIVATE_KEY");

  const fuelTypeId = Number(process.env.FUEL_TYPE_ID ?? "0");
  if (!fuelTypeId) throw new Error("Set FUEL_TYPE_ID env var");

  const keypair = Ed25519Keypair.fromSecretKey(privateKey);
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log("Sender:", sender, "— fuel_type_id:", fuelTypeId);

  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet") });

  const tx = new Transaction();
  tx.setSender(sender);

  tx.moveCall({
    target: `${SLOT_PACKAGE_ID}::slots::setup`,
    arguments: [
      tx.object(ADMIN_CAP_ID),
      tx.object(SLOT_CONFIG_ID),
      tx.pure.u64(fuelTypeId),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status.status === "success") {
    console.log("✓ setup succeeded:", result.digest);
  } else {
    console.error("✗ Transaction failed:", result.effects?.status);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
