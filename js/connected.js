import { World, MIN, MAX, HEIGHT, createWorldView } from "./world.js";
import { Player } from "./player.js?v=0.6.0";
import { Village, onField } from "./village.js?v=0.6.0";

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
  regionAt(x) {
    return x < 32 ? "home" : x < 64 ? "path" : "village";
  }
  local(x) {
    return x < 32
      ? [this.home, x]
      : x < 64
        ? [this.link, x - LINK_X]
        : [this.village, x - VILLAGE_X];
  }
  inside(x, y, z) {
    return (
      [x, y, z].every(Number.isInteger) &&
      x >= -32 &&
      x <= 127 &&
      z >= MIN &&
      z <= MAX &&
      y >= 0 &&
      y < HEIGHT
    );
  }
  get(x, y, z) {
    if (!this.inside(x, y, z)) return 0;
    const [w, lx] = this.local(x);
    return w.get(lx, y, z);
  }
  solid(x, y, z) {
    return (
      x < -32 || x > 127 || z < MIN || z > MAX || y < 0 || !!this.get(x, y, z)
    );
  }
  set(x, y, z, t) {
    if (!this.inside(x, y, z)) return false;
    const [w, lx] = this.local(x);
    return w.set(lx, y, z, t);
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
      (saved.version !== 1 || !saved.player || !Array.isArray(saved.edits))
    )
      throw Error("El mundo conectado necesita una versión compatible");
    // Add a small entrance only on an untouched strip, never inside a player's building.
    if (!saved && !this.village.entrance) this.village.connectEntrance();
    this.world = new ConnectedWorld(
      home.world,
      this.village.world,
      saved?.edits || [],
    );
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
        previous.x < -31.7 ||
        previous.x > 127.7 ||
        previous.z < -31.7 ||
        previous.z > 31.7 ||
        previous.y < 1 ||
        previous.y > 66)
    )
      throw Error("Posición del mundo conectado no válida");
    this.player.restore(previous);
  }
  get region() {
    return this.world.regionAt(this.player.position.x);
  }
  syncAnchors() {
    const p = this.player.snapshot();
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
      version: 1,
      player: this.player.snapshot(),
      edits: this.world.link.serialize(),
    };
  }
}

export function createConnectedView(THREE, journey, scene) {
  const groups = [],
    views = [];
  for (const [world, x] of [
    [journey.home.world, 0],
    [journey.world.link, LINK_X],
    [journey.village.world, VILLAGE_X],
  ]) {
    const group = new THREE.Group();
    group.position.x = x;
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
