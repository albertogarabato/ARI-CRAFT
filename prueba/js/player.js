import { MIN, MAX, HEIGHT } from "./world.js";
const RADIUS = 0.3,
  BODY = 1.8,
  EYE = 1.62,
  EPS = 0.00001;
export class Player {
  constructor(world) {
    this.world = world;
    this.position = { x: 0.5, y: 10, z: 3.5 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = -0.15;
    this.grounded = false;
    this.respawn();
  }
  overlaps(x, y, z, p = this.position) {
    return (
      p.x + RADIUS > x + EPS &&
      p.x - RADIUS < x + 1 - EPS &&
      p.z + RADIUS > z + EPS &&
      p.z - RADIUS < z + 1 - EPS &&
      p.y + BODY > y + EPS &&
      p.y < y + 1 - EPS
    );
  }
  collides(p = this.position) {
    for (
      let x = Math.floor(p.x - RADIUS + EPS);
      x <= Math.floor(p.x + RADIUS - EPS);
      x++
    )
      for (
        let z = Math.floor(p.z - RADIUS + EPS);
        z <= Math.floor(p.z + RADIUS - EPS);
        z++
      )
        for (
          let y = Math.floor(p.y + EPS);
          y <= Math.floor(p.y + BODY - EPS);
          y++
        )
          if (this.world.solid(x, y, z)) return true;
    return false;
  }
  respawn() {
    this.position = { x: 0.5, y: 1, z: 3.5 };
    for (let y = HEIGHT - 1; y >= 0; y--)
      if (this.world.get(0, y, 3)) {
        this.position.y = y + 1;
        break;
      }
    this.velocity = { x: 0, y: 0, z: 0 };
    this.grounded = false;
  }
  look(dx, dy) {
    this.yaw = (this.yaw - dx * 0.0023) % (Math.PI * 2);
    this.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, this.pitch - dy * 0.0023),
    );
  }
  moveAxis(axis, amount) {
    if (!amount) return;
    const p = this.position,
      before = p[axis];
    p[axis] += amount;
    if (!this.collides()) return;
    // Binary search the last safe position. Each fixed step is < one voxel.
    let low = 0,
      high = 1;
    for (let i = 0; i < 18; i++) {
      const t = (low + high) / 2;
      p[axis] = before + amount * t;
      if (this.collides()) high = t;
      else low = t;
    }
    p[axis] = before + amount * low;
    if (axis === "y" && amount < 0) this.grounded = true;
    this.velocity[axis] = 0;
  }
  update(dt, input) {
    let forward = input.forward || 0,
      right = input.right || 0;
    const length = Math.max(1, Math.hypot(forward, right));
    forward /= length;
    right /= length;
    const speed = input.sprint ? 7 : 4.5,
      blend = 1 - Math.exp(-18 * dt);
    const vx =
      (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * speed;
    const vz =
      (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * speed;
    this.velocity.x += (vx - this.velocity.x) * blend;
    this.velocity.z += (vz - this.velocity.z) * blend;
    if (input.jump && this.grounded) {
      this.velocity.y = 8;
      this.grounded = false;
    }
    this.velocity.y = Math.max(-25, this.velocity.y - 22 * dt);
    this.grounded = false;
    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);
    this.moveAxis("y", this.velocity.y * dt);
    if (this.position.y < -5) this.respawn();
  }
  syncCamera(camera) {
    camera.position.set(
      this.position.x,
      this.position.y + EYE,
      this.position.z,
    );
    camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    camera.updateMatrixWorld();
  }
  snapshot() {
    return { ...this.position, yaw: this.yaw, pitch: this.pitch };
  }
  restore(data) {
    if (
      data &&
      ["x", "y", "z", "yaw", "pitch"].every((k) => Number.isFinite(data[k])) &&
      data.x >= MIN + RADIUS &&
      data.x <= MAX + 1 - RADIUS &&
      data.z >= MIN + RADIUS &&
      data.z <= MAX + 1 - RADIUS &&
      data.y >= 1 &&
      data.y <= HEIGHT + 2
    ) {
      this.position = { x: data.x, y: data.y, z: data.z };
      this.yaw = data.yaw % (Math.PI * 2);
      this.pitch = Math.max(-1.56, Math.min(1.56, data.pitch));
      if (this.collides()) this.respawn();
    } else this.respawn();
    this.velocity = { x: 0, y: 0, z: 0 };
  }
}
