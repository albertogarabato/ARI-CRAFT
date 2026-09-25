import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory, SHAPES, placeBlock, mineBlock } from "../js/inventory.js";
import { Journey } from "../js/connected.js";
import {
  encodeJourney,
  decodeState,
  prepareCommit,
  SaveConflict,
} from "../js/firebase.js";
import { PLACES, PLACE_LIMIT } from "../js/places.js";
function fixture() {
  const w = new World(),
    j = new Journey({ world: w, player: new Player(w) });
  j.world.expand();
  j.village.enableMatch();
  return { j, bag: new Inventory({ creative: false }) };
}
test("new destinations preserve old terrain, builds, quantities, selection, football and player position", () => {
  const { j, bag } = fixture();
  j.world.set(0, 25, 0, 6);
  j.world.set(-64, 25, 0, 14);
  j.world.set(224, 25, 0, 15);
  j.village.football.score = [5, 2];
  bag.counts[14] = 19;
  const old = encodeJourney(j, bag),
    terrain = [
      j.home.world,
      j.village.world,
      ...j.world.expansion.map((r) => r.world),
    ].map((w) => [w, Array.from(w.base), w.serialize()]);
  j.world.addPlaces();
  const now = encodeJourney(j, bag);
  assert.equal(now.version, 9);
  assert.equal(now.connected.version, 3);
  for (const [w, base, edits] of terrain) {
    assert.deepEqual(Array.from(w.base), base);
    assert.deepEqual(w.serialize(), edits);
  }
  assert.deepEqual(now.player, old.player);
  assert.deepEqual(now.connected.player, old.connected.player);
  assert.deepEqual(now.village, old.village);
  assert.deepEqual(now.inventory, old.inventory);
  const loaded = decodeState(now);
  assert.equal(loaded.journey.world.get(224, 25, 0), 15);
});
test("scenery is deterministic, visually distinct and buildings are real editable materials", () => {
  const { j } = fixture(),
    { j: k } = fixture();
  j.world.addPlaces();
  k.world.addPlaces();
  for (let i = 0; i < 3; i++)
    assert.deepEqual(
      j.world.places[i].world.base,
      k.world.places[i].world.base,
    );
  const [forest, dunes, bricks] = j.world.places.map((r) => r.world);
  assert.ok(forest.base.filter((t) => t === 5).length > 100);
  assert.ok(dunes.base.filter((t) => t === 9).length > 2000);
  assert.ok(bricks.base.filter((t) => t >= 13 && t <= 17).length > 300);
  assert.equal(bricks.get(-18, 10, 9), 15);
  assert.equal(bricks.get(15, 19, 9), 14);
  assert.ok(bricks.set(-18, 10, 9, 0));
  assert.ok(bricks.set(0, 9, 24, 14));
  const restored = decodeState(encodeJourney(j, new Inventory())).journey.world
    .places[2].world;
  assert.equal(restored.get(-18, 10, 9), 0);
  assert.equal(restored.get(0, 9, 24), 14);
});
test("walk from the old northern edge through all new destinations and back with existing physics", () => {
  const { j } = fixture();
  j.world.addPlaces();
  const p = j.player;
  p.position = { x: 0.5, y: 30, z: 28 };
  for (let i = 0; i < 600; i++) p.update(1 / 120, {});
  function walk(x, z) {
    for (let i = 0; i < 12000; i++) {
      const d = Math.hypot(x - p.position.x, z - p.position.z);
      if (d < 0.15) return;
      p.yaw = Math.atan2(p.position.x - x, p.position.z - z);
      p.update(1 / 120, { forward: 1, sprint: true });
    }
    assert.fail(
      `Route blocked at ${JSON.stringify(p.position)} toward ${x},${z}`,
    );
  }
  walk(0.5, 64);
  assert.equal(j.region, "forest");
  walk(64, 64);
  assert.equal(j.region, "dunes");
  walk(128, 64);
  assert.equal(j.region, "bricks");
  walk(0.5, 64);
  walk(0.5, 28);
  assert.equal(j.region, "home");
  assert.ok(!p.collides());
});
test("northward positions survive reload without corrupting old home and village player anchors", () => {
  const { j, bag } = fixture();
  j.world.addPlaces();
  const oldHome = j.home.player.snapshot(),
    oldVillage = j.village.player.snapshot();
  for (const place of PLACES) {
    j.player.position = { x: place.x, y: 9, z: 64 };
    const loaded = decodeState(encodeJourney(j, bag));
    assert.deepEqual(loaded.journey.player.snapshot(), j.player.snapshot());
    assert.deepEqual(loaded.player.snapshot(), oldHome);
    assert.deepEqual(loaded.village.player.snapshot(), oldVillage);
    assert.equal(loaded.journey.region, place.id);
  }
  const saved = encodeJourney(j, bag);
  saved.connected.player.x = 220;
  assert.throws(() => decodeState(saved));
  assert.equal(j.world.solid(200, 10, 64), true);
});
test("all molds use exact quantities and rotate to the player facing direction", () => {
  for (const [shape, pattern] of Object.entries(SHAPES))
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const w = new World(),
        p = new Player(w),
        bag = new Inventory({ creative: false });
      bag.equip(14);
      bag.shape = shape;
      bag.counts[14] = pattern.cells.length;
      p.yaw = yaw;
      assert.equal(
        placeBlock(w, bag, p, { x: 10, y: 25, z: 10, normal: [0, 1, 0] }),
        true,
      );
      assert.equal(bag.counts[14], 0);
      assert.equal(w.edits.size, pattern.cells.length);
      for (const [key, t] of [...w.edits]) {
        const [x, y, z] = key.split(",").map(Number);
        assert.equal(mineBlock(w, bag, { x, y, z, type: t }), true);
      }
      assert.equal(bag.counts[14], pattern.cells.length);
    }
});
test("molds fail atomically for stock, collisions, protected field, edge or exhausted edit capacity", () => {
  const { j, bag } = fixture();
  j.world.addPlaces();
  bag.equip(14);
  bag.shape = "arch";
  bag.counts[14] = 6;
  const hit = { x: 128, y: 24, z: 64, normal: [0, 1, 0] },
    before = encodeJourney(j, bag);
  assert.equal(placeBlock(j.world, bag, j.player, hit), false);
  assert.deepEqual(encodeJourney(j, bag), before);
  bag.counts[14] = 20;
  j.world.set(129, 27, 64, 3);
  const edits = j.world.places[2].world.serialize();
  assert.equal(placeBlock(j.world, bag, j.player, hit), false);
  assert.deepEqual(j.world.places[2].world.serialize(), edits);
  assert.equal(bag.counts[14], 20);
  assert.equal(
    placeBlock(j.world, bag, j.player, {
      x: 159,
      y: 25,
      z: 64,
      normal: [0, 1, 0],
    }),
    false,
  );
  assert.equal(
    placeBlock(j.world, bag, j.player, {
      x: 100,
      y: 9,
      z: 5,
      normal: [1, 0, 0],
    }),
    false,
  );
  const w = new World();
  let calls = 0;
  const set = w.set.bind(w);
  w.set = (...args) => (args[3] !== 0 && ++calls === 3 ? false : set(...args));
  const stock = bag.snapshot();
  assert.equal(
    placeBlock(w, bag, j.player, { x: 10, y: 25, z: 10, normal: [0, 1, 0] }),
    false,
  );
  assert.equal(w.edits.size, 0);
  assert.deepEqual(bag.snapshot(), stock);
});
test("scenario backups are atomic and invalid or incomplete saves fail closed", () => {
  const { j, bag } = fixture();
  const old = encodeJourney(j, bag);
  j.world.addPlaces();
  const state = encodeJourney(j, bag);
  const data = {
    sandbox04: { revision: 2, commit: "old", state: old },
    backupBefore08: { json: "kept" },
  };
  const patch = prepareCommit(data, { base: 2, commit: "new", state });
  assert.deepEqual(JSON.parse(patch.backupBefore09.json), old);
  assert.equal(data.backupBefore08.json, "kept");
  assert.equal(
    prepareCommit({ ...data, ...patch }, { base: 3, commit: "again", state })
      .backupBefore09,
    undefined,
  );
  assert.throws(
    () =>
      prepareCommit({ ...data, ...patch }, { base: 2, commit: "other", state }),
    SaveConflict,
  );
  for (const places of [
    null,
    [],
    [{}, {}, {}],
    state.connected.places.toReversed(),
  ]) {
    const bad = structuredClone(state);
    bad.connected.places = places;
    assert.throws(() => decodeState(bad));
  }
  const bad = structuredClone(state);
  bad.connected.places[0].edits = [0, 0, 0, 14];
  assert.throws(() => decodeState(bad));
});
test("saved shape and scenario payload contain no nested arrays or lost edits", () => {
  const { j, bag } = fixture();
  j.world.addPlaces();
  bag.shape = "panel";
  j.world.set(128, 25, 64, 15);
  const state = encodeJourney(j, bag);
  const loaded = decodeState(state);
  assert.equal(loaded.inventory.shape, "panel");
  assert.equal(loaded.journey.world.get(128, 25, 64), 15);
  function check(v, array = false) {
    if (Array.isArray(v)) {
      assert.equal(array, false);
      for (const c of v) check(c, true);
    } else if (v && typeof v === "object")
      for (const c of Object.values(v)) check(c);
  }
  check(prepareCommit({}, { base: 0, commit: "first", state }));
});
test("new house doors and paths remain clear of dunes or branches", () => {
  const { j } = fixture();
  j.world.addPlaces();
  for (const [i, x, z] of [
    [0, -20, -16],
    [1, -21, -17],
    [1, 8, -18],
    [2, -22, -17],
    [2, 8, -17],
  ]) {
    const w = j.world.places[i].world,
      p = new Player(w);
    p.position = { x: x + 3.5, y: 9, z: 0.5 };
    p.yaw = 0;
    for (let k = 0; k < 1200 && p.position.z > z + 4; k++)
      p.update(1 / 120, { forward: 1 });
    assert.ok(
      p.position.z < z + 6,
      `Door blocked at ${i}: ${JSON.stringify(p.position)}`,
    );
    assert.ok(!p.collides());
  }
});
