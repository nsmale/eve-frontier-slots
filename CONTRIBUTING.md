# Contributing

## Branch model

- `main` is protected — no direct pushes.
- Work on `stage-1/<feature>`, `stage-2/<feature>`, or `stage-3/<feature>` branches.
- Open a PR against `main`; CI (lint + tests) must pass before merge.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add reel spin animation
fix: wild substitution in 4-of-a-kind
chore: update dependencies
docs: add RTP sim instructions
```

## Tests

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage report
```

The win-evaluation engine (`lib/engine/`) must maintain ≥95% line coverage.

## Dev

```bash
pnpm dev   # http://localhost:3000
pnpm lint
pnpm build
```
