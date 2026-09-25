import { FootballTeam } from "./football-team.js?v=0.9.0";
import { World, HEIGHT } from "./world.js?v=0.9.0";
import { Player } from "./player.js?v=0.9.0";

// A separate, versioned region. Never modify the original world's generator.
export const VILLAGE_EDIT_LIMIT = 2000;
export const FIELD = {
  left: 6,
  right: 24,
  near: 20,
  far: -8,
  centerX: 15,
  centerZ: 6,
  floor: 9,
};
export const RESIDENTS = [
  {
    kind: "villager",
    name: "Luna",
    x: -7,
    z: -5,
    color: "#539baa",
    home: [-22, -2, -10, 1],
  },
  {
    kind: "villager",
    name: "Teo",
    x: -16,
    z: -5,
    color: "#dfaa55",
    home: [-22, -2, -10, 1],
  },
  {
    kind: "sheep",
    name: "Nube",
    x: -18,
    z: 7,
    color: "#eee9da",
    home: [-23, -9, 4, 19],
  },
  {
    kind: "sheep",
    name: "Copo",
    x: -15,
    z: 13,
    color: "#ded5bf",
    home: [-23, -9, 4, 19],
  },
  {
    kind: "pig",
    name: "Trufa",
    x: -20,
    z: 13,
    color: "#e7a39d",
    home: [-23, -9, 4, 19],
  },
  {
    kind: "chicken",
    name: "Pipa",
    x: -11,
    z: 8,
    color: "#faf0cf",
    home: [-23, -9, 4, 19],
  },
  {
    kind: "chicken",
    name: "Pepita",
    x: -13,
    z: 17,
    color: "#f5e4bc",
    home: [-23, -9, 4, 19],
  },
];
export function onField(x, y, z) {
  return x >= 5 && x <= 25 && z >= -10 && z <= 22 && y >= 1 && y < HEIGHT;
}
function addEntrance(world) {
  // Stone steps at the west edge connect the old raised border to the plaza.
  for (let x = -26; x <= -25; x++)
    for (let z = -7; z <= -5; z++)
      for (let y = 9; y <= -x - 16; y++) world.base[world.index(x, y, z)] = 3;
}
export function createVillageWorld(entrance = false) {
  const world = new World({ seed: 24092027 });
  // Remove the old trees before flattening so no cut-off canopies remain.
  for (let i = 0; i < world.base.length; i++)
    if (world.base[i] === 4 || world.base[i] === 5) world.base[i] = 0;
  const put = (x, y, z, t) => {
    world.base[world.index(x, y, z)] = t;
  };
  for (let x = -26; x <= 26; x++)
    for (let z = -26; z <= 26; z++) {
      for (let y = 1; y < HEIGHT; y++)
        put(x, y, z, y > 8 ? 0 : y === 8 ? 1 : y > 5 ? 2 : 3);
    }
  for (const [tx, tz] of [
    [-29, -22],
    [-29, 0],
    [-29, 22],
    [29, -22],
    [29, 0],
    [29, 22],
    [-20, 29],
    [0, 29],
    [20, 29],
    [-20, -29],
    [0, -29],
    [20, -29],
  ]) {
    const h = world.terrainHeight(tx, tz);
    for (let y = h + 1; y <= h + 4; y++) put(tx, y, tz, 4);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        for (let dy = 0; dy < 3; dy++)
          if (
            Math.abs(dx) + Math.abs(dz) + dy < 5 &&
            !(dx === 0 && dz === 0 && dy === 0)
          )
            put(tx + dx, h + 4 + dy, tz + dz, 5);
  }
  // Village paths, square and three explorable houses with open doorways.
  for (let x = -23; x <= 3; x++) for (let z = -9; z <= 0; z++) put(x, 8, z, 3);
  for (let x = -2; x <= 2; x++) for (let z = -22; z <= 21; z++) put(x, 8, z, 3);
  for (const [hx, hz, roof] of [
    [-23, -20, 6],
    [-14, -22, 7],
    [-5, -20, 6],
  ]) {
    for (let dx = 0; dx < 7; dx++)
      for (let dz = 0; dz < 7; dz++) {
        put(hx + dx, 8, hz + dz, 4);
        for (let y = 9; y <= 12; y++) {
          const edge = dx === 0 || dx === 6 || dz === 0 || dz === 6;
          const door = dz === 6 && dx === 3 && y <= 11;
          const window =
            (dx === 0 || dx === 6) && dz === 3 && (y === 10 || y === 11);
          if (edge && !door && !window)
            put(
              hx + dx,
              y,
              hz + dz,
              (dx === 0 || dx === 6) && (dz === 0 || dz === 6) ? 4 : 7,
            );
        }
        put(hx + dx, 13, hz + dz, roof);
        if (dx > 0 && dx < 6) put(hx + dx, 14, hz + dz, roof);
        if (dx > 1 && dx < 5) put(hx + dx, 15, hz + dz, roof);
      }
    // Table and a low bed; keep a clear route through each house.
    put(hx + 1, 9, hz + 2, 4);
    put(hx + 5, 9, hz + 1, 6);
    put(hx + 5, 9, hz + 2, 6);
    for (let z = hz + 7; z <= -9; z++) put(hx + 3, 8, z, 3);
  }
  // Low benches and garden borders.
  for (let x = -20; x <= -17; x++) put(x, 9, -1, 4);
  for (let x = -10; x <= -7; x++) put(x, 9, -1, 4);
  for (let z = 4; z <= 19; z++) {
    put(-25, 9, z, 4);
    put(-8, 9, z, 4);
  }
  for (let x = -25; x <= -8; x++) {
    put(x, 9, 3, 4);
    if (x !== -16 && x !== -15) put(x, 9, 20, 4);
  }
  // Football pitch remains free of builds so the ball always has a playable surface.
  for (let x = 6; x <= 24; x++) for (let z = -8; z <= 20; z++) put(x, 8, z, 1);
  for (let z = -10; z <= 22; z++) {
    put(5, 9, z, 4);
    put(25, 9, z, 4);
  }
  for (let x = 5; x <= 25; x++) {
    put(x, 9, -10, 4);
    put(x, 9, 22, 4);
  }
  // Two gaps let the player enter from the village.
  put(5, 9, 5, 0);
  put(5, 9, 6, 0);
  if (entrance) addEntrance(world);
  const set = world.set.bind(world);
  world.set = (x, y, z, type) => {
    if (onField(x, y, z)) return false;
    if (
      world.edits.size >= VILLAGE_EDIT_LIMIT &&
      !world.edits.has(`${x},${y},${z}`) &&
      world.inside(x, y, z) &&
      type !== world.base[world.index(x, y, z)]
    )
      return false;
    return set(x, y, z, type);
  };
  world.markAll();
  return world;
}

