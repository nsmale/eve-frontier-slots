/// Eve Frontier Slot Terminal — SSU Extension
///
/// Attaches to a SmartStorageUnit as an authorized extension (SlotAuth witness).
/// Players deposit fuel items from their SSU owned inventory into the house pool,
/// spin against their credited balance, then withdraw back to their SSU owned
/// inventory. From there they bridge to their ship via chain_item_to_game_inventory.
///
/// Access model
/// ─────────────
/// • SlotAuth witness registers this package on the SSU.
/// • SlotConfig (shared) tracks per-character fuel balances (Table<ID, u64>).
/// • All fuel held in the SSU main inventory (owner's slot) as house custody.
/// • Jackpot pools are bookkeeping in SlotConfig — their liquidity is the house fund.
///
/// Rake: 8 % total  (200 bps → mini, 100 bps → major, 50 bps → grand, 450 bps → house)
/// RTP target: 92 %
///
/// Randomness: sui::random — spin() is entry to prevent PTB-based re-roll attacks.

#[allow(unused_const, unused_variable, implicit_const_copy, unused_function)]
module eve_slots::slots;

use sui::{
    event,
    random::{Random, RandomGenerator},
    table::{Self, Table},
};
use world::{
    access::OwnerCap,
    character::Character,
    inventory::{Self, Item},
    storage_unit::{Self, StorageUnit},
};

// ─── Auth witness ─────────────────────────────────────────────────────────────

public struct SlotAuth has drop {}

// ─── Capabilities ─────────────────────────────────────────────────────────────

public struct AdminCap has key { id: UID }

// ─── Config (shared object) ───────────────────────────────────────────────────

public struct SlotConfig has key {
    id: UID,
    /// In-game type_id for the fuel this machine accepts (e.g. EU-90 Fuel = some u64)
    fuel_type_id: u64,
    /// Minimum single deposit (fuel units)
    min_deposit: u64,
    /// Per-character staked balances: character.id() → quantity
    player_balances: Table<ID, u64>,
    /// Jackpot pool bookkeeping (fuel units, covered by house fund in SSU)
    jackpot_mini:  u64,
    jackpot_major: u64,
    jackpot_grand: u64,
    /// Global stats
    total_spins:   u64,
    total_wagered: u64,
    total_paid:    u64,
}

// ─── Events ───────────────────────────────────────────────────────────────────

public struct SpinResult has copy, drop {
    player:           address,
    character_id:     ID,
    /// Flat 15 bytes: reel0_row0, reel0_row1, reel0_row2, reel1_row0, …
    grid:             vector<u8>,
    lines:            u8,
    credits_per_line: u64,
    total_bet:        u64,
    line_payout:      u64,
    scatter_count:    u8,
    scatter_payout:   u64,
    jackpot_type:     u8,   // 0=none 1=mini 2=major 3=grand
    jackpot_payout:   u64,
    total_payout:     u64,
    new_balance:      u64,
    mini_pool:        u64,
    major_pool:       u64,
    grand_pool:       u64,
}

public struct DepositEvent has copy, drop {
    character_id: ID,
    quantity:     u64,
    new_balance:  u64,
}

public struct WithdrawEvent has copy, drop {
    character_id: ID,
    quantity:     u64,
    new_balance:  u64,
}

// ─── Error codes ──────────────────────────────────────────────────────────────

const EInsufficientBalance:  u64 = 0;
const EInsufficientDeposit:  u64 = 1;
const EWrongFuelType:        u64 = 2;
const EInvalidLines:         u64 = 3;

// ─── Constants ────────────────────────────────────────────────────────────────

const MINI_JP_BPS:  u64 = 200;
const MAJOR_JP_BPS: u64 = 100;
const GRAND_JP_BPS: u64 = 50;
const BPS_DENOM:    u64 = 10000;
const MIN_DEPOSIT:  u64 = 100;

// ─── Symbol indices (matching frontend lib/engine/symbols.ts) ─────────────────

const SYM_M1: u8 = 3;
const SYM_M2: u8 = 4;
const SYM_M3: u8 = 5;
const SYM_M4: u8 = 6;   // Seer — mid-wild
const SYM_H1: u8 = 7;
const SYM_W:  u8 = 8;   // Wild
const SYM_SC: u8 = 9;   // Scatter

