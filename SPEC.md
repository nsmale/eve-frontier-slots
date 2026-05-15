# EVE Frontier Slot Machine — Build Spec

> **For:** Claude Code (autonomous build agent)
> **Project name (working):** `eve-frontier-slots`
> **Owner:** Nathan (nathan@emfarsis.com)
> **Last updated:** 2026-05-15

---

## 0. How to use this document

This spec is the single source of truth for the build. It is delivered in **three stages**. Each stage is independently shippable and must pass its **Acceptance Criteria** before the next stage begins.

**Important rules for the build agent:**

1. Implement Stage 1 fully and ship it before touching Stage 2.
2. Do not pre-build Stage 2/3 features into Stage 1 (no wallet stubs, no jackpot UI scaffolding). Stage 1 should be runnable with zero blockchain dependencies.
3. Keep the **win evaluation engine** identical across stages — Stage 1 builds it in TypeScript, Stage 2 ports the canonical version into Move and the TS version becomes a client-side simulator/validator.
4. After each stage, open a PR with a checklist matching the Acceptance Criteria.
5. When in doubt, ask the human owner before adding scope. Do not invent features.

---

## 1. Product summary

A 5-reel, 3-row slot machine themed around **EVE Frontier** (a space-survival game by CCP). Players bet across up to 5 paylines using credits. Credits are fake in Stage 1; in Stage 2+ they are backed by **LUX**, EVE Frontier's on-chain in-game currency on the Sui blockchain. Features include a global progressive jackpot, free-spin scatter bonuses, provably-fair on-chain randomness (Sui native `sui::random`), and a stats dashboard.

**Token model:**

- **Wagering currency: LUX** — `Coin<LUX>` on Sui. Players hold LUX in EVE Vault (the official EVE Frontier wallet) and connect it to the dApp to wager. LUX is what EVE players already use for "most in-game transactions, purchases, trades, and services" per CCP's docs.
- **Architecture: LUX-only at launch.** No multi-token complexity in Stage 2. The contract is structured so a second token (EVE Token, $SUI, alliance tokens) could be added later as a separate game instance or a config-level change, but this is **out of scope** for Stages 1–3.
- **Deployment shape: standalone Sui dApp.** A Vercel-hosted website with EVE Vault wallet connect. The dApp is *not* deployed as a Smart Storage Unit (SSU) extension in Stage 2/3 — see §12 for SSU as future work.

---

## 2. Repository & deployment conventions

| Item | Value |
|---|---|
| Repo | New public GitHub repo: `github.com/nsmale/eve-frontier-slots` |
| Default branch | `main` (protected; PRs only) |
| Branch naming | `stage-1/<feature>`, `stage-2/<feature>`, `stage-3/<feature>` |
| Commit style | Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) |
| Web framework | **Next.js 14+ (App Router) + TypeScript + Tailwind CSS** |
| Package manager | `pnpm` |
| Node version | LTS (pin via `.nvmrc`) |
| Linting | ESLint (Next.js preset) + Prettier |
| Testing | Vitest for unit (game engine), Playwright for E2E (one happy-path spin per stage) |
| Smart contract (Stage 2+) | Sui Move, in `/move/` subfolder |
| Frontend hosting | Vercel team `nsmale-emf` — auto-deploy `main` to production, all other branches to preview. **No custom domain** — use Vercel's `*.vercel.app` URL. |
| Smart contract networks | Stage 2: Sui **testnet** · Stage 3: Sui **mainnet** |
| Wallet adapter | `@mysten/dapp-kit` — **EVE Vault is Sui Wallet Standard-compliant**, so dapp-kit detects it automatically alongside Sui Wallet, Suiet, Phantom Sui. EVE Vault is the **primary target** because that's where players hold LUX. |
| Env vars | `.env.example` committed; never commit real secrets. Use Vercel env vars + a separate `.env.local` for dev. |
| CI | GitHub Actions: lint + test on every PR. Required to pass before merge. |

### 2.1 Folder structure (target)

