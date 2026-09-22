// Independent pointer ownership allows moving, looking and mining simultaneously.
export class TouchState {
  constructor() {
    this.pointers = new Map();
    this.reset();
  }
  reset() {
    this.pointers.clear();
    this.forward = 0;
    this.right = 0;
    this.jump = false;
    this.mine = false;
    this.sprint = false;
  }
  begin(id, role, x = 0, y = 0) {
    if ([...this.pointers.values()].some((p) => p.role === role)) return false;
    this.pointers.set(id, { role, x, y });
    if (role === "jump") this.jump = true;
    if (role === "mine") this.mine = true;
    return true;
  }
  move(id, x, y, radius = 44) {
    const p = this.pointers.get(id);
    if (!p) return null;
    const dx = x - p.x,
      dy = y - p.y;
    if (p.role === "look") {
      p.x = x;
      p.y = y;
      return { dx, dy };
    }
    if (p.role === "move") {
      const length = Math.hypot(dx, dy),
        scale = Math.min(1, length / radius),
        dead = 0.12;
      const amount = Math.max(0, (scale - dead) / (1 - dead));
      this.right = length ? (dx / length) * amount : 0;
      this.forward = length ? (-dy / length) * amount : 0;
      this.sprint = scale > 0.94;
      return { x: this.right * radius, y: -this.forward * radius };
    }
    return null;
  }
  end(id) {
    const p = this.pointers.get(id);
    if (!p) return;
    if (p.role === "move") {
      this.forward = 0;
      this.right = 0;
      this.sprint = false;
    }
    if (p.role === "jump") this.jump = false;
    if (p.role === "mine") this.mine = false;
    this.pointers.delete(id);
  }
}
export function bindTouchControls({ elements, active, look, place, mine }) {
  const state = new TouchState();
  function refresh() {
    elements.stick.style.transform = `translate(${state.right * 44}px,${-state.forward * 44}px)`;
    elements.mine.classList.toggle("held", state.mine);
    elements.jump.classList.toggle("held", state.jump);
    mine(state.mine);
  }
  for (const role of ["move", "look", "jump", "mine", "place"]) {
    const element = elements[role];
    element.addEventListener("pointerdown", (event) => {
      if (!active()) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      if (
        !state.begin(
          event.pointerId,
          role,
          role === "move" ? rect.left + rect.width / 2 : event.clientX,
          role === "move" ? rect.top + rect.height / 2 : event.clientY,
        )
      )
        return;
      element.setPointerCapture(event.pointerId);
      if (role === "move")
        state.move(event.pointerId, event.clientX, event.clientY);
      if (role === "place") place();
      refresh();
    });
    element.addEventListener("pointermove", (event) => {
      if (!active()) return;
      const result = state.move(event.pointerId, event.clientX, event.clientY);
      if (role === "look" && result) look(result.dx, result.dy);
      refresh();
    });
    const end = (event) => {
      state.end(event.pointerId);
      refresh();
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      element.addEventListener(event, end);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }
  return {
    state,
    reset() {
      state.reset();
      refresh();
    },
  };
}
