import test from "node:test";
import assert from "node:assert/strict";
import { TouchState, bindTouchControls } from "../js/touch.js";
test("move, look, mine and jump have independent pointer ownership", () => {
  const s = new TouchState();
  s.begin(1, "move", 50, 50);
  s.move(1, 50, 6);
  s.begin(2, "look", 100, 100);
  s.begin(3, "mine");
  s.begin(4, "jump");
  assert.equal(s.forward, 1);
  assert.equal(s.sprint, true);
  assert.equal(s.mine, true);
  assert.equal(s.jump, true);
  assert.deepEqual(s.move(2, 125, 85), { dx: 25, dy: -15 });
  assert.equal(s.forward, 1);
  s.end(2);
  assert.equal(s.mine, true);
  s.end(3);
  assert.equal(s.mine, false);
  assert.equal(s.jump, true);
  assert.equal(s.forward, 1);
  s.end(1);
  assert.equal(s.forward, 0);
  assert.equal(s.sprint, false);
});
test("joystick dead zone, clamping, reverse and diagonal normalization", () => {
  const s = new TouchState();
  s.begin(1, "move", 0, 0);
  s.move(1, 2, 0);
  assert.equal(s.right, 0);
  s.move(1, 100, 100);
  assert.ok(Math.abs(Math.hypot(s.right, s.forward) - 1) < 1e-10);
  assert.ok(s.forward < 0);
  assert.ok(s.right > 0);
  s.move(1, 0, 0);
  assert.equal(s.forward, 0);
  assert.equal(s.right, 0);
});
test("secondary fingers cannot steal a held control and reset clears every action", () => {
  const s = new TouchState();
  assert.equal(s.begin(1, "mine"), true);
  assert.equal(s.begin(2, "mine"), false);
  s.end(2);
  assert.equal(s.mine, true);
  s.begin(3, "jump");
  s.begin(4, "move", 0, 0);
  s.move(4, 44, 0);
  s.reset();
  assert.equal(s.mine, false);
  assert.equal(s.jump, false);
  assert.equal(s.right, 0);
  assert.equal(s.pointers.size, 0);
});
function element() {
  const listeners = {};
  return {
    style: {},
    classList: { toggle() {} },
    addEventListener(n, fn) {
      listeners[n] = fn;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    setPointerCapture() {},
    fire(name, id = 1, x = 50, y = 50) {
      listeners[name]?.({
        pointerId: id,
        clientX: x,
        clientY: y,
        preventDefault() {},
        stopPropagation() {},
      });
    },
  };
}
test("pointer cancellation releases mining and motion; placing triggers once per press", () => {
  const elements = Object.fromEntries(
    ["move", "stick", "look", "jump", "mine", "place"].map((k) => [
      k,
      element(),
    ]),
  );
  let mining = false,
    places = 0,
    active = true;
  const input = bindTouchControls({
    elements,
    active: () => active,
    look() {},
    place: () => places++,
    mine: (v) => (mining = v),
  });
  elements.mine.fire("pointerdown");
  assert.equal(mining, true);
  elements.mine.fire("pointercancel");
  assert.equal(mining, false);
  elements.move.fire("pointerdown", 2, 50, 6);
  assert.equal(input.state.forward, 1);
  elements.move.fire("lostpointercapture", 2);
  assert.equal(input.state.forward, 0);
  elements.place.fire("pointerdown", 3);
  elements.place.fire("pointermove", 3, 80, 80);
  elements.place.fire("pointerup", 3);
  assert.equal(places, 1);
  active = false;
  elements.place.fire("pointerdown", 4);
  assert.equal(places, 1);
  elements.mine.fire("pointerdown", 5);
  assert.equal(mining, false);
});