```
/eve-frontier-slots
├── app/                  # Next.js App Router
│   ├── page.tsx          # Slot machine UI
│   ├── api/              # (Stage 2+) read-only chain queries, if needed
│   └── admin/            # (Stage 2+) admin dashboard
├── components/           # React components
├── lib/
│   ├── engine/           # Win evaluation, reel strips, paytable
│   ├── rng/              # Stage 1: seeded PRNG · Stage 2: wraps on-chain
│   └── sui/              # (Stage 2+) chain client, dapp-kit wiring
├── public/symbols/       # SVG placeholders (Stage 1) → EVE art (Stage 3)
├── public/sounds/        # (Stage 3) sound effects
├── move/                 # (Stage 2+) Sui Move package
│   ├── sources/
│   ├── tests/
│   └── Move.toml
├── scripts/
│   └── rtp-sim.ts        # Simulation harness for tuning RTP
├── tests/
├── SPEC.md               # This file
├── README.md
└── package.json
```

---

## 3. Tech stack rationale (in scope to question, but defaults below)

- **Next.js App Router** — server components for the global stats panel (reads from chain in Stage 2), client components for the reel UI. Best-fit for Vercel.
- **Tailwind** — fast theming swap in Stage 3.
- **Framer Motion** — reel spin animation. Lightweight, well-supported.
- **Zustand** — minimal client state (balance, lines, credits, current spin). No need for Redux.
- **`@mysten/dapp-kit` + `@mysten/sui`** (Stage 2+) — official Sui SDK & wallet adapter. Players connect via **EVE Vault** (Sui Wallet Standard-compliant; see `github.com/evefrontier/evevault`).
- **Move** for the contract. Sui's `sui::random` module provides validator-attested randomness.
- **Vitest** — fast unit tests for the game engine, which is the most security-critical TS code.

---

## 4. Game design — canonical reference

### 4.1 Grid

5 reels × 3 visible rows = 15 visible symbol positions per spin.

### 4.2 Symbols (10 total)

| ID | Tier | Stage 1 placeholder | Stage 3 theme | Target reel-stop frequency |
|---|---|---|---|---|
| `S1` | Low | Blue circle "SHIP-1" | Spaceship A | ~16.25% |
| `S2` | Low | Green circle "SHIP-2" | Spaceship B | ~16.25% |
| `S3` | Low | Yellow circle "SHIP-3" | Spaceship C | ~16.25% |
| `S4` | Low | Orange circle "SHIP-4" | Spaceship D | ~16.25% |
| `M1` | Mid | Purple hex "TRIBE-1" | Faction logo A | ~7.67% |
| `M2` | Mid | Pink hex "TRIBE-2" | Faction logo B | ~7.67% |
| `M3` | Mid | Teal hex "TRIBE-3" | Faction logo C | ~7.67% |
| `H1` | High | Gold star "STAR" | Rare star/artifact | ~5% |
| `W`  | Wild | Black diamond "WILD" | Wild symbol | ~3% |
| `SC` | Scatter | Red ring "SCATTER" | Scatter symbol | ~3% |

Frequencies above are **targets** — exact reel-strip distributions are tuned via simulation in section 9 to hit 92% RTP within ±0.5%.

### 4.3 Paylines (numbered 1–5)

```
Line 1 (Top):      row 0, row 0, row 0, row 0, row 0
Line 2 (Middle):   row 1, row 1, row 1, row 1, row 1
Line 3 (Bottom):   row 2, row 2, row 2, row 2, row 2
Line 4 (V):        row 0, row 1, row 2, row 1, row 0
Line 5 (Inv-V):    row 2, row 1, row 0, row 1, row 2
```

(`row 0` = top, `row 2` = bottom.) Wins are evaluated **left-to-right only**, must start at reel 1, must be **consecutive**.

### 4.4 Betting

- Player picks **1–5 lines** (lines are activated in order: 1, 1+2, 1+2+3, …)
- Player picks **1, 5, or 10 credits per line**
- Total bet = `lines × credits_per_line` (max 50)
- 1 credit = configurable **LUX** amount (admin-set in Stage 2+; Stage 1 just shows "credits")

