// Generator version 1 is part of the save format: never change it in place.
export const SEED = 24092026;
export const MIN = -32,
  MAX = 31,
  HEIGHT = 64,
  EDIT_LIMIT = 10000;
export const BLOCKS = [
  { name: "Aire", color: "#ffffff", time: 0 },
  { name: "Césped", color: "#8aaf47", time: 0.45 },
  { name: "Tierra", color: "#a87350", time: 0.4 },
  { name: "Piedra", color: "#8e9ba5", time: 1.1 },
  { name: "Madera", color: "#b8874c", time: 0.8 },
  { name: "Hojas", color: "#568b52", time: 0.25 },
  { name: "Ladrillo", color: "#c37b61", time: 0.8 },
  { name: "Ámbar", color: "#eac26b", time: 0.8 },
  { name: "Roca base", color: "#404c54", time: Infinity },
];
const key = (x, y, z) => `${x},${y},${z}`;
export function hash(x, z, seed = SEED) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x, z, scale, seed) {
  x /= scale;
  z /= scale;
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const a = x - ix,
    b = z - iz,
    u = a * a * (3 - 2 * a),
    v = b * b * (3 - 2 * b);
  const mix = (a, b, t) => a + (b - a) * t;
  return mix(
    mix(hash(ix, iz, seed), hash(ix + 1, iz, seed), u),
    mix(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), u),
    v,
  );
}
export class World {
  constructor({ seed = SEED, legacy = false } = {}) {
    this.seed = seed;
    this.legacy = legacy;
    this.base = new Uint8Array(64 * 64 * HEIGHT);
    this.edits = new Map();
    this.dirty = new Set();
    for (let x = MIN; x <= MAX; x++)
      for (let z = MIN; z <= MAX; z++) {
        const h = this.terrainHeight(x, z);
        for (let y = 0; y <= h; y++)
          this.base[this.index(x, y, z)] =
            y === 0 ? 8 : y === h ? 1 : y >= h - 2 ? 2 : 3;
      }
    for (let x = MIN + 3; x < MAX - 2; x++)
      for (let z = MIN + 3; z < MAX - 2; z++) {
        if (
          (Math.abs(x) < 5 && Math.abs(z) < 7) ||
          (legacy && Math.abs(x) <= 22 && Math.abs(z) <= 22)
        )
          continue;
        if (x % 5 !== 0 || z % 5 !== 0 || hash(x, z, seed) < 0.32) continue;
        const h = this.terrainHeight(x, z),
          trunk = 3 + Math.floor(hash(z, x, seed) * 2);
        for (let y = 1; y <= trunk; y++) this.base[this.index(x, h + y, z)] = 4;
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++)
            for (let dy = 0; dy <= 2; dy++) {
              if (Math.abs(dx) + Math.abs(dz) + dy > 4) continue;
              const i = this.index(x + dx, h + trunk + dy, z + dz);
              if (!this.base[i]) this.base[i] = 5;
            }
      }
    this.markAll();
  }
  index(x, y, z) {
    return ((x - MIN) * 64 + z - MIN) * HEIGHT + y;
  }
  inside(x, y, z) {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      Number.isInteger(z) &&
      x >= MIN &&
      x <= MAX &&
      z >= MIN &&
      z <= MAX &&
      y >= 0 &&
      y < HEIGHT
    );
  }
  terrainHeight(x, z) {
    if (this.legacy && Math.abs(x) <= 21 && Math.abs(z) <= 21) return 8;
    const h = Math.floor(
      5 + noise(x, z, 19, this.seed) * 9 + noise(x, z, 7, this.seed + 1) * 3,
    );
    const distance = Math.max(Math.abs(x), Math.abs(z));
    return Math.round(
      8 + (h - 8) * Math.min(1, Math.max(0, (distance - 4) / 7)),
    );
  }
  get(x, y, z) {
    if (!this.inside(x, y, z)) return 0;
    return this.edits.get(key(x, y, z)) ?? this.base[this.index(x, y, z)];
  }
  solid(x, y, z) {
    // Invisible boundary prevents falling out of this finite first world.
    return (
      x < MIN || x > MAX || z < MIN || z > MAX || y < 0 || !!this.get(x, y, z)
    );
  }
  set(x, y, z, type) {
    if (
      !this.inside(x, y, z) ||
      y === 0 ||
      !Number.isInteger(type) ||
      type < 0 ||
      type > 7
    )
      return false;
    const k = key(x, y, z),
      original = this.base[this.index(x, y, z)];
    if (this.get(x, y, z) === type) return false;
    if (
      type !== original &&
      !this.edits.has(k) &&
      this.edits.size >= EDIT_LIMIT
    )
      return false;
    if (type === original) this.edits.delete(k);
    else this.edits.set(k, type);
    for (const [dx, dz] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const cx = Math.floor((x + dx - MIN) / 16),
        cz = Math.floor((z + dz - MIN) / 16);
      if (cx >= 0 && cx < 4 && cz >= 0 && cz < 4) this.dirty.add(`${cx},${cz}`);
    }
    return true;
  }
  markAll() {
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++) this.dirty.add(`${x},${z}`);
  }
  serialize() {
    const result = [];
    for (const [k, type] of this.edits)
      result.push(...k.split(",").map(Number), type);
    return result;
  }
  restore(edits) {
    if (
      !Array.isArray(edits) ||
      edits.length % 4 ||
      edits.length > EDIT_LIMIT * 4
    )
      throw new Error("Modificaciones del mundo no válidas");
    for (let i = 0; i < edits.length; i += 4) {
      const [x, y, z, t] = edits.slice(i, i + 4);
      if (
        !this.inside(x, y, z) ||
        y === 0 ||
        !Number.isInteger(t) ||
        t < 0 ||
        t > 7
      )
        throw new Error("Bloque guardado no válido");
    }
    this.edits.clear();
    for (let i = 0; i < edits.length; i += 4)
      this.set(...edits.slice(i, i + 4));
    this.markAll();
  }
  // Grid DDA: target the first solid cell, including faces exposed by mining.
  raycast(origin, direction, reach = 6) {
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!length) return null;
    const d = [
      direction.x / length,
      direction.y / length,
      direction.z / length,
    ];
    const o = [origin.x, origin.y, origin.z],
      cell = o.map(Math.floor);
    const step = d.map((v) => Math.sign(v));
    const delta = d.map((v) => (v === 0 ? Infinity : Math.abs(1 / v)));
    const next = d.map((v, i) =>
      v === 0 ? Infinity : (cell[i] + (v > 0 ? 1 : 0) - o[i]) / v,
    );
    let distance = 0,
      normal = [0, 0, 0];
    while (distance <= reach) {
      const type = this.get(...cell);
      if (type)
        return { x: cell[0], y: cell[1], z: cell[2], type, normal, distance };
      const axis =
        next[0] <= next[1] && next[0] <= next[2]
          ? 0
          : next[1] <= next[2]
            ? 1
            : 2;
      distance = next[axis];
      next[axis] += delta[axis];
      cell[axis] += step[axis];
      normal = [0, 0, 0];
      normal[axis] = -step[axis];
    }
    return null;
  }
}

