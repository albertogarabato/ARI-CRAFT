import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory, mineBlock, placeBlock } from "../js/inventory.js";
import { Village } from "../js/village.js";
import { Journey, VILLAGE_X, LINK_LIMIT } from "../js/connected.js";
import {
  encodeState,
  encodeJourney,
  decodeState,
  prepareCommit,
  SaveConflict,
} from "../js/firebase.js";
function makeJourney() {
  const world = new World();
  return new Journey({ world, player: new Player(world) }, new Village());
}
function surface(w, x, z) {
  for (let y = 63; y >= 0; y--) if (w.get(x, y, z)) return y + 1;
  return 1;
}
test("a 0.5 game retains home and village constructions, quantities, residents and score after joining", () => {
  const home = new World(),
    p = new Player(home),
    v = new Village(),
    bag = new Inventory();
  home.set(0, 8, 0, 0);
  home.set(30, 25, 2, 6);
  v.world.set(-9, 16, 5, 7);
  v.world.set(-12, 8, -5, 0);
  bag.counts[4] = 19;
  bag.selected = 3;
  v.football.score = [4, 2];
  const before = encodeState(home, bag, p, v, "home"),
    copy = structuredClone(before),
    decoded = decodeState(before);
  const j = new Journey(
    { world: decoded.world, player: decoded.player },
    decoded.village,
    decoded.location,
  );
  const loaded = decodeState(encodeJourney(j, decoded.inventory));
  assert.equal(loaded.journey.world.get(30, 25, 2), 6);
  assert.equal(loaded.journey.world.get(0, 8, 0), 0);
  assert.equal(loaded.journey.world.get(VILLAGE_X - 9, 16, 5), 7);
  assert.equal(loaded.journey.world.get(VILLAGE_X - 12, 8, -5), 0);
  assert.deepEqual(loaded.inventory.snapshot(), bag.snapshot());
  assert.deepEqual(loaded.world.base, home.base);
  assert.deepEqual(loaded.village.football.snapshot(), v.football.snapshot());
  assert.deepEqual(
    loaded.village.residents.map((r) => r.actor.snapshot()),
    v.residents.map((r) => r.actor.snapshot()),
  );
  assert.deepEqual(before, copy);
});
test("a save inside the village moves its coordinate once, not again on subsequent reloads", () => {
  const j = makeJourney(),
    v = j.village;
  v.player.position = { x: 15, y: 9, z: 8.4 };
  v.player.yaw = 1;
  const old = decodeState(
    encodeState(j.home.world, new Inventory(), j.home.player, v, "village"),
  );
  const joined = new Journey(
    { world: old.world, player: old.player },
    old.village,
    old.location,
  );
  assert.equal(joined.player.position.x, 111);
  const once = decodeState(encodeJourney(joined, old.inventory));
  const twice = decodeState(encodeJourney(once.journey, once.inventory));
  assert.deepEqual(twice.journey.player.snapshot(), joined.player.snapshot());
});
test("walk from the home edge to the village plaza and back without portals or jumps", () => {
  const j = makeJourney(),
    p = j.player;
  p.position = { x: 30.5, y: surface(j.world, 30, -6), z: -5.5 };
  p.yaw = -Math.PI / 2;
  for (let i = 0; i < 1500; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x > 75, `outbound x=${p.position.x}`);
  assert.equal(p.collides(), false);
  p.yaw = Math.PI / 2;
  for (let i = 0; i < 1500; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x < 32, `return x=${p.position.x}`);
  assert.equal(p.collides(), false);
});
test("raycast, mining and finite placement operate in world coordinates on both sides of the join", () => {
  const j = makeJourney(),
    bag = new Inventory({ creative: false }),
    w = j.world;
  for (const x of [31, 32, 48, 63, 64, 73]) {
    const z = -6,
      y = surface(w, x, z) - 1;
    const hit = w.raycast(
      { x: x + 0.5, y: y + 3, z: z + 0.5 },
      { x: 0, y: -1, z: 0 },
    );
    assert.equal(hit.x, x);
    const type = hit.type;
    assert.equal(mineBlock(w, bag, hit), true);
    assert.equal(bag.counts[type], 1);
    bag.select([1, 2, 3, 4, 5, 6, 7].indexOf(type));
    assert.equal(
      placeBlock(w, bag, j.player, { x, y: y - 1, z, normal: [0, 1, 0] }),
      true,
    );
    assert.equal(bag.counts[type], 0);
  }
  assert.equal(w.set(111, 8, 6, 0), false);
  assert.equal(w.protected(111, 8, 6), true);
  assert.equal(w.protected(15, 8, 6), false);
});
test("new-terrain edits and a position on the path survive save and reload", () => {
  const j = makeJourney();
  j.world.set(48, 24, 0, 6);
  j.world.set(50, 8, 0, 0);
  j.player.position = { x: 48.5, y: 20, z: 1.5 };
  const bag = new Inventory(),
    saved = encodeJourney(j, bag),
    loaded = decodeState(saved);
  assert.deepEqual(loaded.journey.player.snapshot(), j.player.snapshot());
  assert.equal(loaded.journey.world.get(48, 24, 0), 6);
  assert.deepEqual(
    loaded.journey.world.link.serialize(),
    j.world.link.serialize(),
  );
});
test("entrance does not overwrite existing nearby builds, and new stairs stay removed after mining and reload", () => {
  const world = new World(),
    v = new Village();
  v.world.set(-26, 15, -6, 6);
  const j = new Journey({ world, player: new Player(world) }, v);
  assert.equal(v.entrance, false);
  assert.equal(j.world.get(70, 15, -6), 6);
  const empty = makeJourney();
  assert.equal(empty.village.entrance, true);
  assert.equal(empty.world.get(70, 10, -6), 3);
  empty.world.set(70, 10, -6, 0);
  assert.equal(
    decodeState(encodeJourney(empty, new Inventory())).journey.world.get(
      70,
      10,
      -6,
    ),
    0,
  );
});
test("joined-world position limits are enforced; auto stepping cannot climb tall walls or a low ceiling", () => {
  const j = makeJourney(),
    p = j.player;
  p.position = { x: 45.5, y: surface(j.world, 45, -6), z: -5.5 };
  p.yaw = -Math.PI / 2;
  const y = Math.round(p.position.y);
  for (let dy = 0; dy < 4; dy++) j.world.set(47, y + dy, -6, 3);
  for (let i = 0; i < 400; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x < 46.71);
  assert.equal(p.collides(), false);
  const broken = encodeJourney(j, new Inventory());
  broken.connected.player.x = 200;
  assert.throws(() => decodeState(broken));
});
test("unknown or incomplete connected format fails closed and the pre-union backup is atomic and immutable", () => {
  const j = makeJourney(),
    bag = new Inventory(),
    old = {
      revision: 8,
      commit: "old",
      state: encodeState(j.home.world, bag, j.home.player, j.village),
    };
  const before = JSON.stringify(old),
    entry = { base: 8, commit: "joined", state: encodeJourney(j, bag) };
  const patch = prepareCommit({ sandbox04: old }, entry);
  assert.deepEqual(JSON.parse(patch.backupBefore06.json), old.state);
  assert.equal(JSON.stringify(old), before);
  assert.equal(prepareCommit(patch, entry), null);
  const next = prepareCommit(patch, { ...entry, base: 9, commit: "next" });
  assert.equal(next.backupBefore06, undefined);
  assert.throws(
    () => prepareCommit(patch, { ...entry, commit: "stale" }),
    SaveConflict,
  );
  for (const alter of [
    (s) => delete s.connected,
    (s) => delete s.connected.edits,
    (s) => (s.connected.version = 9),
    (s) => (s.connected.edits = [-17, 9, 0, 6]),
    (s) => (s.connected.edits = Array((LINK_LIMIT + 1) * 4).fill(0)),
  ]) {
    const s = structuredClone(entry.state);
    alter(s);
    assert.throws(() => decodeState(s));
  }
});