### 4.5 Paytable

Payouts are multipliers of **credits-per-line**. Scatter pays are multipliers of **total bet**.

| Match | Symbol class | Payout (× credits-per-line) |
|---|---|---|
| 3-of-a-kind | Low (S1–S4) | 5 |
| 4-of-a-kind | Low | 25 |
| 5-of-a-kind | Low | 100 |
| 3-of-a-kind | Mid (M1–M3) | 15 |
| 4-of-a-kind | Mid | 75 |
| 5-of-a-kind | Mid | 300 |
| 3-of-a-kind | High (H1) | 50 |
| 4-of-a-kind | High | 250 |
| 5-of-a-kind | High (non-jackpot) | 1000 |
| 5 Wilds | Wild | 2500 |

> **Initial values — final values to be confirmed by RTP simulation in section 9.**

Scatter pays (× total bet, position-independent):

| Scatters | Payout | Free spins |
|---|---|---|
| 2 | 2× total bet | — |
| 3 | 5× total bet | 8 |
| 4 | 20× total bet | 12 |
| 5 | 50× total bet | 20 |

Wild substitutes for everything **except** Scatter. A line of `[H1, H1, H1, W, W]` pays as 5× H1.

**Per spin, the player wins the SUM of all line wins + scatter pay (if applicable) + jackpot (if triggered).** Multiple paylines hitting wins all pay independently.

### 4.6 Progressive jackpot

- One global pool, shared across all players.
- 2% of every player bet (and 2% of free-spin equivalent bet, paid from house) is added.
- Trigger: 5× **H1 (Star)** on **line 2 (middle)** while betting **max** (10 credits/line × 5 lines = 50 credits).
- Payout: 100% of the pool. Pool resets to 0.
- Admin can manually top up at any time. No auto-seed.
- The 1000× H1 5-of-a-kind line payout does **not** apply on a jackpot-triggering spin — the player gets the jackpot **instead** (this is the standard convention; reject ambiguity).
- Visible in the UI at all times. Live-ticked from chain state in Stage 2+.

### 4.7 Free spins

- 3+ scatters anywhere triggers free spins (3 → 8, 4 → 12, 5 → 20).
- Free spins reuse the triggering spin's line/credit configuration.
- Free spin payouts come from the house bankroll, not the player.
- Free spins can re-trigger more free spins. **Hard cap: 50 total spins per chain** (i.e., if a chain exceeds 50, additional re-triggers are ignored).
- Free spins still contribute 2% to the jackpot pool, paid from house.

### 4.8 RTP & volatility

- **Target RTP: 92% (±0.5%)**
- **House edge: 8%**
- Volatility: medium
- Win-frequency targets:

| Category | Frequency |
|---|---|
| Any win | ~30% of spins |
| Small win (1–5× total bet) | ~22% |
| Medium win (5–50× total bet) | ~6% |
| Large win (50–500× total bet) | ~0.8% |
| Huge win (500×+ total bet) | ~0.05% |

Section 9 specifies how this is verified.

---

## 5. Stage 1 — Proof of Concept

**Goal:** A playable, Vercel-hosted slot machine using fake credits, client-side randomness, and SVG placeholder symbols. No wallet, no chain, no jackpot, no free spins.

### 5.1 In scope

1. Next.js + TypeScript + Tailwind project, pnpm, ESLint, Prettier, Vitest set up.
2. 5×3 reel grid component with spin animation (Framer Motion). Reels stop left-to-right with a 200ms stagger.
3. 10 SVG placeholder symbols in `/public/symbols/` (simple colored shapes + text labels per table in 4.2).
4. Reel strips (one per reel — 5 strips total) built from the target frequency table. Use a seeded PRNG (`mulberry32` or similar) for determinism in tests; in production Stage 1 use `crypto.getRandomValues`.
5. Win evaluation engine (`lib/engine/evaluate.ts`):
   - Input: `{ grid: SymbolId[5][3], lines: 1..5, creditsPerLine: 1|5|10 }`
   - Output: `{ lineWins: LineWin[], scatterCount: number, totalPayout: number }`
   - Implements all rules in 4.3–4.5 **including wild substitution**.
   - Pure function, fully unit-tested.
