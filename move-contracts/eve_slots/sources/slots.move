/// Eve Frontier Slot Terminal — on-chain contract
///
/// Generic over any Coin<T> so it works with Coin<EVE> on Utopia testnet
/// and any future currency without redeployment.
///
/// Rake: 8 % total (200 bps → mini jackpot, 100 bps → major, 50 bps → grand,
///       450 bps → house).  RTP target: 92 %.
///
/// Jackpot triggers (any active payline, all 5 positions match):
///   Mini  (type 1) — 5× M3  (symbol index 5)
///   Major (type 2) — 5× H1  (index 7) OR 5× W (index 8)
///   Grand (type 3) — 5× SC  (index 9)
///
/// Randomness: sui::random — spin() is an entry function to prevent
/// PTB-based re-roll attacks.

module eve_slots::slots;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::random::Random;
use sui::event;

// ─── Error codes ─────────────────────────────────────────────────────────────
const EInvalidLines: u64 = 0;
const EInsufficientHouseBalance: u64 = 1;
const EInvalidJackpotType: u64 = 2;

// ─── Rake config (basis points, 10 000 = 100 %) ───────────────────────────────
const MINI_JP_BPS: u64  = 200;   // 2 %
const MAJOR_JP_BPS: u64 = 100;   // 1 %
const GRAND_JP_BPS: u64 = 50;    // 0.5 %

// ─── Symbol indices (matching frontend lib/engine/symbols.ts) ─────────────────
const SYM_M1: u8 = 3;
const SYM_M2: u8 = 4;
const SYM_M3: u8 = 5;
const SYM_M4: u8 = 6;  // Seer — mid-wild, substitutes for M1/M2/M3
const SYM_H1: u8 = 7;
const SYM_W:  u8 = 8;  // Wild — substitutes for all non-scatter/non-W anchors
const SYM_SC: u8 = 9;  // Scatter

// ─── Reel strip (all 5 reels identical, 80 stops) ────────────────────────────
// S1×18, S2×14, S3×10, M1×10, M2×7, M3×5, M4×5, H1×4, W×4, SC×3 = 80
const REEL_LEN: u64 = 80;
const REEL: vector<u8> = vector[
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,   // S1 ×18
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,             // S2 ×14
    2,2,2,2,2,2,2,2,2,2,                     // S3 ×10
    3,3,3,3,3,3,3,3,3,3,                     // M1 ×10
    4,4,4,4,4,4,4,                            // M2 ×7
    5,5,5,5,5,                                // M3 ×5
    6,6,6,6,6,                                // M4 ×5
    7,7,7,7,                                  // H1 ×4
    8,8,8,8,                                  // W  ×4
    9,9,9,                                    // SC ×3
];

// ─── Structs ──────────────────────────────────────────────────────────────────
public struct AdminCap has key { id: UID }

public struct SlotHouse<phantom T> has key {
    id: UID,
    house_balance:  Balance<T>,
    mini_jackpot:   Balance<T>,
    major_jackpot:  Balance<T>,
    grand_jackpot:  Balance<T>,
    total_spins:    u64,
    total_wagered:  u64,
    total_paid:     u64,
}

// ─── Events ───────────────────────────────────────────────────────────────────
public struct SpinResult has copy, drop {
    player:               address,
    total_bet:            u64,
    /// Flat 15-byte grid: reel0_row0, reel0_row1, reel0_row2, reel1_row0, ...
    grid:                 vector<u8>,
    line_payout:          u64,
    scatter_count:        u8,
    scatter_payout:       u64,
    jackpot_type:         u8,   // 0 = none, 1 = mini, 2 = major, 3 = grand
    jackpot_payout:       u64,
    total_payout:         u64,
    mini_jackpot_balance: u64,
    major_jackpot_balance:u64,
    grand_jackpot_balance:u64,
}

// ─── Module init ──────────────────────────────────────────────────────────────
fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

// ─── Admin functions ──────────────────────────────────────────────────────────