// ─── Reel strip (80 stops, all 5 reels identical) ────────────────────────────
// S1×18, S2×14, S3×10, M1×10, M2×7, M3×5, M4×5, H1×4, W×4, SC×3 = 80

const REEL_LEN: u64 = 80;
const REEL: vector<u8> = vector[
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,   // S1 ×18
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,            // S2 ×14
    2,2,2,2,2,2,2,2,2,2,                    // S3 ×10
    3,3,3,3,3,3,3,3,3,3,                    // M1 ×10
    4,4,4,4,4,4,4,                           // M2 ×7
    5,5,5,5,5,                               // M3 ×5
    6,6,6,6,6,                               // M4 ×5
    7,7,7,7,                                 // H1 ×4
    8,8,8,8,                                 // W  ×4
    9,9,9,                                   // SC ×3
];

// ─── Init ─────────────────────────────────────────────────────────────────────

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    transfer::share_object(SlotConfig {
        id:              object::new(ctx),
        fuel_type_id:    0,
        min_deposit:     MIN_DEPOSIT,
        player_balances: table::new(ctx),
        jackpot_mini:    0,
        jackpot_major:   0,
        jackpot_grand:   0,
        total_spins:     0,
        total_wagered:   0,
        total_paid:      0,
    });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/// Set the in-game fuel type_id accepted by this machine.
public entry fun setup(
    _: &AdminCap,
    config: &mut SlotConfig,
    fuel_type_id: u64,
) {
    config.fuel_type_id = fuel_type_id;
}

/// Register this extension on the SSU. Call once after publishing.
/// PTB: borrow_owner_cap<StorageUnit> → authorize_on_ssu → return_owner_cap<StorageUnit>
public fun authorize_on_ssu(
    ssu:       &mut StorageUnit,
    owner_cap: &OwnerCap<StorageUnit>,
) {
    storage_unit::authorize_extension<SlotAuth>(ssu, owner_cap);
}

/// Seed the house fund — deposit fuel items directly into the SSU main inventory.
/// Separate from player deposits; used to ensure payout liquidity.
public entry fun seed_house(
    _:         &AdminCap,
    ssu:       &mut StorageUnit,
    character: &Character,
    config:    &SlotConfig,
    item:      Item,
    ctx:       &mut TxContext,
) {
    assert!(item.type_id() == config.fuel_type_id, EWrongFuelType);
    storage_unit::deposit_item<SlotAuth>(ssu, character, item, SlotAuth {}, ctx);
}

// ─── Player: deposit ──────────────────────────────────────────────────────────

/// Accept a fuel item into the house pool and credit the player's balance.
///
/// Expected PTB:
///   1. character::borrow_owner_cap<Character>(character, receiving_ticket) → (cap, receipt)
///   2. storage_unit::withdraw_by_owner<Character>(ssu, character, cap, fuel_type_id, qty) → item
///   3. slots::accept_deposit(ssu, character, config, item)
///   4. character::return_owner_cap<Character>(character, cap, receipt)
public entry fun accept_deposit(
    ssu:       &mut StorageUnit,
    character: &Character,
    config:    &mut SlotConfig,
    item:      Item,
    ctx:       &mut TxContext,
) {
    let qty = item.quantity() as u64;
    assert!(qty >= config.min_deposit, EInsufficientDeposit);
    assert!(item.type_id() == config.fuel_type_id, EWrongFuelType);

    // Move fuel into house custody (SSU main inventory)
    storage_unit::deposit_item<SlotAuth>(ssu, character, item, SlotAuth {}, ctx);

    // Credit player
    let char_id = character.id();
    if (table::contains(&config.player_balances, char_id)) {
        let b = table::borrow_mut(&mut config.player_balances, char_id);
        *b = *b + qty;
    } else {
        table::add(&mut config.player_balances, char_id, qty);
    };

    event::emit(DepositEvent {
        character_id: char_id,
        quantity:     qty,
        new_balance:  *table::borrow(&config.player_balances, char_id),
    });
}

// ─── Player: spin ─────────────────────────────────────────────────────────────