test("the connected-world step helper respects headroom", () => {
  const j = makeJourney(),
    p = j.player;
  p.position = { x: 45.5, y: surface(j.world, 45, -6), z: -5.5 };
  p.yaw = -Math.PI / 2;
  const y = Math.round(p.position.y);
  j.world.set(47, y, -6, 3);
  for (let x = 45; x <= 48; x++) j.world.set(x, y + 2, -6, 3);
  for (let i = 0; i < 400; i++) p.update(1 / 120, { forward: 1 });
  assert.ok(p.position.x < 46.71);
  assert.equal(p.collides(), false);
});
test("a player standing on the proposed entrance keeps their exact position on migration", () => {
  const w = new World(),
    v = new Village();
  v.player.position = { x: -26.5, y: 9, z: -5.5 };
  // Use the first flat column, where adding stairs would intersect the avatar.
  v.player.position.x = -25.5;
  const j = new Journey({ world: w, player: new Player(w) }, v, "village");
  assert.equal(v.entrance, false);
  assert.deepEqual(j.player.position, { x: 70.5, y: 9, z: -5.5 });
});
test("football still kicks in local coordinates while the player uses global coordinates", () => {
  const j = makeJourney();
  j.player.position = { x: 111, y: 9, z: 8.4 };
  j.player.yaw = 0;
  j.syncAnchors();
  assert.equal(j.village.football.kick(j.village.player), true);
  for (let i = 0; i < 600; i++) j.village.update(1 / 120);
  assert.equal(j.village.football.score[0], 1);
  const restored = decodeState(encodeJourney(j, new Inventory()));
  assert.equal(restored.village.football.score[0], 1);
});
