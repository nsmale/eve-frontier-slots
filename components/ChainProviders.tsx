"use client";

// Loaded with ssr:false — @evefrontier/dapp-kit's import.meta.env access never runs on the server.

import { EveFrontierProvider, useConnection } from "@evefrontier/dapp-kit";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { WalletProvider, type WalletState } from "@/lib/chain/WalletContext";
import { fetchCharacterInfo, type CharacterInfo } from "@/lib/chain/character";
import { queryClient } from "./Providers";

function WalletBridge({ children }: { children: ReactNode }) {
  const { isConnected, walletAddress, handleConnect, handleDisconnect } =
    useConnection();

  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [isLoadingChar, setIsLoadingChar] = useState(false);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      // No wallet — clear async-fetched character cache
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharacter(null);
      return;
    }
    let cancelled = false;
     
    setIsLoadingChar(true);
    fetchCharacterInfo(walletAddress)
      .then((c) => { if (!cancelled) setCharacter(c); })
      .catch(() => { if (!cancelled) setCharacter(null); })
      .finally(() => { if (!cancelled) setIsLoadingChar(false); });
    return () => { cancelled = true; };
  }, [isConnected, walletAddress]);

  const value: WalletState = {
    isConnected,
    walletAddress: walletAddress ?? null,
    character,
    isLoadingChar,
    handleConnect,
    handleDisconnect,
  };

  return <WalletProvider value={value}>{children}</WalletProvider>;
}

export default function ChainProviders({ children }: { children: ReactNode }) {
  return (
    <EveFrontierProvider queryClient={queryClient}>
      <WalletBridge>{children}</WalletBridge>
    </EveFrontierProvider>
  );
}
