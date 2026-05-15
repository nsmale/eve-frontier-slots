# EVE Frontier Slots

A 5-reel, 3-row slot machine themed around EVE Frontier.

**Stage 1** — proof of concept with fake credits, no blockchain.

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:coverage` | Tests + coverage report |

## Requirements

- Node LTS (see `.nvmrc` — use `nvm use`)
- pnpm 11+

## Deploy

Auto-deployed to Vercel on push to `main`. Preview deploys on all other branches.

## Stages

- **Stage 1** (current): Fake credits, client-side PRNG, SVG placeholder symbols, scatter pays
- **Stage 2**: Real LUX wagering on Sui testnet, jackpot, free spins
- **Stage 3**: EVE Frontier art, sound, mainnet deploy

See [SPEC.md](SPEC.md) for full product requirements.
