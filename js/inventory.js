import { BLOCKS } from "./world.js?v=0.10.0";
export const TOOLS = {
  hand: { name: "Mano", icon: "✋", cost: [] },
  pickaxe: {
    name: "Pico",
    icon: "⛏",
    cost: [
      [11, 2],
      [3, 3],
    ],
    fast: [3, 6, 7, 12],
  },
  axe: {
    name: "Hacha",
    icon: "🪓",
    cost: [
      [11, 2],
      [3, 2],
    ],
    fast: [4, 11],
  },
  shovel: {
    name: "Pala",
    icon: "♧",
    cost: [
      [11, 2],
      [3, 1],
    ],
    fast: [1, 2, 9],
  },
  sword: {
    name: "Espada de práctica",
    icon: "⚔",
    cost: [
      [11, 1],
      [3, 2],
    ],
    fast: [5],
  },
};
export function miningDuration(inventory, type) {
  if (inventory.creative) return 0.2;
  const tool = inventory.activeTool;
  return BLOCKS[type].time / (TOOLS[tool].fast?.includes(type) ? 3 : 1);
}
export function practiceStrike(world, inventory, hit) {
  if (
    inventory.activeTool !== "sword" ||
    !hit ||
    hit.distance > 3 ||
    world.get(hit.x, hit.y, hit.z) !== 20 ||
    world.protected?.(hit.x, hit.y, hit.z)
  )
    return false;
  inventory.trainingHits = Math.min(999999, inventory.trainingHits + 1);
  return true;
}
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 0, 0];
export const SHAPES = {
  cube: { name: "Bloque", cells: [[0, 0]] },
  beam: {
    name: "Pieza larga · 2 bloques",
    cells: [
      [0, 0],
      [1, 0],
    ],
  },
  panel: {
    name: "Panel 2×2 · 4 bloques",
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  arch: {
    name: "Arco · 7 bloques",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 1],
      [2, 0],
    ],
  },
};
export class Inventory {
  constructor({ creative = true } = {}) {
    this.creative = creative;
    this.counts = Array(BLOCKS.length).fill(0);
    this.selected = 0;
    this.shape = "cube";
    this.tool = "hand";
    this.tools = [];
    this.trainingHits = 0;
    this.slots = [...SLOTS];
  }
  get activeTool() {
    return this.creative || this.tools.includes(this.tool) ? this.tool : "hand";
  }
  equipTool(id) {
    if (
      !Object.hasOwn(TOOLS, id) ||
      (id !== "hand" && !this.creative && !this.tools.includes(id))
    )
      return false;
    this.tool = id;
    return true;
  }
  craftTool(id) {
    if (!Object.hasOwn(TOOLS, id) || id === "hand") return false;
    if (!this.creative && !this.tools.includes(id)) {
      if (TOOLS[id].cost.some(([t, n]) => this.counts[t] < n)) return false;
      for (const [t, n] of TOOLS[id].cost) this.counts[t] -= n;
      this.tools.push(id);
    }
    this.tool = id;
    return true;
  }
  get type() {
    return this.slots[this.selected];
  }
  select(index) {
    if (Number.isInteger(index) && index >= 0 && index < 9)
      this.selected = index;
  }
  add(type) {
    if (
      Number.isInteger(type) &&
      type > 0 &&
      type !== 8 &&
      type < BLOCKS.length &&
      this.counts[type] < 99999
    ) {
      this.counts[type]++;
      return true;
    }
    return false;
  }
  take(type) {
    if (
      Number.isInteger(type) &&
      type > 0 &&
      type !== 8 &&
      type < BLOCKS.length &&
      this.counts[type] > 0
    ) {
      this.counts[type]--;
      return true;
    }
    return false;
  }
  snapshot() {
    return {
      counts: [...this.counts],
      slots: [...this.slots],
      selected: this.selected,
      creative: this.creative,
      shape: this.shape,
      tool: this.tool,
      tools: [...this.tools],
      trainingHits: this.trainingHits,
    };
  }
  restore(data) {
    if (
      !data ||
      !Array.isArray(data.counts) ||
      ![8, 18, BLOCKS.length].includes(data.counts.length) ||
      !data.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 99999) ||
      !Number.isInteger(data.selected) ||
      data.selected < 0 ||
      data.selected > 8 ||
      (data.creative !== undefined && typeof data.creative !== "boolean")
    )
      throw new Error("Inventario guardado no válido");
    if (
      data.shape !== undefined &&
      (typeof data.shape !== "string" || !Object.hasOwn(SHAPES, data.shape))
    )
      throw Error("Molde guardado no válido");
    if (
      (data.tool !== undefined &&
        (typeof data.tool !== "string" || !Object.hasOwn(TOOLS, data.tool))) ||
      (data.tools !== undefined &&
        (!Array.isArray(data.tools) ||
          data.tools.length > 4 ||
          new Set(data.tools).size !== data.tools.length ||
          data.tools.some(
            (t) =>
              typeof t !== "string" || t === "hand" || !Object.hasOwn(TOOLS, t),
          ))) ||
      (data.trainingHits !== undefined &&
        (!Number.isInteger(data.trainingHits) ||
          data.trainingHits < 0 ||
          data.trainingHits > 999999))
    )
      throw Error("Herramientas guardadas no válidas");
    this.tool = data.tool ?? "hand";
    this.tools = [...(data.tools ?? [])];
    this.trainingHits = data.trainingHits ?? 0;
    this.shape = data.shape || "cube";
    // Saves from 0.4/0.4.1 become creative without changing their blocks or counts.
    this.creative = data.creative ?? true;
    if (
      data.slots !== undefined &&
      (!Array.isArray(data.slots) ||
        data.slots.length !== 9 ||
        !data.slots.every(
          (t) => Number.isInteger(t) && t >= 0 && t !== 8 && t < BLOCKS.length,
        ))
    )
      throw new Error("Barra guardada no válida");
    this.slots = data.slots ? [...data.slots] : [...SLOTS];
    this.counts = Array.from(
      { length: BLOCKS.length },
      (_, i) => data.counts[i] || 0,
    );
    this.counts[8] = 0;
    this.counts[0] = 0;
    this.selected = data.selected;
  }
  equip(type) {
    if (
      !Number.isInteger(type) ||
      type <= 0 ||
      type === 8 ||
      type >= BLOCKS.length
    )
      return false;
    if (type === 18) this.shape = "cube";
    this.slots[this.selected] = type;
    return true;
  }
  craft(recipe) {
    if (!RECIPES.includes(recipe)) return false;
    if (!this.creative) {
      if (
        this.counts[recipe.type] + recipe.quantity > 99999 ||
        recipe.cost.some(([t, n]) => this.counts[t] < n)
      )
        return false;
      for (const [t, n] of recipe.cost) this.counts[t] -= n;
      this.counts[recipe.type] += recipe.quantity;
    }
    this.equip(recipe.type);
    return true;
  }
  render(container, onSelect) {
    container.replaceChildren();
    this.slots.forEach((type, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot";
      button.classList.toggle("active", index === this.selected);
      button.classList.toggle(
        "empty",
        !type || (!this.creative && !this.counts[type]),
      );
      button.setAttribute("aria-pressed", String(index === this.selected));
      button.setAttribute(
        "aria-label",
        `${index + 1}: ${type ? BLOCKS[type].name + ", " + (this.creative ? "ilimitados" : this.counts[type]) : "Vacío"}`,
      );
      const number = document.createElement("small");
      number.textContent = index + 1;
      button.append(number);
      if (type) {
        const cube = document.createElement("i");
        cube.style.setProperty("--block", BLOCKS[type].color);
        button.append(cube);
        const count = document.createElement("b");
        count.textContent = this.creative ? "∞" : this.counts[type];
        button.append(count);
      }
      button.onclick = () => onSelect(index);
      container.append(button);
    });
  }
}
// Transactions across the world and inventory succeed together or do nothing.
export function mineBlock(world, inventory, hit) {
  if (
    !hit ||
    hit.type === 8 ||
    world.get(hit.x, hit.y, hit.z) !== hit.type ||
    (!inventory.creative && inventory.counts[hit.type] >= 99999)
  )
    return false;
  if (!world.set(hit.x, hit.y, hit.z, 0)) return false;
  if (!inventory.creative) inventory.add(hit.type);
  return true;
}
export function placeBlock(world, inventory, player, hit) {
  const type = inventory.type,
    shape = SHAPES[inventory.shape];
  if (
    !hit ||
    !type ||
    !shape ||
    !hit.normal.some(Boolean) ||
    (!inventory.creative && inventory.counts[type] < shape.cells.length)
  )
    return false;
  const yaw = player.yaw || 0;
  const axis =
    Math.abs(Math.cos(yaw)) >= Math.abs(Math.sin(yaw))
      ? [Math.sign(Math.cos(yaw)), 0]
      : [0, -Math.sign(Math.sin(yaw))];
  const cells = shape.cells.map(([side, up]) => [
    hit.x + hit.normal[0] + side * axis[0],
    hit.y + hit.normal[1] + up,
    hit.z + hit.normal[2] + side * axis[1],
  ]);
  if (
    type === 18 &&
    (inventory.shape !== "cube" ||
      cells.some(
        ([x, y, z]) => !world.get(x, y - 1, z) || world.get(x, y - 1, z) === 18,
      ))
  )
    return false;
  if (
    cells.some(
      ([x, y, z]) =>
        world.get(x, y, z) ||
        player.overlaps(x, y, z) ||
        !world.inside(x, y, z) ||
        world.protected?.(x, y, z),
    )
  )
    return false;
  const applied = [];
  for (const cell of cells) {
    if (!world.set(...cell, type)) {
      for (const placed of applied) world.set(...placed, 0);
      return false;
    }
    applied.push(cell);
  }
  if (!inventory.creative) inventory.counts[type] -= cells.length;
  return true;
}

export const RECIPES = [
  {
    type: 18,
    quantity: 4,
    cost: [
      [11, 1],
      [7, 1],
    ],
  },
  {
    type: 19,
    quantity: 2,
    cost: [
      [10, 2],
      [5, 1],
    ],
  },
  {
    type: 20,
    quantity: 1,
    cost: [
      [11, 4],
      [6, 1],
    ],
  },
  { type: 11, quantity: 4, cost: [[4, 1]] },
  { type: 12, quantity: 1, cost: [[3, 1]] },
  { type: 9, quantity: 2, cost: [[2, 2]] },
  {
    type: 10,
    quantity: 2,
    cost: [
      [9, 2],
      [3, 1],
    ],
  },
  {
    type: 6,
    quantity: 4,
    cost: [
      [3, 2],
      [2, 1],
    ],
  },
  {
    type: 7,
    quantity: 2,
    cost: [
      [9, 2],
      [3, 2],
    ],
  },
  ...[13, 14, 15, 16, 17].map((type) => ({
    type,
    quantity: 4,
    cost: [
      [12, 2],
      [5, 1],
    ],
  })),
];