/// Spin the reels. Must be entry (sole tx call) to block PTB re-roll attacks on Random.
/// Bet is (lines × credits_per_line) fuel units, debited from player's balance.
/// Winnings are credited back to player's balance.
public entry fun spin(
    character:        &Character,
    config:           &mut SlotConfig,
    random:           &Random,
    lines:            u8,
    credits_per_line: u64,
    ctx:              &mut TxContext,
) {
    assert!(lines >= 1 && lines <= 5, EInvalidLines);

    let char_id   = character.id();
    let total_bet = (lines as u64) * credits_per_line;

    assert!(table::contains(&config.player_balances, char_id), EInsufficientBalance);
    let balance = table::borrow_mut(&mut config.player_balances, char_id);
    assert!(*balance >= total_bet, EInsufficientBalance);
    *balance = *balance - total_bet;

    // Rake split (bookkeeping; liquidity stays in SSU main inventory)
    let mini_rake  = total_bet * MINI_JP_BPS  / BPS_DENOM;
    let major_rake = total_bet * MAJOR_JP_BPS / BPS_DENOM;
    let grand_rake = total_bet * GRAND_JP_BPS / BPS_DENOM;
    config.jackpot_mini  = config.jackpot_mini  + mini_rake;
    config.jackpot_major = config.jackpot_major + major_rake;
    config.jackpot_grand = config.jackpot_grand + grand_rake;

    // Draw 5×3 grid
    let mut gen = random.new_generator(ctx);
    let grid    = draw_grid(&mut gen);

    // Evaluate paylines and scatter
    let (line_payout, jackpot_type)     = evaluate_lines(&grid, lines, credits_per_line);
    let (scatter_count, scatter_payout) = evaluate_scatter(&grid, total_bet);

    // Jackpot award (clears the pool)
    let jackpot_payout = if (jackpot_type == 1) {
        let p = config.jackpot_mini; config.jackpot_mini = 0; p
    } else if (jackpot_type == 2) {
        let p = config.jackpot_major; config.jackpot_major = 0; p
    } else if (jackpot_type == 3) {
        let p = config.jackpot_grand; config.jackpot_grand = 0; p
    } else { 0 };

    let total_payout = line_payout + scatter_payout + jackpot_payout;

    // Credit winnings
    let bal = table::borrow_mut(&mut config.player_balances, char_id);
    *bal = *bal + total_payout;
    let new_balance = *bal;

    config.total_spins   = config.total_spins   + 1;
    config.total_wagered = config.total_wagered + total_bet;
    config.total_paid    = config.total_paid    + total_payout;

    event::emit(SpinResult {
        player:           ctx.sender(),
        character_id:     char_id,
        grid:             flatten_grid(&grid),
        lines,
        credits_per_line,
        total_bet,
        line_payout,
        scatter_count,
        scatter_payout,
        jackpot_type,
        jackpot_payout,
        total_payout,
        new_balance,
        mini_pool:  config.jackpot_mini,
        major_pool: config.jackpot_major,
        grand_pool: config.jackpot_grand,
    });
}

// ─── Player: withdraw ─────────────────────────────────────────────────────────

/// Move fuel from the house pool back to the player's SSU owned inventory.
/// From there the player bridges to their ship via chain_item_to_game_inventory (in-game).
public entry fun withdraw_fuel(
    ssu:       &mut StorageUnit,
    character: &Character,
    config:    &mut SlotConfig,
    quantity:  u64,
    ctx:       &mut TxContext,
) {
    let char_id = character.id();
    assert!(table::contains(&config.player_balances, char_id), EInsufficientBalance);
    let balance = table::borrow_mut(&mut config.player_balances, char_id);
    assert!(*balance >= quantity, EInsufficientBalance);
    *balance = *balance - quantity;
    let new_balance = *balance;

    // Pull from SSU main inventory (house custody) …
    let item = storage_unit::withdraw_item<SlotAuth>(
        ssu,
        character,
        SlotAuth {},
        config.fuel_type_id,
        quantity as u32,
        ctx,
    );

    // … and deliver to the player's owned SSU inventory
    storage_unit::deposit_to_owned<SlotAuth>(ssu, character, item, SlotAuth {}, ctx);

    event::emit(WithdrawEvent { character_id: char_id, quantity, new_balance });
}

