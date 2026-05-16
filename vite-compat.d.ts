// Shim for @evefrontier/dapp-kit which references Vite's import.meta.env.
// In Next.js this is never populated but the types must satisfy the compiler.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
