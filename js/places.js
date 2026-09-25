import { World, hash } from "./world.js?v=0.9.0";
export const PLACES = [
  { id: "forest", name: "Bosque del Roble", x: 0, z: 64, sign: [0, 14, -8] },
  { id: "dunes", name: "Aldea del Sol", x: 64, z: 64, sign: [0, 14, -8] },
  { id: "bricks", name: "Barrio de Piezas", x: 128, z: 64, sign: [0, 15, -8] },
];
export const PLACE_LIMIT = 2000;
// Generator 1: all new scenery is north of the previously accessible world.
export function createPlaces(connected, saved) {
  if (
    saved !== undefined &&
    (!Array.isArray(saved) ||
      saved.length !== 3 ||
      saved.some(
        (r, i) =>
          !r ||
          r.id !== PLACES[i].id ||
          !Array.isArray(r.edits) ||
          r.edits.length > PLACE_LIMIT * 4,
      ))
  )
    throw Error("Escenarios guardados incompletos");
  return PLACES.map((place, index) => {
    const w = new World({ seed: connected.home.seed + 300 + index });
    w.base.fill(0);
    const put = (x, y, z, t) => {
      if (w.inside(x, y, z)) w.base[w.index(x, y, z)] = t;
    };
    for (let x = -32; x <= 31; x++)
      for (let z = -32; z <= 31; z++) {
        // Match each old border's ground without altering a single existing column.
        const [old, lx] = connected.local(x + place.x, 31);
        let edge = 0;
        for (let y = 1; y < 64; y++) {
          const t = old.base[old.index(lx, y, 31)];
          if (t && ![4, 5].includes(t)) edge = y;
        }
        const path = Math.abs(z) <= 1 || Math.abs(x) <= 1;
        const hill =
          index === 0
            ? Math.round(2 + Math.sin(x * 0.15) * Math.sin(z * 0.13) * 2)
            : index === 1
              ? Math.round(2 + Math.sin(x * 0.15 + z * 0.11) * 2)
              : 0;
        const target = path ? 8 : 8 + hill;
        const blend = Math.min(1, (z + 33) / 18);
        const h = Math.round(edge + (target - edge) * blend);
        for (let y = 0; y <= h; y++)
          put(
            x,
            y,
            z,
            y === 0
              ? 8
              : y === h
                ? path
                  ? 12
                  : index === 1
                    ? 9
                    : 1
                : y >= h - 2
                  ? index === 1
                    ? 9
                    : 2
                  : 3,
          );
      }
    const flat = (x0, z0, x1, z1, type = 1) => {
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++)
          for (let y = 1; y < 40; y++)
            put(x, y, z, y > 8 ? 0 : y === 8 ? type : y > 5 ? 2 : 3);
    };
    const tree = (x, z, height = 5) => {
      let h = 0;
      for (let y = 1; y < 30; y++) if (w.get(x, y, z)) h = y;
      for (let y = 1; y <= height; y++) put(x, h + y, z, 4);
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dy = -1; dy <= 2; dy++)
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 5)
              put(x + dx, h + height + dy, z + dz, 5);
    };
    const house = (x, z, wall, roof) => {
      flat(x - 1, z - 1, x + 7, z + 8, index === 1 ? 9 : 1);
      for (let dx = 0; dx < 7; dx++)
        for (let dz = 0; dz < 7; dz++) {
          put(x + dx, 8, z + dz, 11);
          for (let y = 9; y <= 12; y++) {
            const edge = dx === 0 || dx === 6 || dz === 0 || dz === 6;
            const door = dz === 6 && dx === 3 && y < 12;
            const window =
              (dx === 0 || dx === 6) &&
              dz >= 2 &&
              dz <= 3 &&
              (y === 10 || y === 11);
            if (edge && !door) put(x + dx, y, z + dz, window ? 10 : wall);
          }
          put(x + dx, 13, z + dz, roof);
          if (dx > 0 && dx < 6) put(x + dx, 14, z + dz, roof);
        }
      for (let zz = z + 7; zz < 0; zz++)
        for (let xx = x + 2; xx <= x + 4; xx++) {
          for (let y = 9; y < 30; y++) put(xx, y, zz, 0);
          put(xx, 8, zz, 12);
        }
      put(x + 1, 9, z + 2, 11);
      put(x + 5, 9, z + 2, roof);
    };
    if (index === 0) {
      for (let x = -26; x <= 26; x += 6)
        for (let z = -20; z <= 26; z += 6)
          if (Math.abs(x) > 5 && Math.abs(z) > 5 && hash(x, z, w.seed) > 0.25)
            tree(x, z, 5 + Math.floor(hash(z, x, w.seed) * 3));
      house(-20, -16, 11, 4);
      // A walk-through timber arch frames the forest trail.
      for (const x of [-3, 3]) for (let y = 9; y <= 13; y++) put(x, y, 5, 4);
      for (let x = -3; x <= 3; x++) put(x, 14, 5, 11);
    } else if (index === 1) {
      house(-21, -17, 7, 9);
      house(8, -18, 9, 7);
      flat(-8, 5, 9, 22, 9);
      // Small stepped pyramid with a doorway and hollow central room.
      for (let y = 9; y <= 15; y++)
        for (let x = -6 + (y - 9); x <= 6 - (y - 9); x++)
          for (let z = 8 + (y - 9); z <= 20 - (y - 9); z++) {
            const edge =
              x === -6 + y - 9 ||
              x === 6 - (y - 9) ||
              z === 8 + y - 9 ||
              z === 20 - (y - 9);
            if (edge && !(Math.abs(x) <= 1 && z <= 11 && y <= 11))
              put(x, y, z, 7);
          }
      for (const [x, z] of [
        [-25, 12],
        [22, 15],
        [-11, -14],
        [16, 26],
      ]) {
        for (let y = 9; y <= 13; y++) put(x, y, z, 17);
        put(x + 1, 11, z, 17);
        put(x + 1, 12, z, 17);
      }
    } else {
      flat(-28, -22, 28, 28, 12);
      house(-22, -17, 13, 15);
      house(8, -17, 14, 16);
      // Display car, built entirely from editable construction blocks.
      for (let x = -18; x <= -12; x++)
        for (let z = 9; z <= 12; z++) put(x, 10, z, 15);
      for (let x = -16; x <= -14; x++)
        for (let z = 9; z <= 12; z++) put(x, 11, z, 10);
      for (let x = -16; x <= -14; x++)
        for (let z = 9; z <= 12; z++) put(x, 12, z, 16);
      for (const x of [-17, -13]) for (const z of [8, 13]) put(x, 9, z, 3);
      // A large friendly robot and a colourful gate show how modules combine.
      for (const x of [14, 18])
        for (let y = 9; y <= 12; y++)
          for (let z = 11; z <= 12; z++) put(x, y, z, 14);
      for (let x = 13; x <= 19; x++)
        for (let y = 13; y <= 16; y++)
          for (let z = 10; z <= 13; z++) put(x, y, z, 16);
      for (let x = 14; x <= 18; x++)
        for (let y = 17; y <= 20; y++)
          for (let z = 10; z <= 13; z++) put(x, y, z, 13);
      for (const x of [15, 17]) put(x, 19, 9, 14);
      for (const x of [12, 20]) put(x, 15, 11, 15);
      for (const x of [11, 21])
        for (let y = 12; y <= 15; y++) put(x, y, 11, 15);
      for (const x of [-4, 4])
        for (let y = 9; y <= 14; y++) put(x, y, 3, y % 2 ? 14 : 15);
      for (let x = -4; x <= 4; x++) put(x, 15, 3, 16);
      // Leave a large marked work area next to the demonstrations.
      for (let x = -7; x <= 7; x++)
        for (let z = 17; z <= 28; z++)
          put(x, 8, z, x === -7 || x === 7 || z === 17 || z === 28 ? 16 : 13);
    }
    // The east-west path is always level and clear between all three scenarios.
    for (let x = -32; x <= 31; x++)
      for (let z = -1; z <= 1; z++)
        for (let y = 1; y < 30; y++)
          put(x, y, z, y > 8 ? 0 : y === 8 ? 12 : y > 5 ? 2 : 3);
    const set = w.set.bind(w);
    w.set = (x, y, z, t) => {
      if (
        w.edits.size >= PLACE_LIMIT &&
        !w.edits.has(`${x},${y},${z}`) &&
        w.inside(x, y, z) &&
        t !== w.base[w.index(x, y, z)]
      )
        return false;
      return set(x, y, z, t);
    };
    w.restore(saved?.[index].edits || []);
    return { ...place, world: w };
  });
}

export function createPlacesView(THREE, world, scene) {
  const root = new THREE.Group(),
    textures = [],
    materials = [];
  const geometry = new THREE.BoxGeometry(0.16, 1, 0.16);
  const wood = new THREE.MeshLambertMaterial({ color: "#856044" });
  for (const r of world.places || []) {
    const [sx, sy, sz] = r.sign;
    const post = new THREE.Mesh(geometry, wood);
    post.position.set(r.x + sx + 3, (sy + 8) / 2, r.z + sz);
    post.scale.y = sy - 8;
    root.add(post);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle =
      r.id === "bricks" ? "#245187" : r.id === "dunes" ? "#87602e" : "#254b37";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#fff5d9";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(r.name, 256, 48, 490);
    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);
    const mat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    materials.push(mat);
    const sign = new THREE.Sprite(mat);
    sign.position.set(r.x + sx + 3, sy, r.z + sz);
    sign.scale.set(6, 1.125, 1);
    root.add(sign);
  }
  scene.add(root);
  return {
    dispose() {
      scene.remove(root);
      geometry.dispose();
      wood.dispose();
      for (const t of textures) t.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
