"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// QueryClient is SSR-safe; EveFrontierProvider is not (imports import.meta.env at init time).
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 10_000 } },
});

// Loaded with ssr:false so @evefrontier/dapp-kit never runs on the server.
const EveChain = dynamic(() => import("./ChainProviders"), { ssr: false });

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <EveChain>{children}</EveChain>
    </QueryClientProvider>
  );
}