export class Football {
  constructor(saved) {
    this.score = [0, 0];
    this.cooldown = 0;
    this.reset();
    if (saved) {
      if (
        !Array.isArray(saved.score) ||
        saved.score.length !== 2 ||
        !saved.score.every((n) => Number.isInteger(n) && n >= 0 && n <= 1000000)
      )
        throw Error("Marcador guardado no válido");
      this.score = [...saved.score];
      const b = saved.ball;
      if (
        !b ||
        !["x", "y", "z", "vx", "vy", "vz"].every((k) =>
          Number.isFinite(b[k]),
        ) ||
        b.x < 6.32 ||
        b.x > 23.68 ||
        b.z < -8 ||
        b.z > 20 ||
        b.y < 9.32 ||
        b.y > 20 ||
        Math.hypot(b.vx, b.vy, b.vz) > 40
      )
        throw Error("Balón guardado no válido");
      this.ball = { ...b };
    }
  }
  reset() {
    this.ball = { x: 15, y: 9.32, z: 6, vx: 0, vy: 0, vz: 0 };
  }
  kick(player) {
    const p = player.position,
      b = this.ball;
    if (
      this.cooldown ||
      Math.hypot(p.x - b.x, p.z - b.z) > 2.7 ||
      Math.abs(p.y - (b.y - 0.32)) > 1.8
    )
      return false;
    // A low ray prevents kicking through a wall.
    const d = { x: b.x - p.x, y: b.y - (p.y + 0.5), z: b.z - p.z };
    if (
      player.world.raycast(
        { x: p.x, y: p.y + 0.5, z: p.z },
        d,
        Math.hypot(d.x, d.y, d.z),
      )
    )
      return false;
    b.vx = -Math.sin(player.yaw) * 18;
    b.vz = -Math.cos(player.yaw) * 18;
    b.vy = 2.6;
    return true;
  }
  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      return null;
    }
    const b = this.ball,
      oldZ = b.z;
    b.vy -= 10 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.y < 9.32) {
      b.y = 9.32;
      b.vy = Math.abs(b.vy) > 0.6 ? -b.vy * 0.42 : 0;
    }
    const friction = Math.exp(-(b.y <= 9.321 ? 0.9 : 0.18) * dt);
    b.vx *= friction;
    b.vz *= friction;
    if (b.x < 6.32 || b.x > 23.68) {
      b.x = Math.max(6.32, Math.min(23.68, b.x));
      b.vx *= -0.65;
    }
    const goal = b.x > 12.32 && b.x < 17.68 && b.y < 11.38;
    const side = b.z < -8 && oldZ >= -8 ? 0 : b.z > 20 && oldZ <= 20 ? 1 : -1;
    if (side >= 0 && goal) {
      this.score[side] = Math.min(1000000, this.score[side] + 1);
      this.reset();
      this.cooldown = 1.2;
      return side;
    }
    if (b.z < -8 || b.z > 20) {
      b.z = Math.max(-8, Math.min(20, b.z));
      b.vz *= -0.65;
    }
    return null;
  }
  snapshot() {
    return { score: [...this.score], ball: { ...this.ball } };
  }
}

