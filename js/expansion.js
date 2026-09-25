import { World } from "./world.js?v=0.9.0";
export const EXPANSION_OFFSETS = [-128, -64, 160, 224];
export const EXPANSION_LIMIT = 1500;
// New generation is confined to previously inaccessible columns. Old terrain is untouched.
export function createExpansion(home, village, saved) {
  if (
    saved !== undefined &&
    (!Array.isArray(saved) ||
      saved.length !== 4 ||
      !saved.every((r) => Array.isArray(r) || (r && Array.isArray(r.edits))))
  )
    throw Error("Ampliación guardada incompleta");
  return EXPANSION_OFFSETS.map((offset, index) => {
    const w = new World({ seed: home.seed + 100 + index });
    w.base.fill(0);
    for (let x = -32; x <= 31; x++)
      for (let z = -32; z <= 31; z++) {
        const gx = x + offset;
        const edge =
          gx < -32 ? home.terrainHeight(-32, z) : village.terrainHeight(31, z);
        const distance = gx < -32 ? -32 - gx : gx - 127;
        const h = Math.round(edge + (8 - edge) * Math.min(1, distance / 16));
        const sand = (index === 0 || index === 3) && Math.abs(z - 20) < 5;
        for (let y = 0; y <= h; y++)
          w.base[w.index(x, y, z)] =
            y === 0 ? 8 : y === h ? (sand ? 9 : 1) : y >= h - 2 ? 2 : 3;
        // A tree line leaves a broad, level central building area.
        if (distance > 20 && x % 12 === 0 && z === -24) {
          for (let y = h + 1; y <= h + 4; y++) w.base[w.index(x, y, z)] = 4;
          for (let dx = -2; dx <= 2; dx++)
            for (let dz = -2; dz <= 2; dz++)
              for (let dy = 0; dy <= 2; dy++)
                if (Math.abs(dx) + Math.abs(dz) + dy <= 4)
                  w.base[w.index(x + dx, h + 4 + dy, z + dz)] = 5;
        }
      }
    const set = w.set.bind(w);
    w.set = (x, y, z, t) => {
      if (
        w.edits.size >= EXPANSION_LIMIT &&
        !w.edits.has(`${x},${y},${z}`) &&
        w.inside(x, y, z) &&
        t !== w.base[w.index(x, y, z)]
      )
        return false;
      return set(x, y, z, t);
    };
    const region = saved?.[index];
    const edits = Array.isArray(region) ? region : region?.edits || [];
    if (!Array.isArray(edits) || edits.length > EXPANSION_LIMIT * 4)
      throw Error("Demasiados cambios en la ampliación");
    w.restore(edits);
    return { world: w, offset };
  });
}
