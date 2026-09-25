import { createPlaces } from "./places.js?v=0.9.0";
import { createExpansion } from "./expansion.js?v=0.9.0";
import { World, MIN, MAX, HEIGHT, createWorldView } from "./world.js?v=0.9.0";
import { Player } from "./player.js?v=0.9.0";
import { Village, onField } from "./village.js?v=0.9.0";

export const VILLAGE_X = 96;
export const LINK_X = 48;
export const LINK_LIMIT = 512;
// Version 1 joins the unchanged 64×64 home and village with 32 new columns.
export class ConnectedWorld {
  constructor(home, village, savedEdits = []) {
    this.home = home;
    this.village = village;
    this.bounds = { minX: -32, maxX: 127, minZ: -32, maxZ: 31 };
    this.autoStep = true;
    this.link = new World({ seed: home.seed });
    this.link.base.fill(0);
    for (let x = -16; x <= 15; x++)
      for (let z = MIN; z <= MAX; z++) {
        const road = Math.abs(z + 6) <= 1;
        const rz = road ? -6 : z;
        const left = home.terrainHeight(MAX, rz),
          right = village.terrainHeight(MIN, rz);
        const h = Math.round(left + ((right - left) * (x + 17)) / 33);
        for (let y = 0; y <= h; y++)
          this.link.base[this.link.index(x, y, z)] =
            y === 0 ? 8 : y === h ? (road ? 3 : 1) : y >= h - 2 ? 2 : 3;
      }
    const inside = this.link.inside.bind(this.link),
      set = this.link.set.bind(this.link);
    this.link.inside = (x, y, z) => x >= -16 && x <= 15 && inside(x, y, z);
    this.link.set = (x, y, z, t) => {
      if (
        this.link.edits.size >= LINK_LIMIT &&
        !this.link.edits.has(`${x},${y},${z}`) &&
        this.link.inside(x, y, z) &&
        t !== this.link.base[this.link.index(x, y, z)]
      )
        return false;
      return set(x, y, z, t);
    };
    if (!Array.isArray(savedEdits) || savedEdits.length > LINK_LIMIT * 4)
      throw Error("Camino guardado no válido");
    this.link.restore(savedEdits);
  }
  expand(saved) {
    this.expansion = createExpansion(this.home, this.village, saved);
    this.bounds = { minX: -160, maxX: 255, minZ: -32, maxZ: 31 };
  }
  addPlaces(saved) {
    if (!this.expansion) this.expand();
    this.places = createPlaces(this, saved);
    this.bounds = { ...this.bounds, maxZ: 95 };
  }
  regionAt(x, z = 0) {
    if (this.places && z >= 32)
      return (
        this.places.find((r) => x >= r.x - 32 && x <= r.x + 31)?.id || "meadow"
      );
    if (x < -32 || x >= 128) return "meadow";
    return x < 32 ? "home" : x < 64 ? "path" : "village";
  }
  local(x, z = 0) {
    if (this.places && z >= 32) {
      const region = this.places.find((r) => x >= r.x - 32 && x <= r.x + 31);
      if (region) return [region.world, x - region.x, z - region.z];
    }
    if (this.expansion) {
      const region = this.expansion.find(
        (r) => x >= r.offset - 32 && x <= r.offset + 31,
      );
      if (region) return [region.world, x - region.offset, z];
    }
    return x < 32
      ? [this.home, x, z]
      : x < 64
        ? [this.link, x - LINK_X, z]
        : [this.village, x - VILLAGE_X, z];
  }
  inside(x, y, z) {
    return (
      [x, y, z].every(Number.isInteger) &&
      x >= this.bounds.minX &&
      x <= this.bounds.maxX &&
      z >= MIN &&
      z <= this.bounds.maxZ &&
      (z <= MAX || (this.places && x >= -32 && x <= 159)) &&
      y >= 0 &&
      y < HEIGHT
    );
  }
  get(x, y, z) {
    if (!this.inside(x, y, z)) return 0;
    const [w, lx, lz] = this.local(x, z);
    return w.get(lx, y, lz);
  }
  solid(x, y, z) {
    return (
      x < this.bounds.minX ||
      x > this.bounds.maxX ||
      z < MIN ||
      z > this.bounds.maxZ ||
      (z > MAX && (!this.places || x < -32 || x > 159)) ||
      y < 0 ||
      !!this.get(x, y, z)
    );
  }
  set(x, y, z, t) {
    if (!this.inside(x, y, z)) return false;
    const [w, lx, lz] = this.local(x, z);
    return w.set(lx, y, lz, t);
  }
  protected(x, y, z) {
    return x >= 64 && onField(x - VILLAGE_X, y, z);
  }
  raycast(origin, direction, reach = 6) {
    return World.prototype.raycast.call(this, origin, direction, reach);
  }
}