6. Betting controls:
   - Lines selector (1–5) — toggleable, with visual highlight overlay on the grid showing which lines are active.
   - Credits-per-line selector (1, 5, 10).
   - Total bet readout.
   - Spin button — disabled when balance < total bet or while a spin is animating.
7. Player credit balance: starts at **1000**, in Zustand store. Persists across page reloads via `sessionStorage` (per the artifact restrictions note — sessionStorage is fine in a regular Next.js app; this restriction only applies to in-chat artifacts).
8. Win display: line wins flash on the grid, total win shown in the HUD. Tiered win animation states: `none` / `win` / `bigWin (>100× credits-per-line)`. **No jackpot animation tier in Stage 1.**
9. In-memory stats panel (resets on page reload in Stage 1):
   - Spins this session
   - Total credits wagered
   - Total credits won
   - Biggest win
10. Expandable paytable component showing all values from 4.5.
11. **NOT in Stage 1**: scatter pays, free spins, jackpot, wallet, chain, persistent stats, sound, EVE branding.
12. Deploy to Vercel. Auto-deploy on push to `main`.
13. README with run/dev/test instructions.

### 5.2 Stage 1 acceptance criteria

- [ ] `pnpm dev` runs the app locally without error.
- [ ] `pnpm test` passes; engine has ≥95% line coverage.
- [ ] Manual test: 5 lines × 10 credits spin from a balance of 1000 deducts 50, animates 5 reels, displays a grid, evaluates wins per the paytable.
- [ ] Wild substitution test: a known grid produces the expected payout (write at least one Vitest case for each of: low-3, low-5, mid-4-with-wild, high-5-non-wild).
- [ ] All 5 payline shapes are highlightable and used in evaluation.
- [ ] Vercel preview URL produces an identical experience to local.
- [ ] PR opened with this checklist, merged to `main`, deployed.

---

## 6. Stage 2 — On-chain LUX, jackpot, free spins

**Goal:** Replace fake credits with real **LUX** wagering on Sui testnet. Add the full bonus and jackpot mechanics. Move randomness on-chain.

> **Open question for Stage 2 kick-off:** confirm whether LUX exists on Sui **testnet** today. If LUX is mainnet-only, Stage 2 testnet builds a `Coin<TestLUX>` mock with identical decimals and treats it as LUX for integration testing. Real `Coin<LUX>` swaps in for Stage 3 mainnet. This decision does not change the contract — both are generic `Coin<T>`.

### 6.1 Smart contract (Sui Move)

Package: `eve_slots`. Modules:

- `game::config` — admin-settable parameters: credit-to-LUX rate, paused flag, paytable references. (Single-token at launch; the supported-token registry pattern is future work — see §12.)
- `game::bankroll` — house bankroll vault. Admin deposit/withdraw. **Rejects bets when bankroll < max possible payout** (max = jackpot pool + max 5-wild line pay × max lines + max scatter pay).
- `game::jackpot` — segregated jackpot pool. Receives 2% of every bet. Admin top-up. Pays out on trigger. Resets to 0 after hit.
- `game::engine` — pure win evaluation (Move port of the TS engine). **This module's logic must match the TS engine exactly.**
- `game::spin` — entry function `spin(bet, lines, credits_per_line, &Random, ctx)`:
  1. Validate inputs.
  2. Check not paused; check bankroll covers max payout.
  3. Pull bet from player wallet → split: 2% to jackpot, 98% to bankroll (temporarily).
  4. Draw reel positions using `sui::random::Random`. **Outcome is committed inside this single tx** — no commit/reveal pattern needed because `sui::random` is validator-attested.
  5. Run `engine::evaluate`. Compute total payout including jackpot if triggered.
  6. Pay player from bankroll. If jackpot won, drain pool and pay.
  7. If scatter free spins triggered, emit `FreeSpinGranted` event with count & player.
  8. Emit `SpinResult` event with full grid, line wins, payout, txn hash (implicit).
