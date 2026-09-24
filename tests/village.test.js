import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory } from "../js/inventory.js";
import { Village, Football, createVillageWorld } from "../js/village.js";
import {
  encodeState,
  decodeState,
  prepareCommit,
  SaveSession,
  SaveConflict,
} from "../js/firebase.js";
function oldGame() {
  const world = new World();
  world.set(-31, 24, 30, 6);
  world.set(0, 8, 0, 0);
  world.set(2, 12, 3, 7);
  const player = new Player(world);
  player.position = { x: 2.5, y: 9, z: 3.5 };
  player.yaw = 0.75;
  player.pitch = -0.45;
  const inventory = new Inventory();
  inventory.counts[4] = 37;
  inventory.selected = 4;
  return encodeState(world, inventory, player);
}
test("an existing game remains byte-identical after visiting, building, scoring and reloading the new region", () => {
  const saved = oldGame(),
    original = JSON.stringify(saved),
    home = decodeState(saved),
    v = new Village();
  const terrain = home.world.base.slice();
  v.world.set(-12, 16, 4, 6);
  v.player.position = { x: 3, y: 9, z: 6 };
  v.football.score = [3, 2];
  const combined = encodeState(
    home.world,
    home.inventory,
    home.player,
    v,
    "village",
  );
  const restored = decodeState(JSON.parse(JSON.stringify(combined)));
  assert.equal(restored.location, "village");
  assert.equal(restored.village.world.get(-12, 16, 4), 6);
  assert.deepEqual(restored.village.football.score, [3, 2]);
  assert.equal(
    JSON.stringify(
      encodeState(restored.world, restored.inventory, restored.player),
    ),
    original,
  );
  assert.deepEqual(restored.world.base, terrain);
  assert.equal(JSON.stringify(saved), original);
  const returned = decodeState(
    encodeState(
      restored.world,
      restored.inventory,
      restored.player,
      restored.village,
      "home",
    ),
  );
  assert.equal(returned.location, "home");
  assert.deepEqual(returned.player.snapshot(), saved.player);
});
test("village generation is deterministic, doors admit the player, and field edits cannot disable football", () => {
  const a = createVillageWorld(),
    b = createVillageWorld();
  assert.deepEqual(a.base, b.base);
  const p = new Player(a);
  p.position = { x: -19.5, y: 9, z: -13.5 };
  assert.equal(p.collides(), false);
  p.position.z = -16;
  assert.equal(p.collides(), false);
  assert.equal(a.set(15, 8, 6, 0), false);
  assert.equal(a.set(15, 10, 6, 4), false);
  assert.equal(a.set(-4, 16, 4, 6), true);
});
test("both goals count once and reload after a goal cannot replay it", () => {
  for (const [z, vz, side] of [
    [-7.9, -13, 0],
    [19.9, 13, 1],
  ]) {
    const f = new Football();
    f.ball = { x: 15, y: 9.5, z, vx: 0, vy: 0, vz };
    assert.equal(f.update(1 / 30), side);
    assert.equal(f.score[side], 1);
    for (let i = 0; i < 240; i++) f.update(1 / 120);
    assert.equal(f.score[side], 1);
    const reloaded = new Football(f.snapshot());
    reloaded.update(1 / 30);
    assert.equal(reloaded.score[side], 1);
  }
});
test("shots outside the goal, high shots and sidelines bounce without goals; distant or obstructed kicks fail", () => {
  for (const [x, y] of [
    [10, 9.5],
    [15, 12],
  ]) {
    const f = new Football();
    f.ball = { x, y, z: -7.9, vx: 0, vy: 0, vz: -13 };
    assert.equal(f.update(1 / 30), null);
    assert.deepEqual(f.score, [0, 0]);
    assert.ok(f.ball.vz > 0);
  }
  const v = new Village(),
    p = v.player;
  assert.equal(v.football.kick(p), false);
  p.position = { x: 15, y: 9, z: 8 };
  p.yaw = 0;
  assert.equal(v.football.kick(p), true);
  assert.ok(v.football.ball.vz < 0);
  p.world = { raycast: () => ({ type: 4 }) };
  assert.equal(v.football.kick(p), false);
});
test("residents stay inside their regions and persist across a reload", () => {
  const v = new Village();
  for (let i = 0; i < 7200; i++) v.update(1 / 120);
  for (const r of v.residents) {
    const p = r.actor.position,
      h = r.home;
    assert.ok(p.x >= h[0] && p.x <= h[1] && p.z >= h[2] && p.z <= h[3]);
    assert.equal(r.actor.collides(), false);
  }
  const restored = new Village(v.snapshot());
  assert.deepEqual(restored.snapshot(), v.snapshot());
});
test("malformed or future expansion data fails closed without changing the original save", () => {
  const saved = oldGame();
  saved.village = new Village().snapshot();
  for (const mutate of [
    (s) => (s.village.version = 999),
    (s) => (s.village.edits = [15, 8, 6, 0]),
    (s) => (s.village.football.score = [-1, 0]),
    (s) => (s.village.residents = []),
    (s) => (s.location = "missing"),
    (s) => (s.village = null),
    (s) => delete s.village.football,
  ]) {
    const copy = structuredClone(saved);
    mutate(copy);
    const before = JSON.stringify(copy);
    assert.throws(() => decodeState(copy));
    assert.equal(JSON.stringify(copy), before);
  }
});
test("first write atomically includes the original backup; subsequent saves retain it and conflicts cannot overwrite it", () => {
  const old = { revision: 7, commit: "old", state: oldGame() },
    data = { sandbox04: old, otherField: "untouched" };
  const original = JSON.stringify(data),
    v = new Village(),
    home = decodeState(old.state);
  const entry = {
    base: 7,
    commit: "next",
    state: encodeState(home.world, home.inventory, home.player, v, "village"),
  };
  const patch = prepareCommit(data, entry);
  assert.deepEqual(patch.backupBefore05, old);
  assert.equal(patch.sandbox04.revision, 8);
  assert.equal(JSON.stringify(data), original);
  const stored = { ...data, ...patch };
  assert.equal(prepareCommit(stored, entry), null);
  const later = prepareCommit(stored, { ...entry, base: 8, commit: "later" });
  assert.equal(later.backupBefore05, undefined);
  assert.deepEqual({ ...stored, ...later }.backupBefore05, old);
  assert.equal({ ...stored, ...later }.otherField, "untouched");
  assert.throws(
    () => prepareCommit(stored, { ...entry, commit: "conflicting" }),
    SaveConflict,
  );
});
test("backup/save failure retains the pending journal and original remote game", async () => {
  let data = { sandbox04: { revision: 1, commit: "old", state: oldGame() } };
  const before = JSON.stringify(data),
    disk = new Map();
  const storage = {
    getItem: (k) => disk.get(k) || null,
    setItem: (k, v) => disk.set(k, v),
    removeItem: (k) => disk.delete(k),
  };
  const session = new SaveSession(
    {
      read: async () => data,
      commit: async (e) => {
        prepareCommit(data, e);
        throw Error("permission denied");
      },
    },
    storage,
    "test",
  );
  const loaded = await session.load();
  session.update({
    ...loaded,
    village: new Village().snapshot(),
    location: "village",
  });
  await assert.rejects(() => session.flush());
  assert.equal(JSON.stringify(data), before);
  assert.ok(disk.get("test"));
  assert.deepEqual(session.backup, data.sandbox04);
});

