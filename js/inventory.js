import { BLOCKS } from "./world.js?v=0.7.1";
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 0, 0];
export class Inventory {
  constructor({ creative = true } = {}) {
    this.creative = creative;
    this.counts = Array(BLOCKS.length).fill(0);
    this.selected = 0;
    this.slots = [...SLOTS];
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
    };
  }
  restore(data) {
    if (
      !data ||
      !Array.isArray(data.counts) ||
      ![8, BLOCKS.length].includes(data.counts.length) ||
      !data.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 99999) ||
      !Number.isInteger(data.selected) ||
      data.selected < 0 ||
      data.selected > 8 ||
      (data.creative !== undefined && typeof data.creative !== "boolean")
    )
      throw new Error("Inventario guardado no válido");
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
  const type = inventory.type;
  if (
    !hit ||
    !type ||
    (!inventory.creative && !inventory.counts[type]) ||
    !hit.normal.some(Boolean)
  )
    return false;
  const [x, y, z] = [
    hit.x + hit.normal[0],
    hit.y + hit.normal[1],
    hit.z + hit.normal[2],
  ];
  if (
    world.get(x, y, z) ||
    player.overlaps(x, y, z) ||
    !world.set(x, y, z, type)
  )
    return false;
  if (!inventory.creative) inventory.take(type);
  return true;
}

export const RECIPES = [
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