- `game::free_spin` — tracks player's free-spin balance. `free_spin` entry function: same as `spin` but skips bet deduction, still adds house-paid 2% to jackpot. Re-trigger logic with 50-spin chain cap.
- `game::admin` — admin-only entries for bankroll deposit/withdraw, jackpot top-up, pause/unpause, set credit-to-LUX rate.

### 6.1.1 Stage 2 launch parameters (confirmed)

| Parameter | Value | Notes |
|---|---|---|
| Admin wallet (testnet) | `0xaf6cff92853f16919ef55a79d69034aa104ed3936a43ffe1fd288596131b628c` | Single-sig acceptable on testnet; upgrade to multi-sig before mainnet |
| Initial credit-to-LUX rate | Target **~$0.10 USD-equivalent per credit** | Admin sets the actual `LUX_per_credit` value at deploy. Because LUX is an in-game currency, its "USD value" is whatever the player market sets — admin picks a defensible number at launch. Re-settable any time via `game::admin::set_credit_rate`. Store in MIST-equivalent base units to avoid float math. |
| Initial jackpot seed | **~$10 USD-equivalent in LUX** | Admin tops up via `game::admin::topup_jackpot` immediately after deploy. |

The `/admin` page shows the current credit rate in LUX with an editable input. Optional helper: fetch a community LUX/USD reference (if a public oracle or trade aggregator exists in the EVE Frontier ecosystem) to suggest a rate — admin always confirms manually.

### 6.2 Contract type signature (single-token launch)

The Stage 2 contract is generic over `Coin<T>` internally (parameterized by token type) but is **instantiated as `Coin<LUX>` only** at launch. This keeps the code clean and audit-friendly while leaving the door open to a multi-token future (see §12). No supported-token registry is built in Stage 2 — adding a second token later is a deliberate contract upgrade or a parallel deployment, not a config flip.

### 6.3 Security requirements

- Use `sui::random::Random` — no client-supplied entropy.
- All entry functions are atomic — outcome cannot be aborted by inspecting result mid-tx (Sui transactions are atomic by default; nonetheless explicitly do not branch on randomness in a way that allows partial state observation).
- Bankroll cannot pay out more than it holds; check max payout up front.
- Jackpot pool is a separate object — cannot be drained by normal payouts.
- Pause flag halts new spins but does not affect existing free-spin chains.
- Admin keys must be **multi-sig for mainnet** (Stage 3). Stage 2 testnet can use single-sig.
- Move tests covering: bankroll exhaustion rejection, jackpot trigger, free-spin re-trigger cap, wild substitution, scatter pays, paused-state rejection.

### 6.4 Frontend additions