// ─── Views ────────────────────────────────────────────────────────────────────

public fun player_balance(config: &SlotConfig, character_id: ID): u64 {
    if (table::contains(&config.player_balances, character_id)) {
        *table::borrow(&config.player_balances, character_id)
    } else {
        0
    }
}

public fun jackpot_pools(config: &SlotConfig): (u64, u64, u64) {
    (config.jackpot_mini, config.jackpot_major, config.jackpot_grand)
}

public fun global_stats(config: &SlotConfig): (u64, u64, u64) {
    (config.total_spins, config.total_wagered, config.total_paid)
}

// ─── Internal: RNG ────────────────────────────────────────────────────────────

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

// ─── Internal: payline evaluation ─────────────────────────────────────────────

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

fun evaluate_one_line(cells: &vector<u8>, cpl: u64): (u64, u8) {
    let anchors = vector[0u8, 1u8, 2u8, 3u8, 4u8, 5u8, 7u8, 8u8];
    let mut best_pay = 0u64;
    let mut jackpot  = 0u8;
    let mut ai = 0u64;
    while (ai < 8) {
        let anchor = *anchors.borrow(ai);
        let mut count = 0u8;
        let mut ci = 0u64;
        while (ci < 5) {
            if (cell_matches(*cells.borrow(ci), anchor)) { count = count + 1; ci = ci + 1; }
            else break
        };
        if (count >= 3 && has_required_actual(anchor, cells, count)) {
            let pay = line_pay(anchor, count) * cpl;
            if (pay > best_pay) best_pay = pay;
            if (count == 5) {
                if (anchor == SYM_M3 && jackpot < 1) { jackpot = 1; }
                else if ((anchor == SYM_H1 || anchor == SYM_W) && jackpot < 2) { jackpot = 2; }
            }
        };
        ai = ai + 1;
    };
    if (all_scatter(cells)) jackpot = 3;
    (best_pay, jackpot)
}

fun cell_matches(sym: u8, anchor: u8): bool {
    if (sym == SYM_SC) return false;
    if (sym == anchor) return true;
    if (anchor != SYM_W && sym == SYM_W) return true;
    if ((anchor == SYM_M1 || anchor == SYM_M2 || anchor == SYM_M3) && sym == SYM_M4) return true;
    false
}

fun has_required_actual(anchor: u8, cells: &vector<u8>, count: u8): bool {
    if (anchor == SYM_W) return true;
    let mut i = 0u64;
    while (i < (count as u64)) {
        let s = *cells.borrow(i);
        if (anchor == SYM_M1) { if (s == SYM_M1 || s == SYM_M4) return true; }
        else { if (s == anchor) return true; };
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

// Paytable tuned for ~95% base-game RTP (lines + scatter, before jackpot reclaim).
// Must stay in sync with lib/engine/paytable.ts.
fun line_pay(anchor: u8, count: u8): u64 {
    if      (anchor == 0) { if (count == 3) 1   else if (count == 4) 3    else 9    }   // S1
    else if (anchor == 1) { if (count == 3) 2   else if (count == 4) 7    else 22   }   // S2
    else if (anchor == 2) { if (count == 3) 3   else if (count == 4) 16   else 55   }   // S3
    else if (anchor == 3) { if (count == 3) 5   else if (count == 4) 24   else 90   }   // M1
    else if (anchor == 4) { if (count == 3) 11  else if (count == 4) 55   else 220  }   // M2
    else if (anchor == 5) { if (count == 3) 22  else if (count == 4) 110  else 440  }   // M3
    else if (anchor == 7) { if (count == 3) 55  else if (count == 4) 275  else 1100 }   // H1
    else if (anchor == 8) { if (count == 5) 2200 else 0 }                                // W (5-only)
    else 0
}

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
    // Scatter pays × total bet. 2-scatter intentionally pays 0 (was a major RTP leak).
    let mult: u64 = if      (count >= 5) 10
                    else if (count == 4) 3
                    else if (count == 3) 1
                    else                 0;
    (count, mult * total_bet)
}
