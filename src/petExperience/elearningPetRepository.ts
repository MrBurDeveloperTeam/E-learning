// PHASE 6E (Virtual Pet migration): this file is the LOCAL persistence
// adapter connecting the shared `@mrburdeveloperteam/molar-experience/pet`
// runtime to E-Learning's OWN existing database. It implements the
// package's `PetRepository` interface — the shared runtime only ever
// calls these methods, never `supabase` directly. Every query here is
// moved mechanically from `VirtualPet/context/GameStateContext.tsx` (and
// `VirtualPetContainer.tsx`'s catalog/currency lookups) — confirmed
// byte-identical to the source the shared package's own `pet.js` runtime
// was itself ported from (verified directly against the installed
// `dist/pet.js`: identical decay rates, XP_TO_LEVEL_UP, level-up reward,
// soap/soap2 exclusion, toy-quantity-clamped-to-1, bed energyGain
// fallback, adoption seeding, and inventory delete-then-insert sync), so
// this is the same table/column/mapping shape used across every other
// migrated app in this session, not a rewrite:
//   - inventory_pet     (pet stats/identity snapshot, one row per user)
//   - pet_inventory     (owned items, full delete-then-insert sync)
//   - aiboard_pricing_items      (flat shop catalog)
//   - aiboard_pricing_currencies (currency code -> rate lookup)
//
// This is intentionally the ONLY file in E-Learning that imports both
// `@mrburdeveloperteam/molar-experience/contracts` types and the Supabase
// client for pet data — the shared package itself must never see any of
// these table names.
import type { PetRepository } from '@mrburdeveloperteam/molar-experience/contracts';
import type { FoodItem, PetInventoryItem, PetSaveSnapshot } from '@mrburdeveloperteam/molar-experience/contracts';
import { supabase } from '../lib/supabase';

type PricingItemRow = {
  item_id: string;
  name: string;
  emoji?: string | null;
  category_id?: string | null;
  base_price_usd?: string | number | null;
  hunger?: number | null;
  happiness?: number | null;
  hygiene?: number | null;
  energy_gain?: number | null;
  image_src?: string | null;
  unlock_level?: number | null;
};

type PetInventoryRow = {
  item_id: string;
  quantity: number;
};

type InventoryPetRow = {
  pet_name: string | null;
  hunger: number | null;
  energy: number | null;
  happiness: number | null;
  hygiene: number | null;
  level: number | null;
  xp: number | null;
  coins: number | null;
  is_sleeping: boolean | null;
  active_ball_id: string | null;
  active_bed_id: string | null;
  updated_at: string | null;
};

