// On-chain queries: jackpot balances + player EVE coin balance.

import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { NETWORK, SLOT_HOUSE_ID, EVE_COIN_TYPE, EVE_DECIMALS } from "./config";

export interface JackpotBalances {
  mini: number;   // in whole EVE (display units)
  major: number;
  grand: number;
}

let _client: SuiClient | null = null;
function getClient(): SuiClient {
  if (!_client) _client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
  return _client;
}

// Raw SlotHouse dynamic fields layout from Move struct:
//   house_balance, mini_jackpot, major_jackpot, grand_jackpot, total_spins, total_wagered, total_paid
interface SlotHouseFields {
  mini_jackpot: { fields: { value: string } };
  major_jackpot: { fields: { value: string } };
  grand_jackpot: { fields: { value: string } };
}

export async function fetchJackpotBalances(): Promise<JackpotBalances> {
  if (!SLOT_HOUSE_ID) return { mini: 0, major: 0, grand: 0 };

  const obj = await getClient().getObject({
    id: SLOT_HOUSE_ID,
    options: { showContent: true },
  });

  const fields = (obj.data?.content as { fields?: SlotHouseFields } | undefined)?.fields;
  if (!fields) return { mini: 0, major: 0, grand: 0 };

  const unit = 10 ** EVE_DECIMALS;
  return {
    mini:  Number(fields.mini_jackpot.fields.value)  / unit,
    major: Number(fields.major_jackpot.fields.value) / unit,
    grand: Number(fields.grand_jackpot.fields.value) / unit,
  };
}

export interface EveBalance {
  /** Total EVE balance in whole display units (e.g. 42.5 EVE) */
  display: number;
  /** All coin objects — pass to buildSpinTransaction */
  coins: { objectId: string; balance: string }[];
}

export async function fetchEveBalance(address: string): Promise<EveBalance> {
  const client = getClient();
  const result = await client.getCoins({ owner: address, coinType: EVE_COIN_TYPE });
  const coins = result.data.map((c) => ({ objectId: c.coinObjectId, balance: c.balance }));
  const totalRaw = coins.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
  return {
    display: Number(totalRaw) / 10 ** EVE_DECIMALS,
    coins,
  };
}