export class Village {
  constructor(saved) {
    if (saved && (saved.version !== 1 || !saved.football || !saved.player))
      throw Error("La aldea necesita una versión compatible.");
    if (saved?.entrance !== undefined && typeof saved.entrance !== "boolean")
      throw Error("Entrada guardada no válida");
    this.entrance = saved?.entrance || false;
    this.world = createVillageWorld(this.entrance);
    if (saved) {
      // A protected-field edit must fail rather than silently disappear.
      if (
        !Array.isArray(saved.edits) ||
        saved.edits.length > VILLAGE_EDIT_LIMIT * 4
      )
        throw Error("Aldea guardada no válida");
      for (let i = 0; i < saved.edits.length; i += 4)
        if (onField(...saved.edits.slice(i, i + 3)))
          throw Error("Cambio no válido en el campo");
      this.world.restore(saved.edits);
    }
    this.player = new Player(this.world);
    this.player.position = { x: 0.5, y: 9, z: 12.5 };
    this.player.pitch = -0.18;
    if (saved) this.player.restore(saved.player);
    this.football = new Football(saved?.football);
    this.match =
      saved?.match === undefined ? null : new FootballTeam(saved.match);
    if (
      saved &&
      (!Array.isArray(saved.residents) ||
        saved.residents.length !== RESIDENTS.length)
    )
      throw Error("Habitantes guardados no válidos");
    this.residents = RESIDENTS.map((r, i) => {
      const actor = new Player(this.world);
      actor.position = { x: r.x, y: 9, z: r.z };
      actor.yaw = i;
      const data = saved?.residents[i];
      if (saved) {
        if (
          !data ||
          !["x", "y", "z", "yaw", "pitch"].every((k) =>
            Number.isFinite(data[k]),
          ) ||
          data.x < r.home[0] ||
          data.x > r.home[1] ||
          data.z < r.home[2] ||
          data.z > r.home[3] ||
          data.y < 1 ||
          data.y > 66
        )
          throw Error("Habitante guardado no válido");
        actor.restore(data);
        if (
          actor.position.x < r.home[0] ||
          actor.position.x > r.home[1] ||
          actor.position.z < r.home[2] ||
          actor.position.z > r.home[3]
        )
          actor.position = { x: r.x, y: 9, z: r.z };
      }
      return { ...r, actor, phase: i * 1.7, follow: 0 };
    });
  }
  enableMatch() {
    if (!this.match) this.match = new FootballTeam();
  }
  connectEntrance() {
    const occupied = [...this.world.edits.keys()].some((k) => {
      const [x, , z] = k.split(",").map(Number);
      return x >= -28 && x <= -22 && z >= -9 && z <= -3;
    });
    const p = this.player.position;
    if (occupied || (p.x >= -28 && p.x <= -22 && p.z >= -9 && p.z <= -3))
      return;
    this.entrance = true;
    addEntrance(this.world);
    this.world.markAll();
  }
  interact() {
    const p = this.player.position;
    const nearby = this.residents
      .filter(
        (r) =>
          Math.hypot(r.actor.position.x - p.x, r.actor.position.z - p.z) < 3 &&
          Math.abs(r.actor.position.y - p.y) < 2,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.actor.position.x - p.x, a.actor.position.z - p.z) -
          Math.hypot(b.actor.position.x - p.x, b.actor.position.z - p.z),
      )[0];
    if (!nearby) return null;
    nearby.follow = 8;
    return nearby.kind === "villager"
      ? `${nearby.name}: ¡Hola, Ari! El campo está al este. Acércate al balón y pulsa Chutar o F.`
      : `${nearby.name} te acompaña por el prado.`;
  }
  update(dt, { matchActive = false, human = this.player } = {}) {
    for (const r of this.residents) {
      r.phase += dt;
      r.follow = Math.max(0, r.follow - dt);
      const p = r.actor.position,
        h = r.home;
      let yaw = Math.sin(r.phase * 0.31) * Math.PI * 2;
      let moving = Math.sin(r.phase * 0.65) > 0.1;
      if (r.follow) {
        const q = this.player.position;
        yaw = Math.atan2(p.x - q.x, p.z - q.z);
        moving = Math.hypot(p.x - q.x, p.z - q.z) > 1.5;
      }
      // Turn toward the home center when approaching the edge of the meadow/plaza.
      if (
        p.x < h[0] + 1 ||
        p.x > h[1] - 1 ||
        p.z < h[2] + 1 ||
        p.z > h[3] - 1
      ) {
        yaw = Math.atan2(p.x - (h[0] + h[1]) / 2, p.z - (h[2] + h[3]) / 2);
        moving = true;
      }
      r.actor.yaw = yaw;
      const old = { ...p };
      r.actor.update(dt, { forward: moving ? 0.22 : 0 });
      if (p.x < h[0] || p.x > h[1] || p.z < h[2] || p.z > h[3]) {
        p.x = old.x;
        p.z = old.z;
        r.actor.velocity.x = 0;
        r.actor.velocity.z = 0;
      }
    }
    this.match?.update(dt, this.football, human, matchActive);
    if (this.match && !matchActive) return null;
    const goal = this.football.update(dt);
    if (goal !== null) this.match?.reset();
    return goal;
  }
  snapshot() {
    return {
      ...(this.entrance ? { entrance: true } : {}),
      ...(this.match ? { match: this.match.snapshot() } : {}),
      version: 1,
      edits: this.world.serialize(),
      player: this.player.snapshot(),
      football: this.football.snapshot(),
      residents: this.residents.map((r) => r.actor.snapshot()),
    };
  }
}