export const elearningPetRepository: PetRepository = {
  async loadSnapshot(userId: string): Promise<PetSaveSnapshot | null> {
    const { data, error } = await supabase
      .from('inventory_pet')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // A query error is NOT the same state as "no row exists yet" — the
      // caller (Shared's hydration effect) treats a `null` return as
      // "genuinely new user" and resets to starter stats/no-adopted-pet,
      // including wiping the local cache. Collapsing a transient
      // network/RLS/timeout failure into that same `null` was silently
      // resetting real accounts back to a fresh pet on any hiccup.
      // Throwing instead lets it hit Shared's own load `catch` block,
      // which — unlike the `!petData` branch — is a pure no-op logger:
      // it does not touch `hasAdoptedPet`/stats/localStorage, so whatever
      // state was already hydrated from the local cache earlier in the
      // same effect is left standing instead of being overwritten.
      console.error('[elearningPetRepository] Failed to load inventory_pet:', error);
      throw error;
    }
    if (!data) return null;

    const row = data as InventoryPetRow;
    return {
      globalUserId: userId,
      stats: {
        hunger: row.hunger ?? 100,
        energy: row.energy ?? 100,
        happiness: row.happiness ?? 100,
        hygiene: row.hygiene ?? 100,
        level: row.level ?? 1,
        xp: row.xp ?? 0,
        coins: row.coins ?? 100,
      },
      identity: {
        // Empty string means "not adopted yet" — matches the runtime's
        // exact falsy check against the original `pet_name` column.
        petName: row.pet_name ?? '',
        selectedPetId: row.pet_name ?? '',
        isSleeping: !!row.is_sleeping,
        activeBallId: row.active_ball_id ?? null,
        activeBedId: row.active_bed_id ?? null,
      },
      updatedAt: row.updated_at ?? new Date(0).toISOString(),
    };
  },

  async saveSnapshot(snapshot: PetSaveSnapshot): Promise<void> {
    // Atomic snapshot upsert RPC (Phase
    // SNABBB-SHARED-VIRTUAL-PET-COINS-CONCURRENCY-HARDENING) — replaces
    // the prior raw `.upsert()`, which wrote `coins` as an absolute
    // value on every call, including this routine debounced call that
    // fires on ANY stat change (not just coin activity). See
    // public.save_pet_snapshot's own definition: `coins` is accepted
    // only to seed a brand-new row on first adoption and is otherwise a
    // guaranteed no-op — coins are managed exclusively by
    // `mutateCoins`/`purchasePetItem`'s atomic deltas below.
    const { error } = await supabase.rpc('save_pet_snapshot', {
      p_pet_name: snapshot.identity.petName || null,
      p_hunger: snapshot.stats.hunger,
      p_energy: snapshot.stats.energy,
      p_happiness: snapshot.stats.happiness,
      p_hygiene: snapshot.stats.hygiene,
      p_level: snapshot.stats.level,
      p_xp: snapshot.stats.xp,
      p_coins: snapshot.stats.coins,
      p_is_sleeping: snapshot.identity.isSleeping,
      p_active_ball_id: snapshot.identity.activeBallId,
      p_active_bed_id: snapshot.identity.activeBedId,
    });
    if (error) throw error;
  },

  async loadInventoryRows(userId: string): Promise<PetInventoryItem[]> {
    const { data, error } = await supabase
      .from('pet_inventory')
      .select('item_id, quantity')
      .eq('user_id', userId);

    if (error) {
      // Same ERROR != EMPTY reasoning as loadSnapshot above: this is only
      // ever awaited (pet.js) inside the same outer hydration try/catch
      // that already safely absorbs a rejected loadSnapshot — a rejection
      // here skips `setInventory(newInv)` entirely rather than replacing
      // the already-hydrated (local-cache-derived) inventory with an
      // empty one, so a transient failure can no longer be mistaken for
      // "this account genuinely owns no items."
      console.error('[elearningPetRepository] Failed to load pet_inventory:', error);
      throw error;
    }

    return (data as PetInventoryRow[]).map((row) => ({ itemId: row.item_id, quantity: row.quantity }));
  },

  async saveInventory(userId: string, items: PetInventoryItem[]): Promise<void> {
    // Single atomic upsert+prune RPC (Phase
    // SNABBB-VIRTUAL-PET-INVENTORY-ATOMICITY-AUDIT-AND-HARDENING) —
    // replaces the prior delete-then-insert two-request sequence, which
    // could leave this user's inventory empty if the process failed
    // between the delete and the insert. See public.save_pet_inventory's
    // own definition for the full rationale: it upserts every incoming
    // item (never destroying a row for an item this snapshot didn't
    // know about — e.g. one another app/tab just added) and only prunes
    // rows for items absent from this list, all inside one transaction.
    // `auth.uid()` is derived server-side from the caller's own
    // session — this repository has no way to write another user's
    // inventory even if `userId` here were wrong.
    const { error } = await supabase.rpc('save_pet_inventory', {
      p_items: items.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
    });
    if (error) throw error;
  },

  async mutateInventoryItem(userId: string, itemId: string, delta: number): Promise<number> {
    // Atomic, item-level increment/decrement (Phase
    // SNABBB-SHARED-VIRTUAL-PET-CROSS-APP-CONCURRENCY-HARDENING) — the
    // narrow persistence path SharedPetRuntime now uses for buyItem/
    // consumeItem instead of the full-list saveInventory above. See
    // public.mutate_pet_inventory_item's own definition: a single
    // `UPDATE ... SET quantity = quantity + delta` under Postgres's own
    // row lock, so concurrent calls for the SAME item from another
    // app/tab never lose an update, and calls for a DIFFERENT item
    // never contend at all (they touch a different row). `auth.uid()`
    // is derived server-side — this repository has no way to mutate
    // another user's inventory even if `userId` here were wrong.
    const { data, error } = await supabase.rpc('mutate_pet_inventory_item', {
      p_item_id: itemId,
      p_delta: delta,
    });
    if (error) throw error;
    return data as number;
  },

  async mutateCoins(userId: string, delta: number): Promise<number> {
    // Atomic coin earn/spend (Phase
    // SNABBB-SHARED-VIRTUAL-PET-COINS-CONCURRENCY-HARDENING) — a single
    // `UPDATE ... SET coins = coins + delta` under Postgres's own row
    // lock, the same pattern mutateInventoryItem uses for items. Fails
    // (throws) rather than silently clamping when a spend would take
    // the balance below 0. `auth.uid()` is derived server-side — this
    // repository has no way to mutate another user's balance even if
    // `userId` here were wrong.
    const { data, error } = await supabase.rpc('mutate_pet_coins', {
      p_delta: delta,
    });
    if (error) throw error;
    return data as number;
  },

  async purchasePetItem(userId: string, itemId: string, price: number): Promise<{ coins: number; quantity: number }> {
    // One shop purchase as one transaction (Phase
    // SNABBB-SHARED-VIRTUAL-PET-COINS-CONCURRENCY-HARDENING): validates
    // affordability, deducts coins, and grants the item all inside
    // public.purchase_pet_item, so a purchase can never leave coins
    // deducted without the item (or vice versa), and two concurrent
    // purchases can never both succeed against a balance that can only
    // cover one of them.
    const { data, error } = await supabase.rpc('purchase_pet_item', {
      p_item_id: itemId,
      p_price: price,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { coins: row.out_coins, quantity: row.out_quantity };
  },

  async loadCatalog(): Promise<FoodItem[]> {
    const { data, error } = await supabase
      .from('aiboard_pricing_items')
      .select('item_id, name, emoji, category_id, base_price_usd, hunger, happiness, hygiene, energy_gain, image_src, unlock_level')
      .order('unlock_level', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.error('[elearningPetRepository] Failed to load aiboard_pricing_items:', error);
      return [];
    }

    return (data as PricingItemRow[]).map((row) => ({
      id: row.item_id,
      icon: row.emoji || '🍽️',
      label: row.name,
      hunger: row.hunger ?? 10,
      happiness: row.happiness ?? 0,
      hygiene: row.hygiene ?? 0,
      energyGain: row.energy_gain ?? 0,
      imageSrc: row.image_src || undefined,
      xp: Math.max(1, Math.round(Math.max(row.hunger ?? 0, row.happiness ?? 0, row.hygiene ?? 0, row.energy_gain ?? 0, 2) / 2)),
      price: parseFloat(String(row.base_price_usd ?? 0)) || 0,
      category: row.category_id
        ? row.category_id.charAt(0).toUpperCase() + row.category_id.slice(1)
        : 'Other',
      levelReq: row.unlock_level ?? 1,
    }));
  },

  async loadCurrencyRate(currencyCode: string): Promise<{ code: string; rate: number } | null> {
    const { data, error } = await supabase
      .from('aiboard_pricing_currencies')
      .select('currency_code, rate')
      .ilike('currency_code', currencyCode)
      .maybeSingle();

    if (error || !data) return null;
    return { code: data.currency_code, rate: Number(data.rate) || 1 };
  },
};