- Wallet connection via `@mysten/dapp-kit` (auto-detects EVE Vault, Sui Wallet, Suiet, Phantom Sui — **EVE Vault is the primary**).
- **LUX balance display** (from player's connected wallet) — replaces fake credit balance.
- Pre-spin tx confirmation. Post-spin tx hash with link to Sui explorer (testnet).
- **Live jackpot ticker** — read from chain every 5s (or via event subscription) and animate the LUX number.
- **Global stats dashboard** (real, on-chain):
  - Total spins, unique players, lines played, LUX wagered, total LUX paid out, current jackpot.
- Scatter and jackpot win animations.
- Free-spin counter overlay during free spins.
- Admin page at `/admin` — gated to admin wallet only. Deposit/withdraw bankroll (LUX), top up jackpot, pause/unpause, set credit-to-LUX rate.

### 6.5 Stage 2 acceptance criteria

- [ ] Move package compiles and tests pass (`sui move test`).
- [ ] Deployed to Sui testnet; package ID committed to `.env.example`.
- [ ] EVE Vault wallet connect → bet → spin → result → tx hash flow works end-to-end on testnet with `Coin<LUX>` (or `Coin<TestLUX>` mock if real LUX isn't on testnet).
- [ ] Jackpot accumulates from real bets; admin top-up works.
- [ ] Free spins trigger correctly from scatters; re-trigger cap honored.
- [ ] Bankroll-exhaustion rejection works (simulate by draining bankroll).
- [ ] Live jackpot ticker reflects on-chain state within 10s.
- [ ] Admin page is hard-gated by wallet address.
- [ ] **RTP simulation (section 9) hits 92% ±0.5% over 10M spins.** Results committed to `/scripts/rtp-results.json`.

---

## 7. Stage 3 — EVE branding, audit, mainnet

**Goal:** Production launch. Replace placeholders with EVE Frontier art, add polish, audit, mainnet deploy.

### 7.1 In scope

- Replace all 10 SVG placeholders with EVE Frontier-themed art (4 ships, 3 faction logos, 1 rare star, wild, scatter). **Assets to be supplied by Nathan.**
- EVE Frontier color palette, typography, space-themed background. Asset list TBD with Nathan.
- ~8 sound effects: reel spin, reel stop, small win, big win, jackpot, scatter trigger, free-spin loop, ambient. **Assets supplied later, royalty-free.** Sound toggle in UI.
- **Win animation pack** (visual, separate from sound): pair each sound trigger with a visual effect. Minimum set:
  - Small win: line flash + coin-shower particles around win symbols (1s)
  - Big win (>100×): screen shake, gold glow border, animated win count-up, larger particle burst (2–3s)
  - Jackpot: full-screen takeover with starfield zoom, animated "JACKPOT" lockup, confetti or asteroid-shower effect (3–5s, dismissible)
  - Scatter trigger: scatter symbols pulse and orbit briefly before the free-spin intro card animates in
  - Free-spin loop: subtle starfield drift in the background while free spins are active
  - Use Framer Motion + a lightweight particle lib (e.g. `tsparticles`) — no heavy WebGL unless explicitly added later
- Responsive design: desktop-first, tablet (iPad-class) supported. Mobile-phone layout is **out of scope** unless explicitly added.
- Smart contract migration to **multi-sig admin**.
- **Professional smart contract audit** — firm to be booked by Nathan later. Recommended: OtterSec or Zellic (both have strong Sui Move track records). Audit must complete and all critical/high findings resolved or formally accepted before mainnet deploy.
- Math model re-validation post-tuning: 10M+ spin sim within ±0.5% of 92% RTP.
- Deploy Move package to Sui **mainnet**.
- Production Vercel deployment. **No custom domain** — production runs on the Vercel-assigned URL.
- Responsible-gaming / jurisdictional handling is **deferred** — Nathan to address before any real-money flow goes live. The build agent should still scaffold an empty `/legal` route so it can be filled in later without restructuring.

### 7.2 Stage 3 acceptance criteria

- [ ] All placeholder symbols replaced; visual QA pass by Nathan.
- [ ] Sound effects integrated, toggleable, do not autoplay on first load (browser policy).
- [ ] Audit report attached to repo; all critical/high findings resolved.
- [ ] Mainnet deployment verified — one real spin from Nathan's wallet completes.
- [ ] Production Vercel deploy on the assigned `*.vercel.app` URL.
- [ ] Responsive layout works on a 1024px iPad-equivalent.

---

## 8. UI specification (cross-stage)

### 8.1 Primary screen layout (desktop)

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]   Jackpot: 12,345 LUX    Wallet: 0x...abcd  Connect    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│          ┌──────────────────────────────────┐                  │
│          │      5×3 reel grid (animated)    │                  │
│          │      payline overlay on win      │                  │
│          └──────────────────────────────────┘                  │
│                                                                │
│   Lines: [1][2][3][4][5]    Credits/line: [1][5][10]           │
│   Total bet: 50    Balance: 1000        [   SPIN   ]           │
│                                                                │
│   Last win: 250    Tx: 0x… (link)       [ ▾ Paytable ]         │
├────────────────────────────────────────────────────────────────┤
│  Global stats: spins · players · wagered · paid · jackpot      │
└────────────────────────────────────────────────────────────────┘
```

### 8.2 Component checklist

- `<ReelGrid />` — 5×3 grid, spin animation, payline overlay
- `<LineSelector />` — 1–5
- `<CreditSelector />` — 1, 5, 10
- `<BetSummary />` — total bet, balance, spin button
- `<WinDisplay />` — line wins, tiered animation
- `<Paytable />` — expandable
- `<JackpotTicker />` (Stage 2+)
- `<GlobalStats />` (Stage 1 in-memory; Stage 2+ on-chain)
- `<WalletConnect />` (Stage 2+)
- `<FreeSpinOverlay />` (Stage 2+)
- `<AdminDashboard />` (Stage 2+, route-gated)

### 8.3 Animation tiers

| Tier | Trigger | Effect |
|---|---|---|
| `none` | 0 win | no animation |
| `win` | any win | line flashes, win number counts up |
| `bigWin` | win > 100× credits-per-line | screen shake + particle burst |
| `jackpot` | jackpot trigger | full-screen takeover, 3–5s celebration |
| `scatter` | 3+ scatters | scatter symbols pulse, free-spin intro |

---

## 9. RTP simulation (Stage 2 requirement)

A simulation harness at `/scripts/rtp-sim.ts`:

1. Reads the canonical reel strips (same definitions as the contract).
2. Runs **10,000,000 simulated spins** at max bet (50 credits, 5 lines × 10).
3. Records: total wagered, total paid (including free-spin payouts and jackpot hits — model jackpot pool as a rolling figure), win-bucket frequencies.
4. Outputs `/scripts/rtp-results.json` and a markdown summary.
5. **Tuning loop:** if RTP is outside 92% ±0.5%, adjust reel strip counts (not paytable multipliers — those are fixed) and rerun.

**Recommendation: hand this tuning loop to Gemini Pro.** It's a tight numerical iteration that benefits from a fast, cheap model. Hand it the harness, the target, and the current results — it returns updated strip distributions to try.

Final tuned strips are checked into `/lib/engine/reels.ts` and used by both TS and Move (Move version generated via a small codegen script to avoid drift).

---

## 10. Security & compliance

### 10.1 Smart contract threat model

| Threat | Mitigation |
|---|---|
| Manipulated randomness | `sui::random::Random` — validator threshold crypto |
| Predictable outcomes | Random drawn inside same tx as bet commitment |
| Bot inspects & aborts | Sui txns are atomic; no partial-state observation possible |
| Bankroll drain attack | Max-payout check before every spin |
| Jackpot theft | Separate pool object, only emptied on legitimate trigger |
| Admin key compromise | Multi-sig admin on mainnet |
| Reentrancy | Move's resource model prevents traditional reentrancy |
| Front-running spin outcome | Outcome is sealed by validators inside the tx — no MEV vector for the game logic itself |

### 10.2 Operational

- All admin actions emit events; events drive an internal audit log.
- Pause switch exists for emergency.
- Audit required (see Stage 3).
- Legal: **gambling regulatory implications are out of scope for the build agent.** Flag to Nathan to consult counsel before mainnet — operating a real-money slot machine is regulated in most jurisdictions. Consider geo-blocking or playing as a "social casino" with no real-money redemption.

---

## 11. Confirmed launch parameters

All previously-open items are resolved. Build agent: proceed.

| # | Item | Resolution |
|---|---|---|
| 1 | GitHub | `github.com/nsmale/eve-frontier-slots` (public) |
| 2 | Vercel | Team `nsmale-emf` |
| 3 | Custom domain | **None** — use Vercel-assigned URL for all stages |
| 4 | Audit firm | TBD — Nathan books later. Plan around OtterSec / Zellic for scheduling |
| 5 | EVE art assets | To be provided by Nathan during Stage 3. SVG preferred; PNG @2x acceptable |
| 6 | Admin wallet (testnet) | `0xaf6cff92853f16919ef55a79d69034aa104ed3936a43ffe1fd288596131b628c` |
| 7 | Wagering currency | **LUX** (`Coin<LUX>` on Sui). LUX-only at launch; multi-token is future work. |
| 8 | Credit-to-LUX rate | Target **~$0.10 USD-equivalent per credit**. Admin sets actual `LUX_per_credit` at deploy. Re-settable. |
| 9 | Initial jackpot seed | **~$10 USD-equivalent in LUX**, topped up by admin immediately after deploy |
| 10 | Wallet | **EVE Vault** is primary target (Sui Wallet Standard-compliant) — auto-detected by `@mysten/dapp-kit` alongside Sui Wallet, Suiet, Phantom Sui |
| 11 | Sound + win animations | Sound assets supplied later (royalty-free). Win animations: see §7.1 — visual effects per win tier built in Stage 3 |
| 12 | Responsible-gaming / legal | Deferred. Nathan handles before any real-money flow. Build agent scaffolds an empty `/legal` route only. |

**Open at Stage 2 kick-off** (does not block Stage 1):

- Confirm LUX availability on Sui **testnet**. If LUX is mainnet-only today, Stage 2 testnet uses a `Coin<TestLUX>` mock; real `Coin<LUX>` swaps in at Stage 3 mainnet. The contract is the same — only the type parameter changes.

---

## 12. Future / out of scope

- **Multi-token support** — add EVE Token, $SUI, alliance tokens, or player-issued currencies as additional wagering options. Requires a supported-token registry and either parallel game instances per token or per-bet token selection in the UI.
- **Smart Storage Unit (SSU) extension** — deploy a version of the game as an in-world Smart Storage Unit extension using the [evefrontier/builder-scaffold `storage_unit_extension` pattern](https://github.com/evefrontier/builder-scaffold/tree/main/move-contracts/storage_unit_extension). Player walks up to an SSU in-world, pays LUX, gets a "spin result" or a redeemable item. The SSU `deposit_item` / `withdraw_item` API is item-focused, so a clean coin-payout slot is not a direct fit — the most natural pattern is an SSU "kiosk" that hands out a `SlotMachineToken` item which the dApp redeems for the payout. Worth a proper design pass before committing.
- Multiplier wilds, expanding wilds, sticky wilds
- Tournaments / leaderboards
- Gamble (double-or-nothing) feature
- Mobile-phone layout
- Multiple game variants (different reels/themes) on the same contract
- Cross-chain token support (non-Sui)

---

## 13. Glossary

- **RTP** — Return to Player. % of wagers returned as wins over an infinite sample.
- **Volatility** — variance of payouts. Medium = moderate frequency, moderate size.
- **Reel strip** — the ordered list of symbols each reel cycles through; the frequency a symbol appears on a strip determines its hit rate.
- **Wild** — symbol that substitutes for others.
- **Scatter** — symbol that pays regardless of payline position.
- **Payline** — a specific path across the 5 reels that pays for consecutive matching symbols starting at reel 1.
- **Bankroll** — pool of house funds used to pay out wins.
- **LUX** — EVE Frontier's in-game currency, a `Coin<LUX>` on Sui. **The wagering currency for this contract.** Per CCP's docs, LUX is "used for most in-game transactions, purchases, trades, and services."
- **EVE Vault** — EVE Frontier's official Sui Wallet Standard-compliant wallet (web app + Chrome extension). Where players hold LUX. `github.com/evefrontier/evevault`.
- **EVE Token** — separate Sui-based utility token for ecosystem participation, modding, dev rewards. Not used by this contract.
- **$SUI** — native token of the Sui blockchain. Not used by this contract (gas only).
- **SSU (Smart Storage Unit)** — an in-world EVE Frontier object that can host custom Move contract "extensions". Future-work option for in-game deployment — see §12.

---

*End of spec. All launch parameters confirmed — build agent: begin Stage 1.*
