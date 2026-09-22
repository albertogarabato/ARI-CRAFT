import * as THREE from "three";
import { bindTouchControls } from "./touch.js";
import { World, BLOCKS, createWorldView } from "./world.js";
import { Player } from "./player.js";
import { Inventory, mineBlock, placeBlock } from "./inventory.js";
import {
  connectFirebase,
  SaveSession,
  SaveConflict,
  encodeState,
  decodeState,
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#b5d8dc");
scene.fog = new THREE.Fog("#b5d8dc", 38, 95);
const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.05,
  150,
);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("game").append(renderer.domElement);
scene.add(new THREE.HemisphereLight("#fff4d9", "#657b73", 2));
const sun = new THREE.DirectionalLight("#fff0cd", 2.1);
sun.position.set(-30, 55, 25);
scene.add(sun);
let world = new World(),
  inventory = new Inventory(),
  player = new Player(world),
  view = createWorldView(THREE, world, scene);
view.update();
camera.position.set(23, 25, 30);
camera.lookAt(-3, 9, -6);
const cloudMaterial = new THREE.MeshLambertMaterial({ color: "#fff8e9" });
const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 9; i++) {
  const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloud.position.set(
    -42 + (i % 3) * 34,
    30 + ((i * 7) % 9),
    -40 + Math.floor(i / 3) * 34,
  );
  cloud.scale.set(12 + (i % 3) * 3, 1.2, 4);
  scene.add(cloud);
}
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
  new THREE.LineBasicMaterial({ color: "#fcf5d0" }),
);
outline.visible = false;
scene.add(outline);
let dragCamera = false,
  rightDrag = null;
let ready = false,
  playing = false,
  mode = null,
  session = null,
  backend = null,
  user = null,
  loadToken = 0;
let mining = false,
  mineKey = "",
  mineTime = 0,
  dirty = false,
  saveTimer = null,
  toastTimer = null,
  accumulator = 0;
const keys = new Set(),
  direction = new THREE.Vector3();
const nativeTouch = matchMedia("(pointer: coarse)").matches;
let touchMode = nativeTouch;
let portraitAllowed = false,
  rotatePending = false;
