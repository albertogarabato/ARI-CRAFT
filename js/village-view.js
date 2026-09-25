// All models are assembled here from original geometric shapes; no external assets.
export function createVillageView(THREE, village, scene) {
  const root = new THREE.Group(),
    materials = new Map(),
    textures = [];
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const material = (color) => {
    if (!materials.has(color))
      materials.set(color, new THREE.MeshLambertMaterial({ color }));
    return materials.get(color);
  };
  function box(parent, x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(cube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  function label(text, x, y, z, width = 3) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#17343bea";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#eff4d5";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48, 490);
    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);
    const mat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(width, (width * 96) / 512, 1);
    root.add(sprite);
    return sprite;
  }
  // Painted field markings, above the grass without replacing any terrain.
  const white = "#f9f3de";
  const line = (x, z, w, d) => box(root, x, 9.018, z, w, 0.025, d, white);
  line(15, -8, 18, 0.1);
  line(15, 20, 18, 0.1);
  line(6, 6, 0.1, 28);
  line(24, 6, 0.1, 28);
  line(15, 6, 18, 0.1);
  for (const z of [-8, 20]) {
    const inward = z < 0 ? 1 : -1;
    line(15, z + inward * 4, 10, 0.1);
    line(10, z + inward * 2, 0.1, 4);
    line(20, z + inward * 2, 0.1, 4);
    for (const x of [12, 18]) box(root, x, 10.4, z, 0.15, 2.8, 0.15, white);
    box(root, 15, 11.8, z, 6.15, 0.15, 0.15, white);
    // Nets behind the goal line, leaving a clear mouth.
    for (let x = 12; x <= 18; x += 0.5)
      box(root, x, 10.4, z - inward, 0.035, 2.8, 0.035, "#b4cece");
    for (let y = 9.4; y <= 11.8; y += 0.4)
      box(root, 15, y, z - inward, 6, 0.035, 0.035, "#b4cece");
    for (const x of [12, 18])
      for (let y = 9.4; y <= 11.8; y += 0.4)
        box(root, x, y, z - inward * 0.5, 0.035, 0.035, 1, "#b4cece");
  }
  const ringGeometry = new THREE.RingGeometry(2.8, 2.88, 48);
  const ring = new THREE.Mesh(ringGeometry, material(white));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(15, 9.035, 6);
  root.add(ring);
  label("PORTERÍA CORAL", 15, 12.5, -9, 3.7);
  label("PORTERÍA BLANCA", 15, 12.5, 21, 3.7);
  box(root, 3.5, 10, 7, 0.15, 2, 0.15, "#846447");
  label("CAMPO DE ARI →", 3.5, 11.3, 7, 3.4);
  label("ALDEA GIRASOL", -12, 16.8, -18, 6);
  label("PRADO DE LOS AMIGOS", -16, 11.2, 3, 4.5);
  for (const [x, z] of [
    [-23, -20],
    [-14, -22],
    [-5, -20],
  ]) {
    // Small flower boxes under open windows.
    box(root, x - 0.3, 9.8, z + 3, 0.6, 0.25, 1.6, "#865c3b");
    for (const dz of [2.6, 3.2, 3.6]) {
      box(root, x - 0.3, 10.2, z + dz, 0.07, 0.5, 0.07, "#547849");
      box(root, x - 0.3, 10.48, z + dz, 0.28, 0.2, 0.28, "#e8ae61");
    }
  }
  const actors = village.residents.map((r) => {
    const group = new THREE.Group();
    root.add(group);
    const legs = [];
    if (r.kind === "villager") {
      box(group, 0, 1.02, 0, 0.58, 0.7, 0.35, r.color);
      box(group, 0, 1.65, 0, 0.48, 0.5, 0.46, "#ca986e");
      box(group, 0, 1.95, 0, 0.64, 0.12, 0.6, "#735540");
      for (const x of [-0.16, 0.16])
        legs.push(box(group, x, 0.34, 0, 0.2, 0.68, 0.23, "#344c5b"));
      for (const x of [-0.39, 0.39])
        box(group, x, 1, 0, 0.18, 0.68, 0.22, "#ca986e");
      for (const x of [-0.12, 0.12])
        box(group, x, 1.7, -0.239, 0.065, 0.07, 0.035, "#24333d");
    } else if (r.kind === "chicken") {
      box(group, 0, 0.45, 0, 0.45, 0.45, 0.55, r.color);
      box(group, 0, 0.77, -0.2, 0.28, 0.3, 0.3, r.color);
      box(group, 0, 0.73, -0.42, 0.14, 0.1, 0.2, "#e2ac41");
      box(group, 0, 0.96, -0.2, 0.1, 0.15, 0.2, "#c95d4d");
      for (const x of [-0.12, 0.12]) {
        legs.push(box(group, x, 0.15, 0, 0.06, 0.3, 0.07, "#d29b41"));
        box(group, x, 0.8, -0.36, 0.04, 0.05, 0.025, "#28333b");
      }
    } else {
      box(group, 0, 0.75, 0, 0.75, 0.65, 1.05, r.color);
      box(
        group,
        0,
        0.94,
        -0.63,
        0.5,
        0.5,
        0.48,
        r.kind === "sheep" ? "#998675" : "#df9796",
      );
      if (r.kind === "pig")
        box(group, 0, 0.85, -0.92, 0.32, 0.2, 0.17, "#bf737b");
      for (const x of [-0.23, 0.23])
        for (const z of [-0.34, 0.34])
          legs.push(
            box(
              group,
              x,
              0.23,
              z,
              0.17,
              0.46,
              0.18,
              r.kind === "sheep" ? "#75675a" : "#bf8583",
            ),
          );
      for (const x of [-0.17, 0.17])
        box(group, x, 1.03, -0.88, 0.065, 0.07, 0.03, "#26313a");
      for (const x of [-0.29, 0.29])
        box(group, x, 1.17, -0.62, 0.16, 0.19, 0.2, r.color);
    }
    const name = label(r.name, 0, 0, 0, 1.35);
    return { r, group, legs, name };
  });
  const kitMaterials = [],
    kitGeometry = new THREE.PlaneGeometry(0.32, 0.42);
  const footballers = (village.match?.players || []).map((p) => {
    const group = new THREE.Group();
    root.add(group);
    const kit = p.keeper
      ? p.team === 0
        ? "#8263bf"
        : "#429775"
      : p.team === 0
        ? "#faf8ef"
        : "#e87769";
    const trim = p.team === 0 ? "#d6b24d" : "#213e50";
    const legs = [],
      arms = [];
    box(group, 0, 1.05, 0, 0.58, 0.65, 0.36, kit);
    box(group, 0, 0.7, 0, 0.57, 0.25, 0.36, kit);
    box(group, 0, 1.4, 0, 0.22, 0.1, 0.24, trim);
    box(group, 0, 1.69, 0, 0.44, 0.47, 0.42, p.skin);
    box(group, 0, 1.94, 0.035, 0.47, 0.12, 0.42, p.hair);
    box(group, 0, 1.82, 0.19, 0.47, 0.23, 0.06, p.hair);
    for (const x of [-0.12, 0.12])
      box(group, x, 1.72, -0.221, 0.055, 0.055, 0.025, "#24333d");
    for (const x of [-0.17, 0.17]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.65, 0);
      group.add(leg);
      box(leg, 0, -0.19, 0, 0.19, 0.35, 0.22, p.skin);
      box(leg, 0, -0.43, 0, 0.2, 0.23, 0.24, kit);
      box(leg, 0, -0.58, -0.07, 0.23, 0.15, 0.39, "#29333e");
      legs.push(leg);
    }
    for (const x of [-0.4, 0.4]) {
      const arm = new THREE.Group();
      arm.position.set(x, 1.25, 0);
      group.add(arm);
      box(arm, 0, -0.1, 0, 0.18, 0.27, 0.24, kit);
      box(arm, 0, -0.25, 0, 0.19, 0.06, 0.25, trim);
      box(arm, 0, -0.4, 0, 0.17, 0.29, 0.21, p.skin);
      if (p.keeper) box(arm, 0, -0.55, -0.02, 0.23, 0.2, 0.27, "#eaf1db");
      arms.push(arm);
    }
    for (const x of [-0.24, 0.24])
      box(group, x, 1.1, -0.188, 0.045, 0.47, 0.025, trim);
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = p.team === 0 ? "#a58430" : "#17343b";
    ctx.font = "bold 98px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.number), 48, 68);
    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);
    const jersey = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    kitMaterials.push(jersey);
    for (const side of [-1, 1]) {
      const number = new THREE.Mesh(kitGeometry, jersey);
      number.position.set(0, 1.04, side * 0.192);
      number.rotation.y = side < 0 ? Math.PI : 0;
      group.add(number);
    }
    const name = label(p.name, 0, 0, 0, p.keeper ? 2.2 : 1.65);
    return { p, group, legs, arms, name };
  });
  const ballGeometry = new THREE.IcosahedronGeometry(0.32, 1);
  const positions = ballGeometry.getAttribute("position"),
    colors = [];
  for (let face = 0; face < positions.count / 3; face++) {
    const color = new THREE.Color(
      face % 7 === 0 || face % 11 === 0 ? "#29475d" : "#fff6de",
    );
    for (let vertex = 0; vertex < 3; vertex++)
      colors.push(color.r, color.g, color.b);
  }
  ballGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  const ballMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  root.add(ball);
  const shadowGeometry = new THREE.CircleGeometry(0.38, 20);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#233d35",
    opacity: 0.25,
    transparent: true,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  scene.add(root);
  return {
    update(dt = 0) {
      for (const { r, group, legs, name } of actors) {
        const p = r.actor.position;
        group.position.set(p.x, p.y, p.z);
        group.rotation.y = r.actor.yaw;
        const moving = Math.hypot(r.actor.velocity.x, r.actor.velocity.z) > 0.1;
        legs.forEach(
          (leg, i) =>
            (leg.rotation.x = moving
              ? Math.sin(r.phase * 8 + i * Math.PI) * 0.25
              : 0),
        );
        name.position.set(p.x, p.y + (r.kind === "villager" ? 2.3 : 1.6), p.z);
      }
      for (const { p, group, legs, arms, name } of footballers) {
        group.position.set(p.x, 9, p.z);
        group.rotation.y = p.yaw;
        legs.forEach(
          (leg, i) =>
            (leg.rotation.x =
              p.swing > 0 && i === 0
                ? -Math.sin((p.swing / 0.3) * Math.PI) * 0.9
                : p.moving
                  ? Math.sin(p.phase * 11 + i * Math.PI) * 0.45
                  : 0),
        );
        arms.forEach((arm, i) => {
          arm.rotation.x = p.moving
            ? -Math.sin(p.phase * 11 + i * Math.PI) * 0.3
            : 0;
          arm.rotation.z = p.keeper ? (i === 0 ? 0.45 : -0.45) : 0;
        });
        name.position.set(p.x, 11.35, p.z);
      }
      const b = village.football.ball;
      ball.position.set(b.x, b.y, b.z);
      ball.rotation.x += b.vz * dt;
      ball.rotation.z -= b.vx * dt;
      shadow.position.set(b.x, 9.04, b.z);
    },
    dispose() {
      scene.remove(root);
      cube.dispose();
      kitGeometry.dispose();
      for (const m of kitMaterials) m.dispose();
      ringGeometry.dispose();
      ballGeometry.dispose();
      ballMaterial.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      root.traverse((o) => {
        if (o.isSprite) o.material.dispose();
      });
      for (const m of materials.values()) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