// Only exposed faces are drawn; edits rebuild at most the neighboring chunks.
export function createWorldView(THREE, world, scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 16 * 9;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  BLOCKS.forEach((block, tile) => {
    ctx.fillStyle = block.color;
    ctx.fillRect(tile * 16, 0, 16, 16);
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        const n = hash(x + tile * 17, y, 47);
        ctx.fillStyle =
          n > 0.5
            ? `rgba(255,255,255,${n * 0.13})`
            : `rgba(20,30,35,${n * 0.24})`;
        ctx.fillRect(tile * 16 + x, y, 1, 1);
        if (tile === 4 && x % 4 === 0) {
          ctx.fillStyle = "#67472955";
          ctx.fillRect(tile * 16 + x, y, 1, 1);
        }
        if (tile === 6 && (y % 8 === 0 || (x + (y < 8 ? 0 : 8)) % 16 === 0)) {
          ctx.fillStyle = "#e2bfa0";
          ctx.fillRect(tile * 16 + x, y, 1, 1);
        }
      }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
  });
  const meshes = new Map();
  const faces = [
    {
      n: [1, 0, 0],
      v: [
        [1, 0, 1],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ],
      light: 0.86,
    },
    {
      n: [-1, 0, 0],
      v: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      light: 0.72,
    },
    {
      n: [0, 1, 0],
      v: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
      light: 1,
    },
    {
      n: [0, -1, 0],
      v: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
      light: 0.5,
    },
    {
      n: [0, 0, 1],
      v: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
      light: 0.9,
    },
    {
      n: [0, 0, -1],
      v: [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      light: 0.78,
    },
  ];
  function rebuild(k) {
    const old = meshes.get(k);
    if (old) {
      scene.remove(old);
      old.geometry.dispose();
    }
    const [cx, cz] = k.split(",").map(Number),
      p = [],
      n = [],
      uv = [],
      color = [],
      indices = [];
    for (let x = MIN + cx * 16; x < MIN + (cx + 1) * 16; x++)
      for (let z = MIN + cz * 16; z < MIN + (cz + 1) * 16; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const type = world.get(x, y, z);
          if (!type) continue;
          for (const face of faces) {
            if (world.get(x + face.n[0], y + face.n[1], z + face.n[2]))
              continue;
            const start = p.length / 3,
              tile = type === 1 && face.n[1] === -1 ? 2 : type;
            const shade =
              face.light * (0.94 + hash(x, z, world.seed + y) * 0.06);
            face.v.forEach((v, i) => {
              p.push(x + v[0], y + v[1], z + v[2]);
              n.push(...face.n);
              color.push(shade, shade, shade);
              uv.push(
                (tile + ([0, 1, 1, 0][i] ? 0.97 : 0.03)) / 9,
                [0, 0, 1, 1][i] ? 0.97 : 0.03,
              );
            });
            indices.push(
              start,
              start + 1,
              start + 2,
              start,
              start + 2,
              start + 3,
            );
          }
        }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    meshes.set(k, mesh);
    scene.add(mesh);
  }
  return {
    update() {
      for (const k of world.dirty) rebuild(k);
      world.dirty.clear();
    },
    dispose() {
      for (const mesh of meshes.values()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      material.dispose();
      texture.dispose();
    },
  };
}