export class Journey {
  constructor(home, village, location = "home", saved) {
    this.home = home;
    this.village = village || new Village();
    if (
      saved &&
      (![1, 2, 3].includes(saved.version) ||
        !saved.player ||
        !Array.isArray(saved.edits) ||
        (saved.version >= 2 && !Array.isArray(saved.expansion)) ||
        (saved.version === 3 && !Array.isArray(saved.places)))
    )
      throw Error("El mundo conectado necesita una versión compatible");
    // Add a small entrance only on an untouched strip, never inside a player's building.
    if (!saved && !this.village.entrance) this.village.connectEntrance();
    this.world = new ConnectedWorld(
      home.world,
      this.village.world,
      saved?.edits || [],
    );
    if (saved?.version >= 2) this.world.expand(saved.expansion);
    if (saved?.version === 3) this.world.addPlaces(saved.places);
    this.player = new Player(this.world);
    const previous =
      saved?.player ||
      (location === "village"
        ? {
            ...this.village.player.snapshot(),
            x: this.village.player.position.x + VILLAGE_X,
          }
        : home.player.snapshot());
    if (
      saved &&
      (!["x", "y", "z", "yaw", "pitch"].every((k) =>
        Number.isFinite(previous[k]),
      ) ||
        previous.x < this.world.bounds.minX + 0.3 ||
        previous.x > this.world.bounds.maxX + 0.7 ||
        previous.z < -31.7 ||
        previous.z > this.world.bounds.maxZ + 0.7 ||
        !this.world.inside(Math.floor(previous.x), 0, Math.floor(previous.z)) ||
        previous.y < 1 ||
        previous.y > 66)
    )
      throw Error("Posición del mundo conectado no válida");
    this.player.restore(previous);
  }
  get region() {
    return this.world.regionAt(this.player.position.x, this.player.position.z);
  }
  syncAnchors() {
    const p = this.player.snapshot();
    if (p.z < -31.7 || p.z > 31.7) return;
    if (p.x >= -31.7 && p.x <= 31.7) {
      this.home.player.position = { x: p.x, y: p.y, z: p.z };
      this.home.player.yaw = p.yaw;
      this.home.player.pitch = p.pitch;
    } else if (p.x >= 64.3 && p.x <= 127.7) {
      this.village.player.position = { x: p.x - VILLAGE_X, y: p.y, z: p.z };
      this.village.player.yaw = p.yaw;
      this.village.player.pitch = p.pitch;
    }
  }
  snapshot() {
    this.syncAnchors();
    return {
      version: this.world.places ? 3 : this.world.expansion ? 2 : 1,
      ...(this.world.places
        ? {
            places: this.world.places.map((r) => ({
              id: r.id,
              edits: r.world.serialize(),
            })),
          }
        : {}),
      ...(this.world.expansion
        ? {
            expansion: this.world.expansion.map((r) => ({
              edits: r.world.serialize(),
            })),
          }
        : {}),
      player: this.player.snapshot(),
      edits: this.world.link.serialize(),
    };
  }
}

export function createConnectedView(THREE, journey, scene) {
  const groups = [],
    views = [];
  for (const [world, x, z = 0] of [
    [journey.home.world, 0],
    [journey.world.link, LINK_X],
    [journey.village.world, VILLAGE_X],
    ...(journey.world.expansion || []).map((r) => [r.world, r.offset]),
    ...(journey.world.places || []).map((r) => [r.world, r.x, r.z]),
  ]) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    groups.push(group);
    world.markAll();
    views.push(createWorldView(THREE, world, group));
  }
  return {
    villageScene: groups[2],
    update() {
      for (const v of views) v.update();
    },
    dispose() {
      for (const v of views) v.dispose();
      for (const g of groups) scene.remove(g);
    },
  };
}
