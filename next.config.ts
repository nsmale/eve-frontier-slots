import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @evefrontier/dapp-kit ships raw TypeScript source, must be transpiled.
  // The package is loaded with ssr:false via ChainProviders to avoid Vite import.meta.env issues.
  transpilePackages: ["@evefrontier/dapp-kit"],
};

export default nextConfig;
