// On-chain queries: jackpot pools + player fuel balance from SlotConfig.

import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { NETWORK, SLOT_CONFIG_ID } from "./config";

export interface JackpotPools {
  mini: number;
  major: number;
  grand: number;
}

let _client: SuiClient | null = null;
function getClient(): SuiClient {
  if (!_client) _client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
  return _client;
}

interface SlotConfigFields {
  jackpot_mini:  string;
  jackpot_major: string;
  jackpot_grand: string;
  player_balances: {
    fields: { id: { id: string } };
  };
}

export async function fetchJackpotPools(): Promise<JackpotPools> {
  if (!SLOT_CONFIG_ID) return { mini: 0, major: 0, grand: 0 };

  const obj = await getClient().getObject({
    id: SLOT_CONFIG_ID,
    options: { showContent: true },
  });

  const fields = (obj.data?.content as { fields?: SlotConfigFields } | undefined)?.fields;
  if (!fields) return { mini: 0, major: 0, grand: 0 };

  return {
    mini:  Number(fields.jackpot_mini),
    major: Number(fields.jackpot_major),
    grand: Number(fields.jackpot_grand),
  };
}

export async function fetchPlayerFuelBalance(characterId: string): Promise<number> {
  if (!SLOT_CONFIG_ID || !characterId) return 0;

  const client = getClient();

  const configObj = await client.getObject({
    id: SLOT_CONFIG_ID,
    options: { showContent: true },
  });

  const fields = (configObj.data?.content as { fields?: SlotConfigFields } | undefined)?.fields;
  if (!fields) return 0;

  const tableId = fields.player_balances.fields.id.id;

  try {
    const dynField = await client.getDynamicFieldObject({
      parentId: tableId,
      name: { type: "0x2::object::ID", value: characterId },
    });
    const value = (dynField.data?.content as { fields?: { value: string } } | undefined)
      ?.fields?.value;
    return value ? Number(value) : 0;
  } catch {
    return 0;
  }
}
