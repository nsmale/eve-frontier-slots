"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { useSmartObject } from "@evefrontier/dapp-kit";
import { useWallet } from "@/lib/chain/WalletContext";
import {
  NETWORK,
  WORLD_PACKAGE_ID,
  WORLD_PACKAGE_CURRENT,
  SLOT_PACKAGE_ID,
  SLOT_CONFIG_ID,
  FUEL_TYPE_ID,
} from "@/lib/chain/config";

const ADMIN_CAP_ID =
  "0x82e434c9d0513fadbd96d21daee56da238743be7ec3b3b0752208f23382804d5";

const OWNER_CAP_TYPE =
  `${WORLD_PACKAGE_ID}::access::OwnerCap<${WORLD_PACKAGE_ID}::storage_unit::StorageUnit>`;

interface SsuOption {
  ssuId:       string;
  ownerCapId:  string;
}

function extractDigest(result: unknown): string {
  if (result && typeof result === "object") {
    if ("Transaction" in result && result.Transaction && typeof result.Transaction === "object" && "digest" in result.Transaction) {
      return (result.Transaction as { digest: string }).digest;
    }
    if ("digest" in result) return (result as { digest: string }).digest;
  }
  return "";
}

type StepState = "idle" | "pending" | "success" | "error";
interface StepStatus { authorize: StepState; setup: StepState; error: string | null; }

