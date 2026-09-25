// Original ARI CRAFT players: a white-and-gold team inspired by Madrid.
// Team 0 (Ari + white) attacks z=-8; team 1 (coral) attacks z=20.
export const SQUAD = [
  {
    name: "Blanco 7",
    number: 7,
    team: 0,
    keeper: false,
    x: 11,
    z: 11,
    skin: "#bf865e",
    hair: "#302d2e",
  },
  {
    name: "Portero blanco",
    number: 1,
    team: 0,
    keeper: true,
    x: 15,
    z: 18.7,
    skin: "#edbd91",
    hair: "#533b30",
  },
  {
    name: "Coral 9",
    number: 9,
    team: 1,
    keeper: false,
    x: 12,
    z: 1,
    skin: "#80563e",
    hair: "#252629",
  },
  {
    name: "Coral 11",
    number: 11,
    team: 1,
    keeper: false,
    x: 20,
    z: 2,
    skin: "#e2aa7f",
    hair: "#664333",
  },
  {
    name: "Portero coral",
    number: 1,
    team: 1,
    keeper: true,
    x: 15,
    z: -6.7,
    skin: "#b87d55",
    hair: "#292b30",
  },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class FootballTeam {
  constructor(saved) {
    this.active = false;
    this.touchDelay = 0;
    this.players = SQUAD.map((s) => ({
      ...s,
      yaw: s.team === 0 ? 0 : Math.PI,
      cooldown: 0,
      phase: 0,
      swing: 0,
      moving: false,
    }));
    if (saved !== undefined) {
      if (
        !saved ||
        saved.version !== 1 ||
        !Array.isArray(saved.players) ||
        saved.players.length !== 5 ||
        !Number.isFinite(saved.touchDelay) ||
        saved.touchDelay < 0 ||
        saved.touchDelay > 2
      )
        throw Error("Futbolistas guardados no válidos");
      this.touchDelay = saved.touchDelay;
      saved.players.forEach((p, i) => {
        if (
          !p ||
          !["x", "z", "yaw", "cooldown", "swing"].every((k) =>
            Number.isFinite(p[k]),
          ) ||
          p.x < 6.5 ||
          p.x > 23.5 ||
          p.z < -7.3 ||
          p.z > 19.3 ||
          p.cooldown < 0 ||
          p.cooldown > 3 ||
          p.swing < 0 ||
          p.swing > 1
        )
          throw Error("Posición de futbolista no válida");
        if (this.players[i].keeper && Math.abs(p.z - SQUAD[i].z) > 0.001)
          throw Error("Portero fuera de su portería");
        Object.assign(this.players[i], {
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          cooldown: p.cooldown,
          swing: p.swing,
        });
      });
    }
  }
  reset() {
    this.players.forEach((p, i) =>
      Object.assign(p, {
        x: SQUAD[i].x,
        z: SQUAD[i].z,
        cooldown: 0.8,
        swing: 0,
        moving: false,
      }),
    );
    this.touchDelay = 1.2;
  }
  humanKick() {
    this.touchDelay = 0.65;
  }
  update(dt, football, human, active) {
    this.active = !!active;
    if (!active) {
      for (const p of this.players) p.moving = false;
      return;
    }
    this.touchDelay = Math.max(0, this.touchDelay - dt);
    const b = football.ball;
    for (const p of this.players) {
      p.phase += dt;
      p.swing = Math.max(0, p.swing - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (football.cooldown > 0) {
        p.moving = false;
        continue;
      }
      const goalZ = p.team === 0 ? -8 : 20;
      const teammates = this.players.filter(
        (q) => q.team === p.team && !q.keeper,
      );
      const nearest = teammates.reduce(
        (a, q) => (distance(q, b) < distance(a, b) ? q : a),
        teammates[0],
      );
      const humanHasBall =
        p.team === 0 && human && distance(human.position, b) < 2.2;
      let tx, tz;
      if (p.keeper) {
        tx = clamp(b.x, 12.7, 17.3);
        tz = SQUAD[this.players.indexOf(p)].z;
      } else if (p !== nearest || humanHasBall) {
        tx = clamp(b.x + (p.x < b.x ? -4 : 4), 7.3, 22.7);
        tz = clamp(b.z + (p.team === 0 ? -4 : 4), -5, 17);
      } else {
        const len = Math.hypot(15 - b.x, goalZ - b.z) || 1;
        tx = b.x - ((15 - b.x) / len) * 0.7;
        tz = b.z - ((goalZ - b.z) / len) * 0.7;
      }
      tx = clamp(tx, 6.5, 23.5);
      tz = clamp(tz, -7.3, 19.3);
      const dx = tx - p.x,
        dz = tz - p.z,
        len = Math.hypot(dx, dz);
      const speed = p.keeper ? 3.3 : p.team === 0 ? 2.9 : 2.2;
      p.moving = len > 0.12;
      if (p.moving) {
        const step = Math.min(len, speed * dt);
        let nx = p.x + (dx / len) * step,
          nz = p.z + (dz / len) * step;
        // Soft avoidance lets Ari move freely and stops players standing inside one another.
        for (const q of this.players)
          if (q !== p) {
            const gap = Math.hypot(nx - q.x, nz - q.z);
            if (gap < 0.62 && gap > 0.0001) {
              nx += ((nx - q.x) / gap) * dt;
              if (!p.keeper) nz += ((nz - q.z) / gap) * dt;
            }
          }
        if (human) {
          const q = human.position,
            gap = Math.hypot(nx - q.x, nz - q.z);
          if (gap < 0.85 && gap > 0.0001) {
            nx += ((nx - q.x) / gap) * speed * dt;
            if (!p.keeper) nz += ((nz - q.z) / gap) * speed * dt;
          }
        }
        p.x = clamp(nx, 6.5, 23.5);
        p.z = p.keeper ? tz : clamp(nz, -7.3, 19.3);
        p.yaw = Math.atan2(-dx, -dz);
      }
      if (
        this.touchDelay ||
        p.cooldown ||
        distance(p, b) > (p.keeper ? 1.25 : 1.05) ||
        b.y > (p.keeper ? 11.05 : 10.1) ||
        humanHasBall
      )
        continue;
      // Strike toward the opposing goal. A distant white teammate passes to Ari when available.
      const pass =
        !p.keeper &&
        p.team === 0 &&
        human &&
        distance(p, human.position) > 3 &&
        distance(p, human.position) < 12 &&
        Math.abs(goalZ - b.z) > 12;
      const aimX = pass ? human.position.x : 15 + ((p.number % 3) - 1) * 0.85;
      const aimZ = pass ? human.position.z : goalZ;
      const length = Math.hypot(aimX - b.x, aimZ - b.z) || 1;
      const power = pass ? 9 : p.keeper ? 15 : 16;
      b.vx = ((aimX - b.x) / length) * power;
      b.vz = ((aimZ - b.z) / length) * power;
      b.vy = p.keeper ? 2.5 : pass ? 1.2 : 2.1;
      p.yaw = Math.atan2(-b.vx, -b.vz);
      p.cooldown = 1;
      p.swing = 0.3;
      this.touchDelay = 0.45;
    }
  }
  snapshot() {
    return {
      version: 1,
      touchDelay: this.touchDelay,
      players: this.players.map((p) => ({
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        cooldown: p.cooldown,
        swing: p.swing,
      })),
    };
  }
}
