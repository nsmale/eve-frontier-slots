"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CharacterInfo } from "./character";

export interface WalletState {
  isConnected:    boolean;
  walletAddress:  string | null;
  character:      CharacterInfo | null;
  isLoadingChar:  boolean;
  handleConnect:    () => void;
  handleDisconnect: () => void;
}

const defaultState: WalletState = {
  isConnected:    false,
  walletAddress:  null,
  character:      null,
  isLoadingChar:  false,
  handleConnect:    () => {},
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
