"use client";

// Loaded with ssr:false — @evefrontier/dapp-kit's import.meta.env access never runs on the server.

import { EveFrontierProvider, useConnection } from "@evefrontier/dapp-kit";
import type { ReactNode } from "react";
import { WalletProvider, type WalletState } from "@/lib/chain/WalletContext";
import { queryClient } from "./Providers";

function WalletBridge({ children }: { children: ReactNode }) {
  const { isConnected, walletAddress, hasEveVault, handleConnect, handleDisconnect } =
    useConnection();

  const value: WalletState = {
    isConnected,
    walletAddress: walletAddress ?? null,
    hasEveVault,
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
