import test from "node:test";
import assert from "node:assert/strict";
import { World, MIN, MAX, HEIGHT, EDIT_LIMIT } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory, mineBlock, placeBlock } from "../js/inventory.js";
import {
  encodeState,
  decodeState,
  migrateLegacy,
  SaveSession,
  SaveConflict,
} from "../js/firebase.js";
const state = () => {
  const w = new World();
  return encodeState(w, new Inventory({ creative: false }), new Player(w));
};
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
function remote() {
  let data = null;
  return {
    read: async () => data,
    commit: async (e) => {
      if (data?.sandbox04.commit === e.commit) return data.sandbox04.revision;
      if ((data?.sandbox04.revision || 0) !== e.base) throw new SaveConflict();
      const revision = e.base + 1;
      data = { sandbox04: { state: e.state, revision, commit: e.commit } };
      return revision;
    },
  };
}
test("deterministic terrain, layers, relief and trees", () => {
  const a = new World(),
    b = new World();
  assert.deepEqual(a.base, b.base);
  assert.notDeepEqual(a.base, new World({ seed: 1 }).base);
  assert.ok(
    new Set(Array.from({ length: 64 }, (_, i) => a.terrainHeight(i - 32, 20)))
      .size > 3,
  );
  const h = a.terrainHeight(0, 0);
  assert.equal(a.get(0, h, 0), 1);
  assert.equal(a.get(0, h - 1, 0), 2);
  assert.equal(a.get(0, h - 3, 0), 3);
  assert.equal(a.get(0, 0, 0), 8);
  assert.ok(a.base.includes(4));
  assert.ok(a.base.includes(5));
});
test("mining, collection, placement, conservation and reload", () => {
  const w = new World(),
    i = new Inventory({ creative: false }),
    p = new Player(w),
    y = w.terrainHeight(1, 1);
  const hit = { x: 1, y, z: 1, type: 1, normal: [0, 1, 0] };
  assert.equal(mineBlock(w, i, hit), true);
  assert.equal(i.counts[1], 1);
  assert.equal(w.get(1, y, 1), 0);
  assert.equal(mineBlock(w, i, hit), false);
  assert.equal(i.counts[1], 1);
  assert.equal(
    placeBlock(w, i, p, { x: 1, y: y - 1, z: 1, normal: [0, 1, 0] }),
    true,
  );
  assert.equal(i.counts[1], 0);
  assert.equal(w.edits.size, 0);
  assert.equal(
    placeBlock(w, i, p, { x: 1, y, z: 1, normal: [0, 1, 0] }),
    false,
  );
  mineBlock(w, i, hit);
  assert.equal(placeBlock(w, i, p, { x: 2, y, z: 1, normal: [0, 1, 0] }), true);
  const restored = decodeState(encodeState(w, i, p));
  assert.equal(restored.world.get(1, y, 1), 0);
  assert.equal(restored.world.get(2, y + 1, 1), 1);
  assert.deepEqual(restored.inventory.snapshot(), i.snapshot());
});
test("cannot place inside the player or occupied cells, or mine bedrock", () => {
  const w = new World(),
    i = new Inventory({ creative: false }),
    p = new Player(w);
  i.add(1);
  assert.equal(
    placeBlock(w, i, p, { x: 0, y: 8, z: 3, normal: [0, 1, 0] }),
    false,
  );
  assert.equal(i.counts[1], 1);
  assert.equal(
    placeBlock(w, i, p, { x: 1, y: 7, z: 1, normal: [0, 1, 0] }),
    false,
  );
  assert.equal(mineBlock(w, i, { x: 0, y: 0, z: 0, type: 8 }), false);
});
test("DDA targets exposed surfaces, range and axis aligned rays", () => {
  const w = new World();
  assert.equal(
    w.raycast({ x: 0.5, y: 12, z: 0.5 }, { x: 0, y: -1, z: 0 }).y,
    8,
  );
  assert.equal(
    w.raycast({ x: 0.5, y: 20, z: 0.5 }, { x: 0, y: -1, z: 0 }),
    null,
  );
  w.set(0, 8, 0, 0);
  const hit = w.raycast({ x: 0.5, y: 12, z: 0.5 }, { x: 0, y: -1, z: 0 });
  assert.equal(hit.y, 7);
  assert.deepEqual(hit.normal, [0, 1, 0]);
  assert.equal(
    w.raycast({ x: 0.5, y: 12, z: 0.5 }, { x: 0, y: 0, z: 0 }),
    null,
  );
});
test("gravity lands on terrain; sprint cannot tunnel into walls", () => {
  const w = new World(),
    p = new Player(w);
  p.position = { x: 0.5, y: 18, z: 3.5 };
  for (let n = 0; n < 240; n++) p.update(1 / 120, {});
  assert.ok(Math.abs(p.position.y - 9) < 0.001);
  assert.ok(p.grounded);
  for (let y = 9; y < 13; y++) w.set(0, y, 1, 3);
  for (let n = 0; n < 240; n++) p.update(1 / 120, { forward: 1, sprint: true });
  assert.ok(p.position.z >= 2.299);
  assert.equal(p.collides(), false);
});
test("jump clears one block, ceiling stops ascent, mining below causes a fall", () => {
  const w = new World(),
    p = new Player(w);
  for (let n = 0; n < 10; n++) p.update(1 / 120, {});
  let max = 0;
  p.update(1 / 120, { jump: true });
  for (let n = 0; n < 150; n++) {
    p.update(1 / 120, {});
    max = Math.max(max, p.position.y);
  }
  assert.ok(max > 10.2);
  assert.ok(p.grounded);
  w.set(0, 11, 3, 3);
  p.update(1 / 120, { jump: true });
  for (let n = 0; n < 120; n++) p.update(1 / 120, {});
  assert.ok(p.position.y < 9.01);
  assert.equal(p.collides(), false);
  w.set(0, 8, 3, 0);
  for (let n = 0; n < 120; n++) p.update(1 / 120, {});
  assert.ok(Math.abs(p.position.y - 8) < 0.001);
});
test("diagonal movement is normalized and finite world boundary stops players", () => {
  const w = {
    solid: (x, y, z) => y < 0 || x > MAX || x < MIN || z < MIN || z > MAX,
    get: () => 0,
  };
  const a = new Player(w),
    b = new Player(w);
  a.position = { x: 0, y: 1, z: 0 };
  b.position = { ...a.position };
  for (let n = 0; n < 120; n++) {
    a.update(1 / 120, { forward: 1 });
    b.update(1 / 120, { forward: 1, right: 1 });
  }
  assert.ok(
    Math.abs(
      Math.hypot(a.position.x, a.position.z) -
        Math.hypot(b.position.x, b.position.z),
    ) < 0.001,
  );
  for (let n = 0; n < 2000; n++)
    a.update(1 / 120, { forward: 1, sprint: true });
  assert.ok(a.position.z > MIN + 0.299);
  assert.equal(a.collides(), false);
});
test("invalid saves fail safely and embedded player positions recover", () => {
  const s = state();
  s.edits = [0, 1, 0, 99];
  assert.throws(() => decodeState(s));
  s.edits = [];
  s.inventory.counts[1] = -1;
  assert.throws(() => decodeState(s));
  const valid = state();
  valid.player.y = 3;
  const { player } = decodeState(valid);
  assert.equal(player.collides(), false);
  const w = new World();
  assert.throws(() => w.restore([0, 0, 0, 0]));
  assert.throws(() => w.restore([1, 2]));
});
test("legacy structures move together without modifying legacy input", () => {
  const old = {
    version: 1,
    player: { x: 0, y: 2.2, z: 10 },
    blocks: [
      { x: 2, y: 1, z: 4, type: 1 },
      { x: 2, y: 2, z: 4, type: 3 },
    ],
  };
  const copy = JSON.stringify(old);
  const decoded = decodeState(migrateLegacy(old));
  assert.equal(decoded.world.get(2, 9, 4), 6);
  assert.equal(decoded.world.get(2, 10, 4), 7);
  assert.equal(JSON.stringify(old), copy);
  assert.equal(decoded.world.legacy, true);
  assert.throws(() =>
    migrateLegacy({ version: 1, blocks: [{ x: 2, y: HEIGHT, z: 4, type: 1 }] }),
  );
});
test("edit cap blocks collection without losing inventory; reverting frees capacity", () => {
  const w = new World(),
    i = new Inventory({ creative: false });
  let placed = 0;
  outer: for (let x = MIN; x <= MAX; x++)
    for (let z = MIN; z <= MAX; z++)
      for (let y = 25; y < 60; y++) {
        w.set(x, y, z, 3);
        if (++placed === EDIT_LIMIT) break outer;
      }
  assert.equal(w.edits.size, EDIT_LIMIT);
  assert.equal(mineBlock(w, i, { x: 0, y: 8, z: 0, type: 1 }), false);
  assert.equal(i.counts[1], 0);
  assert.equal(w.set(MIN, 25, MIN, 0), true);
  assert.equal(w.edits.size, EDIT_LIMIT - 1);
});
test("journal survives reload and commit persists full state", async () => {
  const db = remote(),
    disk = storage(),
    a = new SaveSession(db, disk, "a");
  await a.load();
  const s = state();
  s.inventory.counts[4] = 12;
  a.update(s);
  const b = new SaveSession(db, disk, "a");
  assert.deepEqual(await b.load(), s);
  await b.flush();
  assert.equal(b.revision, 1);
  assert.equal(disk.getItem("a"), null);
  assert.deepEqual(await new SaveSession(db, disk, "a").load(), s);
});
test("read and write failures never replace cloud with a fresh world", async () => {
  const disk = storage();
  const a = new SaveSession(
    {
      read: async () => {
        throw Error("offline");
      },
    },
    disk,
    "a",
  );
  await assert.rejects(() => a.load());
  assert.equal(a.pending, null);
  const b = new SaveSession(
    {
      read: async () => null,
      commit: async () => {
        throw Error("offline");
      },
    },
    disk,
    "b",
  );
  await b.load();
  b.update(state());
  await assert.rejects(() => b.flush());
  assert.ok(disk.getItem("b"));
  assert.ok(b.pending);
});
test("simultaneous devices cannot overwrite a newer revision", async () => {
  const db = remote(),
    disk = storage(),
    a = new SaveSession(db, disk, "a"),
    b = new SaveSession(db, disk, "b");
  await a.load();
  await b.load();
  a.update(state());
  b.update(state());
  await a.flush();
  await assert.rejects(() => b.flush(), SaveConflict);
  assert.ok(b.blocked);
  assert.ok(disk.getItem("b"));
  await assert.rejects(
    () => new SaveSession(db, disk, "b").load(),
    SaveConflict,
  );
});
test("edits during in-flight save remain pending at the new revision", async () => {
  const db = remote(),
    disk = storage();
  let release;
  const adapter = {
    read: db.read,
    commit: async (e) => {
      await new Promise((r) => (release = r));
      return db.commit(e);
    },
  };
  const a = new SaveSession(adapter, disk, "a");
  await a.load();
  a.update(state());
  const flight = a.flush();
  const later = state();
  later.inventory.counts[1] = 9;
  a.update(later);
  release();
  await flight;
  assert.equal(a.pending.base, 1);
  assert.equal(a.pending.state.inventory.counts[1], 9);
  const next = a.flush();
  release();
  await next;
  assert.equal(a.pending, null);
});
test("lost acknowledgement is idempotent and local storage failures are visible", async () => {
  const db = remote(),
    disk = storage();
  let fail = true;
  const a = new SaveSession(
    {
      read: db.read,
      commit: async (e) => {
        const r = await db.commit(e);
        if (fail) {
          fail = false;
          throw Error("lost ack");
        }
        return r;
      },
    },
    disk,
    "a",
  );
  await a.load();
  a.update(state());
  await assert.rejects(() => a.flush());
  await a.flush();
  assert.equal(a.revision, 1);
  const b = new SaveSession(
    db,
    {
      getItem: () => null,
      setItem: () => {
        throw Error("quota");
      },
      removeItem: () => {},
    },
    "b",
  );
  await b.load();
  b.update(state());
  assert.equal(b.storageError, true);
  await b.flush();
  assert.equal(b.storageError, false);
});

test("a damaged 0.4 document is never treated as a new or legacy game", async () => {
  const session = new SaveSession(
    { read: async () => ({ sandbox04: { revision: 1, commit: "old" } }) },
    storage(),
    "a",
  );
  await assert.rejects(() => session.load());
  assert.equal(session.pending, null);
});
