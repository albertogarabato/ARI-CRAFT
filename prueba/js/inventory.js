import { BLOCKS } from "./world.js";
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 0, 0];
export class Inventory {
  constructor() {
    this.counts = Array(8).fill(0);
    this.selected = 0;
  }
  get type() {
    return SLOTS[this.selected];
  }
  select(index) {
    if (Number.isInteger(index) && index >= 0 && index < 9)
      this.selected = index;
  }
  add(type) {
    if (type > 0 && type < 8 && this.counts[type] < 99999) {
      this.counts[type]++;
      return true;
    }
    return false;
  }
  take(type) {
    if (type > 0 && type < 8 && this.counts[type] > 0) {
      this.counts[type]--;
      return true;
    }
    return false;
  }
  snapshot() {
    return { counts: [...this.counts], selected: this.selected };
  }
  restore(data) {
    if (
      !data ||
      !Array.isArray(data.counts) ||
      data.counts.length !== 8 ||
      !data.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 99999) ||
      !Number.isInteger(data.selected) ||
      data.selected < 0 ||
      data.selected > 8
    )
      throw new Error("Inventario guardado no válido");
    this.counts = [...data.counts];
    this.counts[0] = 0;
    this.selected = data.selected;
  }
  render(container, onSelect) {
    container.replaceChildren();
    SLOTS.forEach((type, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot";
      button.classList.toggle("active", index === this.selected);
      button.classList.toggle("empty", !type || !this.counts[type]);
      button.setAttribute("aria-pressed", String(index === this.selected));
      button.setAttribute(
        "aria-label",
        `${index + 1}: ${type ? BLOCKS[type].name + ", " + this.counts[type] : "Vacío"}`,
      );
      const number = document.createElement("small");
      number.textContent = index + 1;
      button.append(number);
      if (type) {
        const cube = document.createElement("i");
        cube.style.setProperty("--block", BLOCKS[type].color);
        button.append(cube);
        const count = document.createElement("b");
        count.textContent = this.counts[type];
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
    inventory.counts[hit.type] >= 99999
  )
    return false;
  if (!world.set(hit.x, hit.y, hit.z, 0)) return false;
  inventory.add(hit.type);
  return true;
}
export function placeBlock(world, inventory, player, hit) {
  const type = inventory.type;
  if (!hit || !type || !inventory.counts[type] || !hit.normal.some(Boolean))
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
  inventory.take(type);
  return true;
}
