// Original, low-poly tools. Shared geometry and four nearby lights keep mobile cost bounded.
export function createEquipmentView(THREE, scene, camera) {
  const hand = new THREE.Group();
  hand.scale.setScalar(0.7);
  camera.add(hand);
  scene.add(camera);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const wood = new THREE.MeshBasicMaterial({
    color: "#946238",
    depthTest: false,
  });
  const metal = new THREE.MeshBasicMaterial({
    color: "#c2dce4",
    depthTest: false,
  });
  const gold = new THREE.MeshBasicMaterial({
    color: "#e8b74e",
    depthTest: false,
  });
  let current = "",
    phase = 0,
    timer = 0;
  const lights = Array.from({ length: 4 }, () => {
    const light = new THREE.PointLight("#ffb64f", 0, 8, 1.5);
    scene.add(light);
    return light;
  });
  function box(mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.renderOrder = 100;
    hand.add(m);
  }
  return {
    update(dt, world, player, tool, active, swinging) {
      if (tool !== current) {
        hand.clear();
        current = tool;
        if (tool !== "hand") {
          box(wood, 0, 0, 0, 0.045, 0.3, 0.045);
          if (tool === "pickaxe") {
            box(metal, 0, 0.17, 0, 0.29, 0.055, 0.06);
            box(metal, -0.13, 0.12, 0, 0.045, 0.09, 0.06);
          }
          if (tool === "axe") box(metal, 0.07, 0.14, 0, 0.16, 0.16, 0.05);
          if (tool === "shovel") box(metal, 0, 0.2, 0, 0.12, 0.16, 0.035);
          if (tool === "sword") {
            box(gold, 0, 0.12, 0, 0.18, 0.04, 0.05);
            box(metal, 0, 0.3, 0, 0.055, 0.34, 0.025);
          }
        }
      }
      hand.visible = active && tool !== "hand";
      phase = swinging && active ? phase + dt * 13 : 0;
      hand.position.set(0.27, -0.22, -0.55);
      hand.rotation.set(
        -0.2 + Math.sin(phase) * 0.3,
        0,
        -0.35 + Math.sin(phase) * 0.2,
      );
      timer -= dt;
      if (timer <= 0) {
        timer = 0.3;
        const p = player.position,
          candidates = [];
        for (let x = Math.floor(p.x) - 6; x <= Math.floor(p.x) + 6; x++)
          for (let z = Math.floor(p.z) - 6; z <= Math.floor(p.z) + 6; z++)
            for (
              let y = Math.max(1, Math.floor(p.y) - 4);
              y <= Math.floor(p.y) + 4;
              y++
            )
              if (world.get(x, y, z) === 18)
                candidates.push({
                  x: x + 0.5,
                  y: y + 0.7,
                  z: z + 0.5,
                  d:
                    (x + 0.5 - p.x) ** 2 +
                    (y + 0.7 - p.y) ** 2 +
                    (z + 0.5 - p.z) ** 2,
                });
        candidates.sort((a, b) => a.d - b.d);
        lights.forEach((light, i) => {
          const p = candidates[i];
          light.intensity = p ? 4 : 0;
          if (p) light.position.set(p.x, p.y, p.z);
        });
      }
    },
  };
}
