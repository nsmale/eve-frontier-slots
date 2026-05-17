import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @evefrontier/dapp-kit ships raw TypeScript source, must be transpiled.
  // import.meta.env usage is patched via patches/evefrontier__dapp-kit@0.1.9.patch
  transpilePackages: ["@evefrontier/dapp-kit"],
};

export default nextConfig;
