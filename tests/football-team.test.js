import test from "node:test";
import assert from "node:assert/strict";
import { FootballTeam, SQUAD } from "../js/football-team.js";
import { Football, Village } from "../js/village.js";
import { World } from "../js/world.js";
import { Player } from "../js/player.js";
import { Inventory } from "../js/inventory.js";
import { Journey } from "../js/connected.js";
import {
  encodeJourney,
  decodeState,
  prepareCommit,
  SaveConflict,
} from "../js/firebase.js";
const human = { position: { x: 8, y: 9, z: 9 } };
test("five original players include one white teammate, two rivals and two goalkeepers", () => {
  const m = new FootballTeam();
  assert.equal(m.players.length, 5);
  assert.equal(m.players.filter((p) => p.team === 0 && !p.keeper).length, 1);
  assert.equal(m.players.filter((p) => p.team === 1 && !p.keeper).length, 2);
  assert.equal(m.players.filter((p) => p.keeper).length, 2);
});
test("teammate passes toward Ari, rivals shoot toward the white goal, human touches have priority", () => {
  const m = new FootballTeam(),
    f = new Football();
  const p = m.players[0];
  p.x = 15;
  p.z = 6.7;
  m.update(1 / 120, f, { position: { x: 8, y: 9, z: 12 } }, true);
  assert.ok(f.ball.vx < 0 && f.ball.vz > 0, "white passes toward Ari");
  assert.ok(p.swing > 0);
  m.reset();
  f.reset();
  m.touchDelay = 0;
  const rival = m.players[2];
  rival.x = 15;
  rival.z = 5.3;
  rival.cooldown = 0;
  m.update(1 / 120, f, human, true);
  assert.ok(f.ball.vz > 0, "coral attacks toward z=20");
  f.reset();
  m.humanKick();
  m.update(1 / 120, f, human, true);
  assert.equal(f.ball.vz, 0);
});
test("keepers track and save low shots, stay on their line and cannot grab a high ball", () => {
  const m = new FootballTeam(),
    f = new Football(),
    keeper = m.players[1];
  f.ball = { x: 15, y: 9.5, z: 18.5, vx: 0, vy: 0, vz: 8 };
  m.update(1 / 120, f, human, true);
  assert.ok(f.ball.vz < 0);
  m.touchDelay = 0;
  keeper.cooldown = 0;
  f.ball = { x: 15, y: 12, z: 18.5, vx: 0, vy: 0, vz: 8 };
  m.update(1 / 120, f, human, true);
  assert.equal(f.ball.vz, 8);
  f.ball.x = 23;
  for (let i = 0; i < 300; i++) m.update(1 / 120, f, human, true);
  assert.ok(keeper.x > 15 && keeper.x <= 17.3 + 0.01);
  assert.equal(keeper.z, SQUAD[1].z);
});
test("simulation creates movement and goals while keeping every player inside the field", () => {
  const m = new FootballTeam(),
    f = new Football();
  let kicks = 0,
    goals = 0;
  const start = m.snapshot();
  for (let i = 0; i < 18000; i++) {
    const before = f.ball.vz;
    m.update(1 / 120, f, human, true);
    if (Math.abs(f.ball.vz - before) > 1) kicks++;
    if (f.update(1 / 120) !== null) {
      goals++;
      m.reset();
    }
    for (const p of m.players) {
      assert.ok(p.x >= 6.5 && p.x <= 23.5);
      assert.ok(p.z >= -7.3 && p.z <= 19.3);
    }
  }
  assert.ok(kicks > 5);
  assert.ok(goals > 0);
  assert.notDeepEqual(m.snapshot(), start);
});
test("leaving the pitch freezes players, ball, cooldown and score; resuming restarts them", () => {
  const v = new Village();
  v.enableMatch();
  v.football.ball.vz = -10;
  const before = v.match.snapshot(),
    ball = v.football.snapshot();
  for (let i = 0; i < 100; i++)
    v.update(1 / 120, { matchActive: false, human });
  assert.deepEqual(v.match.snapshot(), before);
  assert.deepEqual(v.football.snapshot(), ball);
  v.update(1 / 120, { matchActive: true, human });
  assert.notDeepEqual(v.football.snapshot(), ball);
});
test("upgrading preserves previous constructions, inventory and score; players and cooldowns round-trip", () => {
  const w = new World(),
    j = new Journey({ world: w, player: new Player(w) });
  j.world.expand();
  const bag = new Inventory({ creative: false });
  j.world.set(-64, 25, 0, 14);
  bag.counts[14] = 19;
  j.village.football.score = [5, 0];
  const old = encodeJourney(j, bag),
    copy = structuredClone(old);
  j.village.enableMatch();
  for (let i = 0; i < 200; i++)
    j.village.update(1 / 120, { matchActive: true, human });
  const state = encodeJourney(j, bag),
    loaded = decodeState(state);
  assert.equal(state.version, 8);
  assert.equal(loaded.journey.world.get(-64, 25, 0), 14);
  assert.deepEqual(loaded.inventory.snapshot(), bag.snapshot());
  assert.deepEqual(loaded.village.match.snapshot(), j.village.match.snapshot());
  assert.deepEqual(
    loaded.village.football.snapshot(),
    j.village.football.snapshot(),
  );
  assert.deepEqual(old, copy);
  const data = {
    sandbox04: { revision: 4, commit: "old", state: old },
    backupBefore07: { json: "kept" },
  };
  const patch = prepareCommit(data, { base: 4, commit: "new", state });
  assert.deepEqual(JSON.parse(patch.backupBefore08.json), old);
  assert.equal(data.backupBefore07.json, "kept");
  const next = { ...data, ...patch };
  assert.equal(
    prepareCommit(next, { base: 5, commit: "later", state }).backupBefore08,
    undefined,
  );
  assert.throws(
    () => prepareCommit(next, { base: 4, commit: "stale", state }),
    SaveConflict,
  );
});
test("corrupt or future football state fails closed and cannot replace a game with an empty squad", () => {
  const saved = new FootballTeam().snapshot();
  for (const bad of [
    null,
    { ...saved, version: 2 },
    { ...saved, players: [] },
    { ...saved, touchDelay: -1 },
  ])
    assert.throws(() => new FootballTeam(bad));
  for (const [field, value] of [
    ["x", 100],
    ["z", NaN],
    ["cooldown", -1],
    ["swing", 3],
  ]) {
    const bad = structuredClone(saved);
    bad.players[0][field] = value;
    assert.throws(() => new FootballTeam(bad));
  }
  const bad = structuredClone(saved);
  bad.players[1].z = 0;
  assert.throws(() => new FootballTeam(bad));
});
test("a goal repositions players without clearing the score and survives an immediate reload", () => {
  const v = new Village();
  v.enableMatch();
  v.football.score = [5, 2];
  v.football.ball = { x: 15, y: 9.32, z: -7.99, vx: 0, vy: 0, vz: -18 };
  v.match.touchDelay = 1;
  assert.equal(v.update(1 / 60, { matchActive: true, human }), 0);
  assert.deepEqual(v.football.score, [6, 2]);
  assert.deepEqual(
    v.match.players.map((p) => [p.x, p.z]),
    SQUAD.map((p) => [p.x, p.z]),
  );
  const restored = new Village(v.snapshot());
  assert.deepEqual(restored.football.score, [6, 2]);
  restored.update(1 / 120, { matchActive: true, human });
  assert.deepEqual(restored.football.score, [6, 2]);
});
