import test from "node:test";
import assert from "node:assert/strict";
import { World, BLOCKS } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory, RECIPES, placeBlock, mineBlock } from "../js/inventory.js";
import { Journey } from "../js/connected.js";
import {
  decodeState,
  encodeJourney,
  prepareCommit,
  SaveConflict,
  SaveSession,
} from "../js/firebase.js";
import { EXPANSION_LIMIT } from "../js/expansion.js";
function fixture() {
  const world = new World();
  const j = new Journey({ world, player: new Player(world) });
  return { j, bag: new Inventory({ creative: false }) };
}
test("expanding preserves every original and village column, edits, player, residents and score", () => {
  const { j, bag } = fixture();
  j.world.set(0, 25, 0, 6);
  j.world.set(90, 25, 0, 4);
  j.village.football.score = [5, 2];
  bag.counts[4] = 23;
  const old = encodeJourney(j, bag),
    copy = structuredClone(old);
  const home = Array.from(j.home.world.base),
    village = Array.from(j.village.world.base);
  j.world.expand();
  const saved = encodeJourney(j, bag),
    restored = decodeState(saved);
  assert.equal(saved.version, 7);
  assert.equal(saved.connected.version, 2);
  assert.equal((j.world.bounds.maxX - j.world.bounds.minX + 1) * 64, 26624);
  assert.deepEqual(Array.from(restored.world.base), home);
  assert.deepEqual(Array.from(restored.village.world.base), village);
  assert.deepEqual(saved.edits, old.edits);
  assert.deepEqual(saved.village, old.village);
  assert.deepEqual(saved.connected.player, old.connected.player);
  assert.deepEqual(restored.inventory.snapshot(), bag.snapshot());
  assert.deepEqual(old, copy);
});
test("all new blocks, hotbar assignments and finite mode survive saves in every expansion region", () => {
  const { j, bag } = fixture();
  j.world.expand();
  for (const r of j.world.expansion)
    for (let t = 9; t < BLOCKS.length; t++) {
      const x = r.offset + t - 18;
      assert.equal(j.world.set(x, 20, 0, t), true);
    }
  bag.equip(14);
  bag.counts[14] = 27;
  bag.slots[8] = 10;
  j.player.position = { x: -128, y: 9, z: 3 };
  const loaded = decodeState(encodeJourney(j, bag));
  for (const r of j.world.expansion)
    for (let t = 9; t < BLOCKS.length; t++)
      assert.equal(loaded.journey.world.get(r.offset + t - 18, 20, 0), t);
  assert.deepEqual(loaded.journey.player.snapshot(), j.player.snapshot());
  assert.deepEqual(loaded.inventory.snapshot(), bag.snapshot());
});
test("legacy eight-count inventory pads new types without deleting old quantities or changing selection", () => {
  const bag = new Inventory();
  bag.restore({ counts: [0, 1, 2, 3, 4, 5, 6, 7], selected: 4 });
  assert.deepEqual(bag.counts.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(bag.selected, 4);
  assert.ok(bag.counts.slice(8).every((n) => n === 0));
  assert.equal(bag.equip(8), false);
  assert.throws(() =>
    bag.restore({ ...bag.snapshot(), slots: [8, 1, 2, 3, 4, 5, 6, 7, 9] }),
  );
});
test("recipes consume exactly their ingredients and fail atomically on missing resources or full stock", () => {
  const bag = new Inventory({ creative: false });
  const planks = RECIPES.find((r) => r.type === 11);
  let old = bag.snapshot();
  assert.equal(bag.craft(planks), false);
  assert.deepEqual(bag.snapshot(), old);
  bag.counts[4] = 1;
  assert.equal(bag.craft(planks), true);
  assert.equal(bag.counts[4], 0);
  assert.equal(bag.counts[11], 4);
  assert.equal(bag.type, 11);
  bag.counts[4] = 1;
  bag.counts[11] = 99998;
  old = bag.snapshot();
  assert.equal(bag.craft(planks), false);
  assert.deepEqual(bag.snapshot(), old);
  for (const recipe of RECIPES) {
    const inv = new Inventory({ creative: false });
    for (const [t, n] of recipe.cost) inv.counts[t] = n;
    assert.equal(inv.craft(recipe), true);
    assert.equal(inv.counts[recipe.type], recipe.quantity);
    for (const [t] of recipe.cost) assert.equal(inv.counts[t], 0);
  }
  assert.equal(bag.craft({ type: 14, quantity: 99999, cost: [] }), false);
});
test("new blocks consume only in resources mode and can be collected back after placement", () => {
  const { j, bag } = fixture();
  j.world.expand();
  bag.equip(14);
  bag.counts[14] = 1;
  const hit = { x: -64, y: 8, z: 0, type: 1, normal: [0, 1, 0] };
  assert.equal(placeBlock(j.world, bag, j.player, hit), true);
  assert.equal(bag.counts[14], 0);
  assert.equal(placeBlock(j.world, bag, j.player, { ...hit, x: -63 }), false);
  assert.equal(mineBlock(j.world, bag, { x: -64, y: 9, z: 0, type: 14 }), true);
  assert.equal(bag.counts[14], 1);
  bag.creative = true;
  assert.equal(placeBlock(j.world, bag, j.player, hit), true);
  assert.equal(bag.counts[14], 1);
  bag.creative = false;
  assert.equal(j.world.get(-64, 9, 0), 14);
});
test("walk continuously out of the old bounds and back without a portal", () => {
  const { j } = fixture();
  j.world.expand();
  const p = j.player;
  p.position = { x: -30, y: 30, z: -6 };
  for (let i = 0; i < 600; i++) p.update(1 / 120, {});
  p.yaw = Math.PI / 2;
  for (let i = 0; i < 2400; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x < -70);
  assert.ok(!p.collides());
  p.yaw = -Math.PI / 2;
  for (let i = 0; i < 2400; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x > -32);
  assert.ok(!p.collides());
});
test("the pre-expansion backup is atomic, immutable and cannot overwrite a newer revision", () => {
  const { j, bag } = fixture();
  const before = encodeJourney(j, bag);
  j.world.expand();
  const after = encodeJourney(j, bag);
  const current = { revision: 9, commit: "old", state: before },
    data = { sandbox04: current, backupBefore06: { json: "kept" } };
  const entry = { base: 9, commit: "new", state: after },
    patch = prepareCommit(data, entry);
  assert.deepEqual(JSON.parse(patch.backupBefore07.json), before);
  assert.equal(patch.sandbox04.state.version, 7);
  assert.equal(data.backupBefore06.json, "kept");
  assert.equal(data.sandbox04, current);
  const next = { ...data, ...patch };
  assert.equal(
    prepareCommit(next, { base: 10, commit: "next", state: after })
      .backupBefore07,
    undefined,
  );
  assert.equal(prepareCommit(next, entry), null);
  assert.throws(
    () => prepareCommit(next, { ...entry, commit: "other-device" }),
    SaveConflict,
  );
});
test("malformed expansion cannot silently erase terrain edits; new bounds and edit limits are enforced", () => {
  const { j, bag } = fixture();
  j.world.expand();
  const saved = encodeJourney(j, bag);
  for (const bad of [
    null,
    [],
    [[], [], [], null],
    [[], [], [], [0, 20, 0, 8]],
  ]) {
    const state = structuredClone(saved);
    state.connected.expansion = bad;
    assert.throws(() => decodeState(state));
  }
  const bad = structuredClone(saved);
  bad.connected.player.x = 300;
  assert.throws(() => decodeState(bad));
  assert.equal(j.world.set(-161, 10, 0, 14), false);
  const r = j.world.expansion[0];
  for (let i = 0; i < EXPANSION_LIMIT; i++)
    assert.equal(
      r.world.set(-32 + (i % 64), 25 + Math.floor(i / 64), 0, 13),
      true,
    );
  assert.equal(r.world.set(0, 60, 0, 13), false);
  assert.equal(r.world.set(-32, 25, 0, 0), true);
  assert.equal(r.world.set(0, 60, 0, 13), true);
});
test("unsynced 0.6 journal and previous backup survive a failed first expanded save", async () => {
  const { j, bag } = fixture();
  const old = encodeJourney(j, bag);
  const journal = { base: 2, commit: "pending06", state: old };
  const memory = new Map([["save", JSON.stringify(journal)]]);
  const storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  const remote = { sandbox04: { revision: 2, commit: "cloud06", state: old } };
  const session = new SaveSession(
    {
      read: async () => remote,
      commit: async () => {
        throw Error("offline");
      },
    },
    storage,
    "save",
  );
  assert.deepEqual(await session.load(), old);
  assert.deepEqual(JSON.parse(memory.get("save:before07-journal")), journal);
  j.world.expand();
  session.update(encodeJourney(j, bag));
  await assert.rejects(session.flush());
  assert.deepEqual(remote.sandbox04.state, old);
  assert.equal(JSON.parse(memory.get("save")).state.version, 7);
  assert.deepEqual(session.backup.state, old);
});
