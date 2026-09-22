import test from "node:test";
import assert from "node:assert/strict";
import { Inventory, placeBlock, mineBlock } from "../js/inventory.js";
import { World } from "../js/world.js";
import { Player } from "../js/player.js";
import { encodeState, decodeState } from "../js/firebase.js";
test("creative offers every material with zero stock and placement never consumes it", () => {
  const world = new World(),
    inventory = new Inventory(),
    player = new Player(world);
  assert.equal(inventory.creative, true);
  for (let n = 0; n < 7; n++) {
    inventory.select(n);
    const x = n + 4,
      z = 3,
      y = world.terrainHeight(x, z);
    assert.equal(
      placeBlock(world, inventory, player, { x, y, z, normal: [0, 1, 0] }),
      true,
    );
    assert.equal(world.get(x, y + 1, z), n + 1);
    assert.equal(inventory.counts[n + 1], 0);
  }
});
test("old saves become creative without losing structures, selection or collected quantities", () => {
  const w = new World(),
    i = new Inventory(),
    p = new Player(w);
  w.set(3, 15, 3, 4);
  i.counts[4] = 27;
  i.select(3);
  const old = encodeState(w, i, p);
  delete old.inventory.creative;
  const loaded = decodeState(old);
  assert.equal(loaded.inventory.creative, true);
  assert.equal(loaded.world.get(3, 15, 3), 4);
  assert.equal(loaded.inventory.counts[4], 27);
  assert.equal(loaded.inventory.selected, 3);
  const again = decodeState(
    encodeState(loaded.world, loaded.inventory, loaded.player),
  );
  assert.equal(again.inventory.creative, true);
  assert.equal(again.world.get(3, 15, 3), 4);
});
test("creative mining does not require inventory capacity, and collisions still prevent placement", () => {
  const w = new World(),
    i = new Inventory(),
    p = new Player(w);
  i.counts[1] = 99999;
  assert.equal(mineBlock(w, i, { x: 1, y: 8, z: 1, type: 1 }), true);
  assert.equal(i.counts[1], 99999);
  assert.equal(
    placeBlock(w, i, p, { x: 0, y: 8, z: 3, normal: [0, 1, 0] }),
    false,
  );
  i.select(8);
  assert.equal(
    placeBlock(w, i, p, { x: 2, y: 8, z: 2, normal: [0, 1, 0] }),
    false,
  );
});