/// Deploy a new SlotHouse. Call once; the object becomes shared.
/// house_seed: initial house operating balance (covers payouts before rake accrues)
/// mini/major/grand: seed amounts for each jackpot pool
public entry fun create_house<T>(
    _: &AdminCap,
    house_seed:  Coin<T>,
    mini_seed:   Coin<T>,
    major_seed:  Coin<T>,
    grand_seed:  Coin<T>,
    ctx: &mut TxContext,
) {
    transfer::share_object(SlotHouse<T> {
        id:             object::new(ctx),
        house_balance:  coin::into_balance(house_seed),
        mini_jackpot:   coin::into_balance(mini_seed),
        major_jackpot:  coin::into_balance(major_seed),
        grand_jackpot:  coin::into_balance(grand_seed),
        total_spins:    0,
        total_wagered:  0,
        total_paid:     0,
    });
}

/// Top up house operating balance.
public entry fun deposit_house<T>(_: &AdminCap, house: &mut SlotHouse<T>, funds: Coin<T>) {
    balance::join(&mut house.house_balance, coin::into_balance(funds));
}

/// Top up a jackpot pool. jackpot_type: 1 = mini, 2 = major, 3 = grand.
public entry fun deposit_jackpot<T>(
    _: &AdminCap,
    house: &mut SlotHouse<T>,
    funds: Coin<T>,
    jackpot_type: u8,
) {
    assert!(jackpot_type >= 1 && jackpot_type <= 3, EInvalidJackpotType);
    let bal = coin::into_balance(funds);
    if (jackpot_type == 1)      balance::join(&mut house.mini_jackpot,  bal)
    else if (jackpot_type == 2) balance::join(&mut house.major_jackpot, bal)
    else                        balance::join(&mut house.grand_jackpot,  bal);
}

// ─── Spin ─────────────────────────────────────────────────────────────────────