const touchInput = bindTouchControls({
  elements: {
    move: $("movePad"),
    stick: $("moveStick"),
    look: $("lookZone"),
    jump: $("touchJump"),
    mine: $("touchMine"),
    place: $("touchPlace"),
  },
  active: () => playing && touchMode,
  look: (x, y) => player.look(x * 1.5, y * 1.5),
  place: placeSelected,
  mine: (held) => {
    if (touchMode) mining = held;
  },
});
function updateTouchMode() {
  document.body.classList.toggle("touch", touchMode);
  $("touchNotice").hidden = !touchMode;
  $("touchModeButton").textContent = touchMode
    ? "Usar teclado y ratón"
    : "Activar controles táctiles";
  $("fullscreenHelp").hidden =
    !!document.documentElement.requestFullscreen ||
    matchMedia("(display-mode: standalone)").matches;
  $("help").hidden = touchMode;
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchMode ? 1.4 : 1.75));
}
updateTouchMode();
function startTouch() {
  if (!ready || document.hidden) return;
  clearInput();
  playing = true;
  dragCamera = false;
  $("menu").hidden = true;
  $("touchControls").hidden = false;
  $("rotatePrompt").hidden = true;
  rotatePending = false;
  document.body.classList.remove("paused");
}
function needsRotation() {
  return touchMode && !portraitAllowed && innerHeight > innerWidth;
}
async function fullscreen() {
  const root = document.documentElement;
  if (document.fullscreenElement) return;
  if (root.requestFullscreen) {
    try {
      await root.requestFullscreen({ navigationUI: "hide" });
    } catch {
      toast(
        "Puedes seguir jugando. Usa el menú del navegador para ampliar la pantalla.",
      );
    }
  } else {
    $("fullscreenHelp").hidden = false;
    toast("En iPhone: Compartir → Añadir a pantalla de inicio.");
  }
}
$("fullscreenButton").onclick = fullscreen;
$("touchModeButton").onclick = () => {
  touchMode = !touchMode;
  clearInput();
  updateTouchMode();
};
$("portraitButton").onclick = () => {
  portraitAllowed = true;
  if (nativeTouch) void fullscreen();
  startTouch();
};
$("rotateBack").onclick = () => {
  rotatePending = false;
  $("rotatePrompt").hidden = true;
  pause();
};
function status(message) {
  $("saveStatus").textContent = message;
  $("menuSaveStatus").textContent = message;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3200);
}
function snapshot() {
  return encodeState(world, inventory, player);
}
function renderInventory() {
  inventory.render($("hotbar"), (index) => {
    inventory.select(index);
    renderInventory();
    changed();
  });
  $("bagList").replaceChildren();
  BLOCKS.slice(1, 8).forEach((block, index) => {
    const row = document.createElement("span");
    row.textContent = `${block.name} · ${inventory.counts[index + 1]}`;
    $("bagList").append(row);
  });
  const type = inventory.type;
  $("selectedLabel").textContent = type
    ? `${BLOCKS[type].name} · ${inventory.counts[type]}`
    : "Espacio vacío";
}
function clearInput() {
  touchInput.reset();
  rightDrag = null;
  keys.clear();
  mining = false;
  mineKey = "";
  mineTime = 0;
  accumulator = 0;
  $("breakProgress").hidden = true;
}
function checkpoint() {
  if (!ready || !session || !dirty || session.blocked) return;
  session.update(snapshot());
  dirty = false;
  status(
    session.storageError
      ? "Copia local no disponible · guarda antes de salir"
      : "Cambios pendientes de guardar",
  );
}
function changed() {
  dirty = true;
  checkpoint();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1000);
}
async function save() {
  if (!ready || !session) return;
  checkpoint();
  const active = session;
  if (!active.pending || active.blocked) return;
  status(
    mode === "local" ? "Guardando en este navegador…" : "Guardando en la nube…",
  );
  try {
    await active.flush();
    if (active !== session) return;
    status(
      active.pending
        ? "Cambios pendientes"
        : mode === "local"
          ? "Guardado en este navegador"
          : "Guardado en la nube",
    );
  } catch (error) {
    if (active !== session) return;
    console.error(error);
    status(
      error.code === "save/conflict"
        ? "Partida abierta en otro dispositivo"
        : active.storageError
          ? "Sin guardar · descarga tu copia"
          : mode === "local"
            ? "No se pudo guardar en este navegador"
            : "Sin guardar en la nube · copia local",
    );
    if (error.code === "save/conflict") {
      pause();
      ready = false;
      $("playButton").hidden = true;
      $("reloadButton").hidden = false;
    }
    $("menuStatus").textContent =
      error.code === "save/conflict"
        ? error.message
        : active.storageError || mode === "local"
          ? "El navegador no ha podido guardar. Descarga una copia antes de salir y libera espacio para reintentar."
          : "No se pudo guardar. Tu copia local se reintentará al recuperar la conexión. Usa «Guardar ahora» antes de cambiar de dispositivo.";
    $("exportButton").hidden = false;
  }
}
function pause() {
  playing = false;
  $("touchControls").hidden = true;
  clearInput();
  outline.visible = false;
  $("targetLabel").textContent = "";
  if (document.pointerLockElement) document.exitPointerLock();
  $("menu").hidden = false;
  document.body.classList.add("paused");
  $("menuTitle").setAttribute("aria-label", "ARI CRAFT · Juego en pausa");
  if (ready) {
    $("playButton").textContent = "Continuar mi mundo →";
    $("playButton").focus();
  }
  checkpoint();
  void save();
}
async function play() {
  if (!ready) return;
  if (touchMode) {
    if (nativeTouch) void fullscreen();
    if (needsRotation()) {
      rotatePending = true;
      $("rotatePrompt").hidden = false;
      $("portraitButton").focus();
      return;
    }
    startTouch();
    return;
  }
  try {
    dragCamera = false;
    await renderer.domElement.requestPointerLock();
  } catch {
    $("fallbackButton").hidden = false;
    toast(
      "Puedes jugar con cámara al arrastrar si el navegador no permite capturar el ratón.",
    );
  }
}
function install(state) {
  const next = decodeState(state);
  view.dispose();
  ({ world, inventory, player } = next);
  view = createWorldView(THREE, world, scene);
  view.update();
  player.syncCamera(camera);
  renderInventory();
  ready = true;
  dirty = false;
  document.body.classList.add("paused");
  $("bag").hidden = false;
  $("logoutButton").textContent =
    mode === "local" ? "Volver al inicio" : "Cambiar de cuenta";
  $("hud").hidden = false;
  $("playButton").hidden = false;
  $("loginButton").hidden = true;
  $("demoButton").hidden = true;
  $("saveButton").hidden = false;
  $("logoutButton").hidden = false;
  $("greeting").hidden = false;
  $("exportButton").hidden = false;
  $("reloadButton").hidden = true;
  $("greeting").textContent =
    mode === "local"
      ? "Tu rincón para experimentar."
      : `Hola, ${user?.displayName?.split(" ")[0] || "Ari"}. Tu mundo te espera.`;
  $("menuStatus").textContent =
    mode === "local"
      ? "Partida local · Se conserva en este navegador. No se sincroniza con Google."
      : "Tu mundo se guarda automáticamente. Espera a «Guardado en la nube» antes de continuar en otro dispositivo.";
  status(mode === "local" ? "Partida local" : "Mundo cargado");
  // Persist migration/new state only after a successful remote read and validation.
  if (!session.revision || session.pending) changed();
}
async function loadSession(nextSession, nextMode) {
  const token = ++loadToken;
  ready = false;
  pause();
  session = nextSession;
  mode = nextMode;
  $("playButton").hidden = true;
  $("demoButton").hidden = true;
  $("menuStatus").textContent = "Preparando tu mundo…";
  try {
    const state = await session.load();
    if (token !== loadToken) return;
    install(state);
  } catch (error) {
    if (token !== loadToken) return;
    console.error(error);
    $("menuStatus").textContent =
      `No se ha abierto la partida: ${error.message} Tu mundo no se ha sobrescrito.`;
    $("reloadButton").hidden = false;
    $("exportButton").hidden = false;
    $("logoutButton").hidden = false;
    status("Partida sin cargar");
  }
}
function localSession() {
  return new SaveSession(
    {
      async read() {
        const raw = localStorage.getItem("ari-craft:04:demo-world");
        return raw ? JSON.parse(raw) : null;
      },
      async commit(entry) {
        const raw = localStorage.getItem("ari-craft:04:demo-world"),
          old = raw ? JSON.parse(raw).sandbox04 : null;
        if (old?.commit === entry.commit) return old.revision;
        if ((old?.revision || 0) !== entry.base) throw new SaveConflict();
        const revision = entry.base + 1;
        localStorage.setItem(
          "ari-craft:04:demo-world",
          JSON.stringify({
            sandbox04: { revision, commit: entry.commit, state: entry.state },
          }),
        );
        return revision;
      },
    },
    localStorage,
    "ari-craft:04:demo-journal",
  );
}
async function initializeAuth() {
  $("loginButton").disabled = true;
  $("loginButton").textContent = "Preparando Google…";
  try {
    backend = await connectFirebase();
    $("loginButton").textContent = "Entrar con Google ↗";
    backend.watch((nextUser) => {
      user = nextUser;
      if (mode === "local") return;
      if (user) void loadSession(backend.session(user.uid), "cloud");
      else if (mode === "cloud") {
        ready = false;
        pause();
        location.reload();
      }
    });
  } catch (error) {
    console.error(error);
    $("loginButton").textContent = "Reintentar conexión con Google";
    if (!mode)
      $("menuStatus").textContent =
        `No se pudo preparar Google (${error.code || error.message}). Comprueba la conexión y pulsa Reintentar.`;
  } finally {
    $("loginButton").disabled = false;
  }
}
$("loginButton").onclick = async () => {
  // Finish SDK setup first. Opening the popup must remain in the next click's
  // user activation, rather than following an asynchronous network request.
  if (!backend) {
    await initializeAuth();
    if (backend)
      $("menuStatus").textContent =
        "Google está listo. Pulsa Entrar con Google.";
    return;
  }
  $("loginButton").disabled = true;
  try {
    await backend.login();
  } catch (error) {
    const messages = {
      "auth/unauthorized-domain": `Firebase no tiene autorizado este dominio (${location.hostname}). Abre la versión de prueba en albertogarabato.github.io/ARI-CRAFT/prueba/.`,
      "auth/popup-blocked":
        "El navegador ha bloqueado la ventana de Google. Abre este enlace directamente en Chrome o Safari y permite las ventanas emergentes para este sitio.",
      "auth/popup-closed-by-user":
        "La ventana de Google se ha cerrado antes de terminar. Pulsa Entrar con Google para reintentar.",
      "auth/network-request-failed":
        "No se pudo conectar con Google. Comprueba la conexión y vuelve a intentarlo.",
    };
    $("menuStatus").textContent =
      messages[error.code] ||
      `No se pudo entrar con Google (${error.code || error.message}). Copia este mensaje para revisar el problema.`;
  } finally {
    $("loginButton").disabled = false;
  }
};
$("demoButton").onclick = () => void loadSession(localSession(), "local");
$("fallbackButton").onclick = () => {
  if (!ready) return;
  dragCamera = true;
  playing = true;
  clearInput();
  $("menu").hidden = true;
  document.body.classList.remove("paused");
  toast(
    "Arrastra con el botón derecho para mirar. Clic derecho sin arrastrar para construir.",
  );
};
$("playButton").onclick = play;
$("pauseButton").onclick = pause;
$("saveButton").onclick = () => {
  dirty = true;
  void save();
};
$("logoutButton").onclick = async () => {
  await save();
  if (session?.pending || dirty) {
    toast(
      "Quedan cambios por guardar. Reintenta o descarga tu copia antes de cambiar de cuenta.",
    );
    return;
  }
  if (mode === "cloud") await backend.logout();
  else location.reload();
};
function downloadCopy(raw) {
  const blob = new Blob([raw], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `ari-craft-04-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("exportButton").onclick = () => {
  const raw = session && localStorage.getItem(session.key);
  if (raw) downloadCopy(raw);
  else if (ready) downloadCopy(JSON.stringify({ state: snapshot() }));
  else toast("No hay una copia local disponible.");
};
$("reloadButton").onclick = async () => {
  if (!session) return;
  // Retain the journal under a separate key before explicitly loading the cloud.
  try {
    const raw = localStorage.getItem(session.key);
    if (raw) {
      localStorage.setItem(`${session.key}:backup:${Date.now()}`, raw);
      downloadCopy(raw);
      localStorage.removeItem(session.key);
    }
    await loadSession(
      mode === "local" ? localSession() : backend.session(user.uid),
      mode,
    );
  } catch (error) {
    $("menuStatus").textContent =
      `No se pudo conservar la copia: ${error.message}`;
  }
};
document.addEventListener("pointerlockchange", () => {
  if (touchMode) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked && ready) {
    playing = true;
    clearInput();
    $("menu").hidden = true;
    document.body.classList.remove("paused");
  } else pause();
});
document.addEventListener("pointerlockerror", () => {
  if (touchMode) return;
  pause();
  $("fallbackButton").hidden = false;
  toast("Este navegador necesita la cámara al arrastrar.");
});
document.addEventListener("mousemove", (e) => {
  if (playing && !dragCamera && !touchMode)
    player.look(e.movementX, e.movementY);
});
document.addEventListener("keydown", (e) => {
  if (!playing) return;
  if (
    [
      "Space",
      "Tab",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyE",
      "ShiftLeft",
      "ShiftRight",
    ].includes(e.code) ||
    /^Digit[1-9]$/.test(e.code)
  )
    e.preventDefault();
  if (e.code === "KeyE" || e.code === "Escape") {
    pause();
    return;
  }
  keys.add(e.code);
  if (/^Digit[1-9]$/.test(e.code)) {
    inventory.select(Number(e.code.slice(-1)) - 1);
    renderInventory();
    changed();
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!playing) return;
    e.preventDefault();
    inventory.select((inventory.selected + (e.deltaY > 0 ? 1 : 8)) % 9);
    renderInventory();
    changed();
  },
  { passive: false },
);
function target() {
  player.syncCamera(camera);
  camera.getWorldDirection(direction);
  return world.raycast(camera.position, direction);
}
function placeSelected() {
  if (placeBlock(world, inventory, player, target())) {
    renderInventory();
    changed();
    $("mission").textContent = "¡Tu primera construcción! Sigue imaginando.";
  } else
    toast(
      !inventory.type || !inventory.counts[inventory.type]
        ? "Primero recoge bloques de este material."
        : "No puedes construir aquí: deja espacio para moverte.",
    );
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!playing || touchMode) return;
  if (e.button === 0) mining = true;
  if (e.button === 2) {
    if (dragCamera) {
      rightDrag = { x: e.clientX, y: e.clientY, distance: 0 };
      renderer.domElement.setPointerCapture(e.pointerId);
    } else placeSelected();
  }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!playing || !dragCamera || !rightDrag) return;
  const dx = e.clientX - rightDrag.x,
    dy = e.clientY - rightDrag.y;
  rightDrag.distance += Math.hypot(dx, dy);
  rightDrag.x = e.clientX;
  rightDrag.y = e.clientY;
  player.look(dx, dy);
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (e.button === 2 && rightDrag) {
    if (playing && rightDrag.distance < 4) placeSelected();
    rightDrag = null;
  }
});
renderer.domElement.addEventListener("pointercancel", clearInput);
document.addEventListener("mouseup", (e) => {
  if (e.button === 0 && !touchMode) {
    mining = false;
    mineKey = "";
    mineTime = 0;
  }
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("blur", () => {
  if (playing) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause();
    checkpoint();
    void save();
  }
});
addEventListener("pagehide", checkpoint);
addEventListener("beforeunload", (e) => {
  checkpoint();
  if (session?.pending && mode === "cloud") {
    e.preventDefault();
    e.returnValue = "";
  }
});
addEventListener("online", () => void save());
setInterval(() => {
  checkpoint();
  void save();
}, 5000);
function updateMining(dt) {
  const hit = target();
  outline.visible = !!hit;
  if (hit) outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  $("targetLabel").textContent = hit ? BLOCKS[hit.type].name : "";
  if (!mining || !hit || hit.type === 8) {
    mineKey = "";
    mineTime = 0;
    $("breakProgress").hidden = true;
    return;
  }
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (key !== mineKey) {
    mineKey = key;
    mineTime = 0;
  }
  mineTime += dt;
  $("breakProgress").hidden = false;
  $("breakProgress").value = mineTime / BLOCKS[hit.type].time;
  if (mineTime >= BLOCKS[hit.type].time) {
    if (mineBlock(world, inventory, hit)) {
      renderInventory();
      changed();
      $("mission").textContent = touchMode
        ? "Toca tu bloque en la barra y pulsa Colocar."
        : "Selecciona tu bloque y usa el botón derecho para construir.";
    } else {
      toast(
        "No se pudo recoger: inventario o límite de cambios del mundo alcanzado.",
      );
      mining = false;
    }
    mineTime = 0;
    mineKey = "";
  }
}
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing) {
    accumulator += dt;
    const input = {
      forward: touchMode
        ? touchInput.state.forward
        : Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
      right: touchMode
        ? touchInput.state.right
        : Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      sprint: touchMode
        ? touchInput.state.sprint
        : keys.has("ShiftLeft") || keys.has("ShiftRight"),
      jump: touchMode ? touchInput.state.jump : keys.has("Space"),
    };
    const before = player.snapshot();
    while (accumulator >= 1 / 120) {
      player.update(1 / 120, input);
      accumulator -= 1 / 120;
    }
    if (
      before.x !== player.position.x ||
      before.y !== player.position.y ||
      before.z !== player.position.z
    )
      dirty = true;
    // Include camera orientation even when the player is standing still.
    if (player.yaw !== lastYaw || player.pitch !== lastPitch) {
      dirty = true;
      lastYaw = player.yaw;
      lastPitch = player.pitch;
    }
    player.syncCamera(camera);
    updateMining(dt);
  }
  view.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
let lastYaw = 0,
  lastPitch = 0;
renderInventory();
requestAnimationFrame(frame);
void initializeAuth();
function resizeGame() {
  const width = document.documentElement.clientWidth,
    height = Math.round(window.visualViewport?.height || innerHeight);
  document.documentElement.style.setProperty("--screen-height", `${height}px`);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (!touchMode) return;
  if (playing && needsRotation()) {
    pause();
    rotatePending = true;
    $("rotatePrompt").hidden = false;
  } else if (rotatePending && innerWidth > innerHeight) {
    startTouch();
  }
}
addEventListener("resize", resizeGame);
window.visualViewport?.addEventListener("resize", resizeGame);
addEventListener("orientationchange", () => {
  clearInput();
  setTimeout(resizeGame, 200);
});
resizeGame();