export default function AdminPage() {
  const { isConnected, walletAddress, character, handleConnect } = useWallet();
  // assembly.id is the Sui object ID of the SSU this dapp was opened from in-game
  const { assembly } = useSmartObject();
  const activeAssemblyId = assembly?.id ?? null;

  const [ssus, setSsus]           = useState<SsuOption[]>([]);
  const [ssusLoading, setSsusLoading] = useState(false);
  const [selectedSsu, setSelectedSsu] = useState<SsuOption | null>(null);
  const [fuelTypeId, setFuelTypeId]   = useState(FUEL_TYPE_ID ? String(FUEL_TYPE_ID) : "");

  const [steps, setSteps] = useState<StepStatus>({ authorize: "idle", setup: "idle", error: null });
  const [authTx, setAuthTx]   = useState<string | null>(null);
  const [setupTx, setSetupTx] = useState<string | null>(null);

  const getDAppKit = () => import("@evefrontier/dapp-kit/config").then((m) => m.dAppKit);
  const setStep = (key: keyof Omit<StepStatus, "error">, state: StepState) =>
    setSteps((s) => ({ ...s, [key]: state }));
  const setError = (msg: string) => setSteps((s) => ({ ...s, error: msg }));

  // Auto-discover SSUs owned by this character
  useEffect(() => {
    if (!character) { setSsus([]); setSelectedSsu(null); return; }

    setSsusLoading(true);
    const client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });

    client.getOwnedObjects({
      owner: character.characterId,
      filter: { StructType: OWNER_CAP_TYPE },
      options: { showContent: true },
    }).then((result) => {
      const found: SsuOption[] = [];
      for (const obj of result.data) {
        const fields = (obj.data?.content as { fields?: { authorized_object_id?: string } } | undefined)?.fields;
        const ssuId = fields?.authorized_object_id;
        if (ssuId && obj.data?.objectId) {
          found.push({ ssuId, ownerCapId: obj.data.objectId });
        }
      }
      setSsus(found);
    }).catch(() => {
      setSsus([]);
    }).finally(() => {
      setSsusLoading(false);
    });
  }, [character?.characterId]);

  // Auto-select the SSU that matches the game context (assembly.id) or the only one
  useEffect(() => {
    if (ssus.length === 0) return;
    if (activeAssemblyId) {
      const match = ssus.find((s) => s.ssuId === activeAssemblyId);
      if (match) { setSelectedSsu(match); return; }
    }
    if (ssus.length === 1) setSelectedSsu(ssus[0]);
  }, [ssus, activeAssemblyId]);

  // ── Step 1: authorize_on_ssu ──────────────────────────────────────────────
  async function runAuthorize() {
    if (!character)    return setError("No character found for this wallet.");
    if (!selectedSsu)  return setError("Select an SSU first.");

    setStep("authorize", "pending");
    setError("");

    try {
      const dAppKit = await getDAppKit();

      const res = await fetch("https://fullnode.testnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "sui_getObject",
          params: [selectedSsu.ownerCapId, { showVersion: true, showDigest: true }],
        }),
      });
      const json = await res.json();
      const obj = json?.result?.data;
      if (!obj) throw new Error("OwnerCap<StorageUnit> not found on chain");

      const ownerCapRef = {
        objectId: selectedSsu.ownerCapId,
        version:  obj.version as string,
        digest:   obj.digest  as string,
      };

      const storageUnitType = `${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`;
      const tx = new Transaction();

      const [ssuOwnerCap, receipt] = tx.moveCall({
        target: `${WORLD_PACKAGE_CURRENT}::character::borrow_owner_cap`,
        typeArguments: [storageUnitType],
        arguments: [tx.object(character.characterId), tx.receivingRef(ownerCapRef)],
      });

      tx.moveCall({
        target: `${SLOT_PACKAGE_ID}::slots::authorize_on_ssu`,
        arguments: [tx.object(selectedSsu.ssuId), ssuOwnerCap],
      });

      tx.moveCall({
        target: `${WORLD_PACKAGE_CURRENT}::character::return_owner_cap`,
        typeArguments: [storageUnitType],
        arguments: [tx.object(character.characterId), ssuOwnerCap, receipt],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      setAuthTx(extractDigest(result));
      setStep("authorize", "success");
    } catch (e: unknown) {
      setStep("authorize", "error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── Step 2: setup (set fuel_type_id) ──────────────────────────────────────
  async function runSetup() {
    const typeId = Number(fuelTypeId);
    if (!typeId) return setError("Enter a valid numeric fuel type ID.");

    setStep("setup", "pending");
    setError("");

    try {
      const dAppKit = await getDAppKit();
      const tx = new Transaction();
      tx.moveCall({
        target: `${SLOT_PACKAGE_ID}::slots::setup`,
        arguments: [tx.object(ADMIN_CAP_ID), tx.object(SLOT_CONFIG_ID), tx.pure.u64(typeId)],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      setSetupTx(extractDigest(result));
      setStep("setup", "success");
    } catch (e: unknown) {
      setStep("setup", "error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const stateColor: Record<StepState, string> = {
    idle: "text-gray-400", pending: "text-yellow-400", success: "text-green-400", error: "text-red-400",
  };
  const stateLabel: Record<StepState, string> = {
    idle: "Not run", pending: "Running...", success: "Done", error: "Failed",
  };

  const gameUrl = selectedSsu
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ssu=${selectedSsu.ssuId}`
    : null;

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white p-8 font-mono">
      <h1 className="text-2xl font-bold mb-1 text-cyan-400">Slot Machine Admin</h1>
      <p className="text-gray-500 text-sm mb-8">One-time setup — run with the character owner wallet</p>

      {/* Wallet */}
      <section className="mb-8 p-4 border border-gray-700 rounded">
        <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-widest">Wallet</h2>
        {isConnected ? (
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">Address: </span><span className="text-green-400">{walletAddress}</span></p>
            <p>
              <span className="text-gray-500">Character: </span>
              {character
                ? <span className="text-green-400">{character.characterId}</span>
                : <span className="text-yellow-400">Loading...</span>}
            </p>
          </div>
        ) : (
          <button onClick={handleConnect} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-bold">
            Connect Wallet
          </button>
        )}
      </section>

      {/* SSU picker */}
      <section className="mb-8 p-4 border border-gray-700 rounded">
        <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-widest">Select SSU</h2>
        {!isConnected && (
          <p className="text-gray-600 text-sm">Connect your wallet to see your SSUs.</p>
        )}
        {isConnected && ssusLoading && (
          <p className="text-yellow-400 text-sm">Discovering SSUs...</p>
        )}
        {isConnected && !ssusLoading && ssus.length === 0 && (
          <p className="text-red-400 text-sm">No SSUs found for this character.</p>
        )}
        {isConnected && !ssusLoading && ssus.length > 0 && (
          <div className="space-y-2">
            {ssus.map((s) => (
              <label
                key={s.ownerCapId}
                className={`flex items-center gap-3 p-3 border rounded cursor-pointer text-xs ${
                  selectedSsu?.ownerCapId === s.ownerCapId
                    ? "border-cyan-500 bg-cyan-950"
                    : "border-gray-700 hover:border-gray-500"
                }`}
              >
                <input
                  type="radio"
                  name="ssu"
                  checked={selectedSsu?.ownerCapId === s.ownerCapId}
                  onChange={() => setSelectedSsu(s)}
                  className="accent-cyan-500"
                />
                <span className="text-gray-300">{s.ssuId}</span>
              </label>
            ))}
          </div>
        )}
        {gameUrl && (
          <div className="mt-4 p-3 border border-gray-800 rounded bg-gray-950">
            <p className="text-xs text-gray-500 mb-1">Game URL for this SSU:</p>
            <p className="text-xs text-cyan-400 break-all">{gameUrl}</p>
          </div>
        )}
      </section>

      {/* Step 1 */}
      <section className="mb-6 p-4 border border-gray-700 rounded">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Step 1 — Authorize SSU Extension</h2>
          <span className={`text-sm ${stateColor[steps.authorize]}`}>{stateLabel[steps.authorize]}</span>
        </div>
        <p className="text-gray-500 text-sm mb-4">
          Registers the slots package as an authorized extension on the selected SSU.
          Must be signed by the character owner wallet.
        </p>
        {selectedSsu && (
          <div className="text-xs text-gray-600 mb-3 space-y-1">
            <p>SSU: {selectedSsu.ssuId}</p>
            <p>OwnerCap: {selectedSsu.ownerCapId}</p>
          </div>
        )}
        <button
          onClick={runAuthorize}
          disabled={!isConnected || !character || !selectedSsu || steps.authorize === "pending" || steps.authorize === "success"}
          className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-bold"
        >
          {steps.authorize === "pending" ? "Submitting..." : "Authorize on SSU"}
        </button>
        {authTx && <p className="text-xs text-green-400 mt-2">Tx: {authTx}</p>}
      </section>

      {/* Step 2 */}
      <section className="mb-6 p-4 border border-gray-700 rounded">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Step 2 — Set Fuel Type</h2>
          <span className={`text-sm ${stateColor[steps.setup]}`}>{stateLabel[steps.setup]}</span>
        </div>
        <p className="text-gray-500 text-sm mb-3">
          Sets the in-game fuel type ID accepted by the slot machine.
          Must be signed by the AdminCap owner (deploy wallet).
        </p>
        <div className="text-xs text-gray-600 mb-3 space-y-1">
          <p>AdminCap: {ADMIN_CAP_ID}</p>
          <p>SlotConfig: {SLOT_CONFIG_ID}</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            placeholder="Fuel type ID (e.g. 88335)"
            value={fuelTypeId}
            onChange={(e) => setFuelTypeId(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm w-60 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={runSetup}
            disabled={!isConnected || !fuelTypeId || steps.setup === "pending" || steps.setup === "success"}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-bold"
          >
            {steps.setup === "pending" ? "Submitting..." : "Set Fuel Type"}
          </button>
        </div>
        {setupTx && <p className="text-xs text-green-400 mt-2">Tx: {setupTx}</p>}
      </section>

      {/* Errors */}
      {steps.error && (
        <div className="p-4 border border-red-700 rounded bg-red-950 text-red-300 text-sm">
          <p className="font-bold mb-1">Error</p>
          <p className="break-all">{steps.error}</p>
        </div>
      )}

      {/* Reference */}
      <section className="mt-8 p-4 border border-gray-800 rounded text-xs text-gray-600">
        <p className="mb-1 font-bold text-gray-500">Deployed IDs</p>
        <p>Package: {SLOT_PACKAGE_ID}</p>
        <p>SlotConfig: {SLOT_CONFIG_ID}</p>
      </section>
    </main>
  );
}