/// Entry point for a player spin. Uses sui::random for provably fair RNG.
/// `lines`  — number of active paylines (1–5)
/// `bet`    — coin covering exactly (lines × credits_per_line) in base units
///
/// The function is `entry` to prevent PTB-based re-roll attacks on the
/// randomness result.
public entry fun spin<T>(
    house: &mut SlotHouse<T>,
    rand:  &Random,
    bet:   Coin<T>,
    lines: u8,
    ctx:   &mut TxContext,
) {
    assert!(lines >= 1 && lines <= 5, EInvalidLines);

    let total_bet = coin::value(&bet);
    let cpl = total_bet / (lines as u64);   // credits-per-line in base units

    // ── Rake split ────────────────────────────────────────────────────────────
    let mut bet_bal    = coin::into_balance(bet);
    let mini_take      = total_bet * MINI_JP_BPS  / 10000;
    let major_take     = total_bet * MAJOR_JP_BPS / 10000;
    let grand_take     = total_bet * GRAND_JP_BPS / 10000;

    balance::join(&mut house.mini_jackpot,  balance::split(&mut bet_bal, mini_take));
    balance::join(&mut house.major_jackpot, balance::split(&mut bet_bal, major_take));
    balance::join(&mut house.grand_jackpot, balance::split(&mut bet_bal, grand_take));
    balance::join(&mut house.house_balance, bet_bal);   // remainder (house + rounding)

    // ── Draw grid ─────────────────────────────────────────────────────────────
    let mut gen  = rand.new_generator(ctx);
    let grid     = draw_grid(&mut gen);

    // ── Evaluate ──────────────────────────────────────────────────────────────
    let (line_payout, jackpot_type) = evaluate_lines(&grid, lines, cpl);
    let (scatter_count, scatter_payout) = evaluate_scatter(&grid, total_bet);

    // ── Jackpot payout ────────────────────────────────────────────────────────
    let jackpot_payout = if (jackpot_type == 1) {
        let amt = balance::value(&house.mini_jackpot);
        let win = balance::split(&mut house.mini_jackpot, amt);
        balance::join(&mut house.house_balance, win);
        amt
    } else if (jackpot_type == 2) {
        let amt = balance::value(&house.major_jackpot);
        let win = balance::split(&mut house.major_jackpot, amt);
        balance::join(&mut house.house_balance, win);
        amt
    } else if (jackpot_type == 3) {
        let amt = balance::value(&house.grand_jackpot);
        let win = balance::split(&mut house.grand_jackpot, amt);
        balance::join(&mut house.house_balance, win);
        amt
    } else { 0 };

    let total_payout = line_payout + scatter_payout + jackpot_payout;

    // ── Pay player ────────────────────────────────────────────────────────────
    if (total_payout > 0) {
        assert!(balance::value(&house.house_balance) >= total_payout, EInsufficientHouseBalance);
        let payout_coin = coin::from_balance(
            balance::split(&mut house.house_balance, total_payout),
            ctx,
        );
        transfer::public_transfer(payout_coin, ctx.sender());
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    house.total_spins   = house.total_spins   + 1;
    house.total_wagered = house.total_wagered + total_bet;
    house.total_paid    = house.total_paid    + total_payout;

    event::emit(SpinResult {
        player:                ctx.sender(),
        total_bet,
        grid:                  flatten_grid(&grid),
        line_payout,
        scatter_count,
        scatter_payout,
        jackpot_type,
        jackpot_payout,
        total_payout,
        mini_jackpot_balance:  balance::value(&house.mini_jackpot),
        major_jackpot_balance: balance::value(&house.major_jackpot),
        grand_jackpot_balance: balance::value(&house.grand_jackpot),
    });
}

// ─── View functions ───────────────────────────────────────────────────────────
public fun jackpot_balances<T>(house: &SlotHouse<T>): (u64, u64, u64) {
    (
        balance::value(&house.mini_jackpot),
        balance::value(&house.major_jackpot),
        balance::value(&house.grand_jackpot),
    )
}

public fun house_balance<T>(house: &SlotHouse<T>): u64 {
    balance::value(&house.house_balance)
}

public fun stats<T>(house: &SlotHouse<T>): (u64, u64, u64) {
    (house.total_spins, house.total_wagered, house.total_paid)
}

// ─── Internal: RNG ────────────────────────────────────────────────────────────
use sui::random::RandomGenerator;

fun draw_grid(gen: &mut RandomGenerator): vector<vector<u8>> {
    let mut grid = vector[];
    let mut r = 0u8;
    while (r < 5) {
        let stop = gen.generate_u64_in_range(0, REEL_LEN - 1);
        let s0 = *REEL.borrow(stop);
        let s1 = *REEL.borrow((stop + 1) % REEL_LEN);
        let s2 = *REEL.borrow((stop + 2) % REEL_LEN);
        grid.push_back(vector[s0, s1, s2]);
        r = r + 1;
    };
    grid
}

fun flatten_grid(grid: &vector<vector<u8>>): vector<u8> {
    let mut flat = vector[];
    let mut r = 0u64;
    while (r < 5) {
        let reel = grid.borrow(r);
        flat.push_back(*reel.borrow(0));
        flat.push_back(*reel.borrow(1));
        flat.push_back(*reel.borrow(2));
        r = r + 1;
    };
    flat
}

// ─── Internal: payline evaluation ────────────────────────────────────────────

/// Returns (total_line_payout, highest_jackpot_type)
fun evaluate_lines(grid: &vector<vector<u8>>, lines: u8, cpl: u64): (u64, u8) {
    let mut total   = 0u64;
    let mut jackpot = 0u8;
    let mut li = 0u8;
    while (li < lines) {
        let cells = payline_cells(grid, li);
        let (pay, jp) = evaluate_one_line(&cells, cpl);
        total = total + pay;
        if (jp > jackpot) jackpot = jp;
        li = li + 1;
    };
    (total, jackpot)
}

/// Extract the 5 cells for payline `line` (0-indexed).
fun payline_cells(grid: &vector<vector<u8>>, line: u8): vector<u8> {
    let rows = payline_rows(line);
    let mut cells = vector[];
    let mut r = 0u64;
    while (r < 5) {
        let row = (*rows.borrow(r)) as u64;
        cells.push_back(*grid.borrow(r).borrow(row));
        r = r + 1;
    };
    cells
}

fun payline_rows(line: u8): vector<u8> {
    if      (line == 0) vector[0,0,0,0,0]
    else if (line == 1) vector[1,1,1,1,1]
    else if (line == 2) vector[2,2,2,2,2]
    else if (line == 3) vector[0,1,2,1,0]
    else                vector[2,1,0,1,2]
}

/// Returns (best_payout, jackpot_type) for a single 5-cell payline.
/// Anchors tried: S1=0, S2=1, S3=2, M1=3, M2=4, M3=5, H1=7, W=8
fun evaluate_one_line(cells: &vector<u8>, cpl: u64): (u64, u8) {
    let anchors = vector[0u8, 1u8, 2u8, 3u8, 4u8, 5u8, 7u8, 8u8];
    let mut best_pay = 0u64;
    let mut jackpot  = 0u8;
    let mut ai = 0u64;

    while (ai < 8) {
        let anchor = *anchors.borrow(ai);

        // Count consecutive left-to-right matches
        let mut count = 0u8;
        let mut ci    = 0u64;
        while (ci < 5) {
            if (cell_matches((*cells.borrow(ci)), anchor)) {
                count = count + 1;
                ci = ci + 1;
            } else break
        };

        if (count >= 3) {
            // Verify at least one genuine anchor symbol is in the run
            if (has_required_actual(anchor, cells, count)) {
                let pay = line_pay(anchor, count) * cpl;
                if (pay > best_pay) best_pay = pay;

                // Jackpot triggers only on 5-of-a-kind
                if (count == 5) {
                    if (anchor == SYM_M3) {
                        if (jackpot < 1) jackpot = 1;            // Mini
                    } else if (anchor == SYM_H1 || anchor == SYM_W) {
                        if (jackpot < 2) jackpot = 2;            // Major
                    }
                }
            }
        };

        ai = ai + 1;
    };

    // Grand jackpot: all 5 cells are SC (scatter)
    if (all_scatter(cells)) jackpot = 3;

    (best_pay, jackpot)
}

fun cell_matches(sym: u8, anchor: u8): bool {
    if (sym == SYM_SC)  return false;
    if (sym == anchor)  return true;
    // Wild substitutes for any non-wild anchor
    if (anchor != SYM_W && sym == SYM_W)  return true;
    // Seer substitutes for mid anchors (M1/M2/M3)
    if ((anchor == SYM_M1 || anchor == SYM_M2 || anchor == SYM_M3) && sym == SYM_M4) return true;
    false
}

fun has_required_actual(anchor: u8, cells: &vector<u8>, count: u8): bool {
    if (anchor == SYM_W) return true;   // all-wild run is valid for W anchor
    let mut i = 0u64;
    while (i < (count as u64)) {
        let s = *cells.borrow(i);
        if (anchor == SYM_M1) {
            if (s == SYM_M1 || s == SYM_M4) return true;
        } else {
            if (s == anchor) return true;
        };
        i = i + 1;
    };
    false
}

fun all_scatter(cells: &vector<u8>): bool {
    let mut i = 0u64;
    while (i < 5) {
        if (*cells.borrow(i) != SYM_SC) return false;
        i = i + 1;
    };
    true
}

/// Per-symbol line-pay multipliers × cpl (credits per line).
fun line_pay(anchor: u8, count: u8): u64 {
    if      (anchor == 0) { if (count == 3) 3   else if (count == 4) 12   else 45    }
    else if (anchor == 1) { if (count == 3) 7   else if (count == 4) 30   else 100   }
    else if (anchor == 2) { if (count == 3) 15  else if (count == 4) 75   else 250   }
    else if (anchor == 3) { if (count == 3) 20  else if (count == 4) 100  else 400   }
    else if (anchor == 4) { if (count == 3) 50  else if (count == 4) 250  else 1000  }
    else if (anchor == 5) { if (count == 3) 100 else if (count == 4) 500  else 2000  }
    else if (anchor == 7) { if (count == 3) 250 else if (count == 4) 1250 else 5000  }
    else if (anchor == 8) { if (count == 5) 10000 else 0 }   // W — 5× only
    else 0
}

// ─── Internal: scatter evaluation ────────────────────────────────────────────

/// Count scatter symbols across all 15 cells and return (count, payout).
/// Scatter pays multiply total_bet (any position, independent of paylines).
fun evaluate_scatter(grid: &vector<vector<u8>>, total_bet: u64): (u8, u64) {
    let mut count = 0u8;
    let mut r = 0u64;
    while (r < 5) {
        let reel = grid.borrow(r);
        let mut row = 0u64;
        while (row < 3) {
            if (*reel.borrow(row) == SYM_SC) count = count + 1;
            row = row + 1;
        };
        r = r + 1;
    };
    let mult: u64 = if      (count >= 5) 50
                    else if (count == 4) 20
                    else if (count == 3) 5
                    else if (count == 2) 2
                    else                 0;
    (count, mult * total_bet)
}