test("kickoff shot reaches the goal and a mid-flight save reloads without altering the trajectory", () => {
  const v = new Village();
  v.player.position = { x: 15, y: 9, z: 8.4 };
  v.player.yaw = 0;
  assert.equal(v.football.kick(v.player), true);
  for (let i = 0; i < 20; i++) v.football.update(1 / 120);
  const copy = new Football(v.football.snapshot());
  for (let i = 0; i < 600; i++) {
    v.football.update(1 / 120);
    copy.update(1 / 120);
  }
  assert.deepEqual(copy.snapshot(), v.football.snapshot());
  assert.deepEqual(copy.score, [1, 0]);
});
test("unsynced 0.4 progress is retained separately before its journal is replaced", async () => {
  const journal = { base: 2, commit: "offline", state: oldGame() },
    disk = new Map([["a", JSON.stringify(journal)]]);
  const storage = {
    getItem: (k) => disk.get(k) || null,
    setItem: (k, v) => disk.set(k, v),
    removeItem: (k) => disk.delete(k),
  };
  const session = new SaveSession(
    {
      read: async () => ({
        sandbox04: { revision: 2, commit: "remote", state: oldGame() },
      }),
    },
    storage,
    "a",
  );
  await session.load();
  session.update({ ...oldGame(), village: new Village().snapshot() });
  assert.deepEqual(JSON.parse(disk.get("a:before05-journal")), journal);
});
