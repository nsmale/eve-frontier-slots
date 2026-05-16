import { rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmStore = join(root, "node_modules", ".pnpm");

// Remove any unpatched (phantom) copies of @evefrontier/dapp-kit that pnpm
// may have left behind before the patch was applied. Turbopack can accidentally
// resolve to these leftover directories instead of the patched one.
if (existsSync(pnpmStore)) {
  for (const entry of (await import("fs")).default.readdirSync(pnpmStore)) {
    if (
      entry.startsWith("@evefrontier+dapp-kit") &&
      !entry.includes("patch_hash")
    ) {
      const target = join(pnpmStore, entry);
      rmSync(target, { recursive: true, force: true });
      console.log(`prebuild: removed phantom dapp-kit dir ${entry}`);
    }
  }
}
