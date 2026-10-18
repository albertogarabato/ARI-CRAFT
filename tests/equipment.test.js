import test from "node:test";
import assert from "node:assert/strict";
import { World, BLOCKS } from "../js/world.js";
import { Player } from "../js/player.js";
import { Journey } from "../js/connected.js";
import {
  Inventory,
  RECIPES,
  miningDuration,
  practiceStrike,
  placeBlock,
  mineBlock,
} from "../js/inventory.js";
import {
  encodeJourney,
  decodeState,
  prepareCommit,
  SaveConflict,
} from "../js/firebase.js";
function fixture() {
  const w = new World(),
    j = new Journey({ world: w, player: new Player(w) }),
    bag = new Inventory({ creative: false });
  j.world.expand();
  j.world.addPlaces();
  j.village.enableMatch();
  return { j, bag };
}
test("0.9 inventories gain empty new slots without changing counts, molds or hotbar", () => {
  const b = new Inventory();
  const old = {
    counts: Array(18).fill(0),
    slots: [10, 14, 9, 4, 1, 2, 3, 6, 7],
    selected: 1,
    creative: false,
    shape: "arch",
  };
  old.counts[10] = 23;
  b.restore(old);
  assert.equal(b.counts.length, BLOCKS.length);
  assert.deepEqual(b.counts.slice(0, 18), old.counts);
  assert.deepEqual(b.counts.slice(18), [0, 0, 0]);
  assert.equal(b.activeTool, "hand");
  assert.equal(b.shape, "arch");
  assert.deepEqual(b.slots, old.slots);
});
test("tools consume their exact recipe once, equip separately and accelerate matching materials", () => {
  const b = new Inventory({ creative: false });
  b.counts[11] = 2;
  b.counts[3] = 2;
  const before = b.snapshot();
  assert.equal(b.craftTool("pickaxe"), false);
  assert.deepEqual(b.snapshot(), before);
  b.counts[3] = 3;
  assert.equal(b.craftTool("pickaxe"), true);
  assert.equal(b.counts[3], 0);
  assert.equal(b.counts[11], 0);
  assert.equal(b.type, 1);
  assert.equal(miningDuration(b, 3), BLOCKS[3].time / 3);
  assert.equal(miningDuration(b, 4), BLOCKS[4].time);
  assert.equal(b.craftTool("pickaxe"), true);
  assert.deepEqual(b.tools, ["pickaxe"]);
  assert.equal(b.equipTool("sword"), false);
  b.creative = true;
  assert.equal(b.equipTool("sword"), true);
  b.creative = false;
  assert.equal(b.activeTool, "hand");
  assert.equal(b.equipTool("pickaxe"), true);
  for (const [tool, block] of [
    ["axe", 4],
    ["shovel", 9],
  ]) {
    b.counts[11] = 2;
    b.counts[3] = 3;
    assert.ok(b.craftTool(tool));
    assert.equal(miningDuration(b, block), BLOCKS[block].time / 3);
  }
});
test("new recipes are atomic and glass/torch/target placement can be mined back", () => {
  const w = new World(),
    p = new Player(w),
    b = new Inventory({ creative: false });
  for (const type of [10, 18, 19, 20]) {
    const recipe = RECIPES.find((r) => r.type === type);
    b.counts.fill(0);
    const old = b.snapshot();
    assert.equal(b.craft(recipe), false);
    assert.deepEqual(b.snapshot(), old);
    for (const [t, n] of recipe.cost) b.counts[t] = n;
    assert.ok(b.craft(recipe));
    assert.equal(b.counts[type], recipe.quantity);
    w.set(10, 24, 10, 3);
    const hit = { x: 10, y: 24, z: 10, normal: [0, 1, 0] };
    assert.ok(placeBlock(w, b, p, hit));
    assert.equal(b.counts[type], recipe.quantity - 1);
    assert.ok(mineBlock(w, b, { x: 10, y: 25, z: 10, type }));
    assert.equal(b.counts[type], recipe.quantity);
  }
});
test("torches need a base and single-block mold, remain non-solid and stay protected on the pitch", () => {
  const { j, bag: b } = fixture();
  b.equip(18);
  b.counts[18] = 4;
  const hit = { x: 0, y: 24, z: 0, normal: [0, 1, 0] };
  assert.equal(placeBlock(j.world, b, j.player, hit), false);
  assert.equal(b.counts[18], 4);
  j.world.set(0, 24, 0, 3);
  b.shape = "arch";
  assert.equal(placeBlock(j.world, b, j.player, hit), false);
  b.shape = "cube";
  assert.ok(placeBlock(j.world, b, j.player, hit));
  assert.equal(j.world.solid(0, 25, 0), false);
  j.player.position = { x: 0.5, y: 25, z: 0.5 };
  assert.equal(j.player.collides(), false);
  assert.equal(
    placeBlock(j.world, b, j.player, { x: 110, y: 8, z: 6, normal: [0, 1, 0] }),
    false,
  );
});
test("practice sword only scores on a nearby target, preserves blocks and quantities", () => {
  const { j, bag: b } = fixture();
  j.world.set(0, 25, 0, 20);
  const hit = { x: 0, y: 25, z: 0, distance: 2 };
  assert.equal(practiceStrike(j.world, b, hit), false);
  b.creative = true;
  b.equipTool("sword");
  assert.ok(practiceStrike(j.world, b, hit));
  assert.equal(b.trainingHits, 1);
  assert.equal(j.world.get(0, 25, 0), 20);
  assert.equal(practiceStrike(j.world, b, { ...hit, distance: 4 }), false);
  assert.equal(practiceStrike(j.world, b, { ...hit, x: 1 }), false);
  assert.equal(b.trainingHits, 1);
});
test("format 10 roundtrip preserves tools, hits, old buildings, goals and new objects in all regions", () => {
  const { j, bag: b } = fixture();
  b.counts[11] = 2;
  b.counts[3] = 3;
  b.craftTool("pickaxe");
  b.trainingHits = 17;
  b.counts[18] = 9;
  j.village.football.score = [5, 2];
  for (const x of [0, 48, 90, -64, 224]) j.world.set(x, 25, 0, 18);
  for (const [x, t] of [
    [0, 19],
    [64, 20],
    [128, 18],
  ])
    j.world.set(x, 25, 64, t);
  j.world.set(1, 25, 0, 6);
  const state = encodeJourney(j, b);
  assert.equal(state.version, 10);
  const loaded = decodeState(state);
  assert.deepEqual(loaded.inventory.snapshot(), b.snapshot());
  assert.deepEqual(loaded.journey.snapshot(), j.snapshot());
  assert.equal(loaded.world.get(1, 25, 0), 6);
  for (const bad of [
    { tool: "hack" },
    { tools: ["pickaxe", "pickaxe"] },
    { trainingHits: -1 },
    { counts: Array(19).fill(0) },
  ]) {
    const copy = structuredClone(state);
    Object.assign(copy.inventory, bad);
    assert.throws(() => decodeState(copy));
  }
});
test("upgrade retains immutable pre-10 backup and rejects stale writes", () => {
  const { j, bag } = fixture();
  const old = encodeJourney(j, bag);
  old.version = 9;
  old.inventory.counts = old.inventory.counts.slice(0, 18);
  delete old.inventory.tools;
  delete old.inventory.tool;
  delete old.inventory.trainingHits;
  const current = { revision: 3, commit: "old", state: old },
    data = { sandbox04: current, backupBefore09: { json: "kept" } };
  const state = encodeJourney(j, decodeState(old).inventory),
    entry = { base: 3, commit: "new", state };
  const patch = prepareCommit(data, entry);
  assert.deepEqual(JSON.parse(patch.backupBefore10.json), old);
  assert.equal(patch.backupBefore09, undefined);
  assert.equal(data.backupBefore09.json, "kept");
  assert.equal(
    prepareCommit({ ...data, ...patch }, { base: 4, commit: "next", state })
      .backupBefore10,
    undefined,
  );
  assert.throws(
    () => prepareCommit({ ...data, ...patch }, { ...entry, commit: "stale" }),
    SaveConflict,
  );
  function check(v, parentArray = false) {
    if (Array.isArray(v)) {
      assert.equal(parentArray, false);
      for (const child of v) check(child, true);
    } else if (v && typeof v === "object")
      for (const child of Object.values(v)) check(child);
  }
  check(patch);
});
