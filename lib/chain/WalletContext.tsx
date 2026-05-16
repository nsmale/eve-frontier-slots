"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
  hasEveVault: boolean;
  handleConnect: () => void;
  handleDisconnect: () => void;
}

const defaultState: WalletState = {
  isConnected: false,
  walletAddress: null,
  hasEveVault: false,
  handleConnect: () => {},
  handleDisconnect: () => {},
};

export const WalletContext = createContext<WalletState>(defaultState);

export function useWallet(): WalletState {
  return useContext(WalletContext);
}

export function WalletProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WalletState;
}) {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
