import * as THREE from "three";
import { bindTouchControls } from "./touch.js";
import { World, BLOCKS, createWorldView } from "./world.js";
import { Player } from "./player.js?v=0.6.0";
import { Inventory, mineBlock, placeBlock } from "./inventory.js?v=0.6.0";
import {
  connectFirebase,
  SaveSession,
  SaveConflict,
  encodeState,
  encodeJourney,
  decodeState,
  prepareCommit,
} from "./firebase.js?v=0.6.0";

import {
  Journey,
  VILLAGE_X,
  createConnectedView,
} from "./connected.js?v=0.6.0";
import { createVillageView } from "./village-view.js?v=0.6.0";
let journey = null,
  navigationTarget = "village",
  navigationTime = 0;
let home = null,
  village = null,
  villageView = null,
  region = "home";
const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#b5d8dc");
scene.fog = new THREE.Fog("#b5d8dc", 100, 230);
const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.05,
  280,
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
  return journey
    ? encodeJourney(journey, inventory)
    : encodeState(world, inventory, player);
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
    row.textContent = `${block.name} · ${inventory.creative ? "∞" : inventory.counts[index + 1]}`;
    $("bagList").append(row);
  });
  const type = inventory.type;
  $("selectedLabel").textContent = type
    ? `${BLOCKS[type].name} · ${inventory.creative ? "∞ · ilimitados" : inventory.counts[type]}`
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
    $("playButton").textContent =
      region === "village" ? "Continuar en la aldea →" : "Continuar mi mundo →";
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
  villageView?.dispose();
  villageView = null;
  inventory = next.inventory;
  journey =
    next.journey ||
    new Journey(
      { world: next.world, player: next.player },
      next.village,
      next.location,
    );
  world = journey.world;
  player = journey.player;
  home = journey.home;
  village = journey.village;
  region = journey.region;
  view = createConnectedView(THREE, journey, scene);
  view.update();
  villageView = createVillageView(THREE, village, view.villageScene);
  villageView.update();
  updateTravelUI();
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
  $("backupButton").hidden = false;
  $("travelButton").hidden = false;
  $("footballButton").hidden = false;
  $("homeButton").hidden = false;
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
  if (!session.revision || session.pending || state.version !== 6) changed();
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
        const raw = localStorage.getItem("ari-craft:04:demo-world");
        const data = raw ? JSON.parse(raw) : null;
        const patch = prepareCommit(data, entry);
        if (!patch) return data.sandbox04.revision;
        localStorage.setItem(
          "ari-craft:04:demo-world",
          JSON.stringify({ ...data, ...patch }),
        );
        return patch.sandbox04.revision;
      },
    },
    localStorage,
    "ari-craft:04:demo-journal",
  );
}
function updateTravelUI() {
  const visiting = region === "village";
  $("playButton").textContent = "Continuar explorando →";
  $("travelButton").textContent = "Mirar hacia la aldea →";
  $("footballButton").textContent = "Mirar hacia el campo ⚽";
  $("villageHud").hidden = !visiting;
  $("resetBallButton").hidden = !visiting;
  $("regionLabel").textContent = visiting
    ? "ALDEA GIRASOL"
    : region === "path"
      ? "CAMINO DE GIRASOL"
      : "EL MUNDO DE ARI";
  if (visiting) updateScore();
  updateNavigation();
}
function updateNavigation() {
  if (!journey) return;
  const target =
    navigationTarget === "home"
      ? { x: 0.5, z: 3.5, name: "Mi mundo" }
      : navigationTarget === "field"
        ? { x: VILLAGE_X + 15, z: 6, name: "Campo de Ari" }
        : { x: VILLAGE_X - 12, z: -6, name: "Aldea Girasol" };
  const dx = target.x - player.position.x,
    dz = target.z - player.position.z;
  const bearing = Math.atan2(-dx, -dz);
  const relative = Math.atan2(
    Math.sin(bearing - player.yaw),
    Math.cos(bearing - player.yaw),
  );
  const arrow =
    Math.abs(relative) < Math.PI / 4
      ? "↑"
      : Math.abs(relative) > (Math.PI * 3) / 4
        ? "↓"
        : relative > 0
          ? "←"
          : "→";
  const distance = Math.round(Math.hypot(dx, dz));
  const hint =
    distance < 5
      ? `Has llegado a ${target.name}`
      : `${arrow} ${target.name} · ${distance} bloques`;
  $("mission").textContent = hint + " · Puedes llegar andando.";
  $("touchTip").textContent = hint;
}
function faceDestination(destination) {
  if (!ready) return;
  navigationTarget = destination;
  const x =
      destination === "home"
        ? 0.5
        : VILLAGE_X + (destination === "field" ? 15 : -12),
    z = destination === "home" ? 3.5 : destination === "field" ? 6 : -6;
  player.yaw = Math.atan2(player.position.x - x, player.position.z - z);
  player.pitch = -0.12;
  player.syncCamera(camera);
  updateNavigation();
  changed();
  $("menuStatus").textContent =
    "Ya estás mirando hacia tu destino. Pulsa Continuar y camina siguiendo la indicación. El camino conecta las dos zonas.";
}
$("travelButton").onclick = () => faceDestination("village");
$("footballButton").onclick = () => faceDestination("field");
$("homeButton").onclick = () => faceDestination("home");
function updateScore() {
  $("score").textContent =
    `Azul ${village.football.score[0]} · ${village.football.score[1]} Coral`;
}
function villageAction() {
  if (!playing || region !== "village") return;
  journey.syncAnchors();
  if (village.football.kick(village.player)) {
    changed();
    toast("¡Chut!");
    return;
  }
  const message = village.interact();
  toast(
    message ||
      "Acércate al balón y mira hacia la portería. Usa Chutar o F. También puedes saludar a los vecinos.",
  );
}
$("actionButton").onclick = villageAction;
$("resetBallButton").onclick = () => {
  if (ready && village) {
    village.football.reset();
    village.football.cooldown = 0;
    villageView?.update();
    changed();
    toast("Balón al centro. El marcador se conserva.");
  }
};
$("backupButton").onclick = () => {
  if (session?.backup)
    downloadCopy(
      JSON.stringify({
        backupBefore06: session.backup,
        state: session.backup.state,
      }),
    );
};
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
  a.download = `ari-craft-06-${new Date().toISOString().slice(0, 10)}.json`;
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
  if (e.code === "KeyF" && !e.repeat) {
    e.preventDefault();
    villageAction();
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
  const hit = target();
  if (!hit) {
    toast(
      "Apunta con la cruz al suelo o a un bloque cercano, a menos de 6 bloques.",
    );
    return;
  }
  if (
    world.protected(
      hit.x + hit.normal[0],
      hit.y + hit.normal[1],
      hit.z + hit.normal[2],
    )
  ) {
    toast("El campo está reservado para jugar. Puedes construir fuera de él.");
    return;
  }
  if (placeBlock(world, inventory, player, hit)) {
    renderInventory();
    changed();
    $("mission").textContent = "¡Tu primera construcción! Sigue imaginando.";
  } else
    toast(
      !inventory.type
        ? "Elige un material de la barra de arriba."
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
  const nearBall =
    region === "village" &&
    Math.hypot(
      player.position.x - VILLAGE_X - village.football.ball.x,
      player.position.z - village.football.ball.z,
    ) < 2.7;
  $("targetLabel").textContent = nearBall
    ? touchMode
      ? "Balón · toca Chutar"
      : "Balón · pulsa F"
    : hit
      ? BLOCKS[hit.type].name
      : "";
  if (
    !mining ||
    !hit ||
    hit.type === 8 ||
    world.protected(hit.x, hit.y, hit.z)
  ) {
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
  $("breakProgress").value =
    mineTime / (inventory.creative ? 0.2 : BLOCKS[hit.type].time);
  if (mineTime >= (inventory.creative ? 0.2 : BLOCKS[hit.type].time)) {
    if (mineBlock(world, inventory, hit)) {
      renderInventory();
      changed();
      $("mission").textContent = touchMode
        ? "Toca tu bloque en la barra y pulsa Colocar."
        : "Selecciona tu bloque y usa el botón derecho para construir.";
    } else {
      toast("No se pudo romper: límite de cambios del mundo alcanzado.");
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
      journey.syncAnchors();
      {
        const goal = village.update(1 / 120);
        if (goal !== null) {
          updateScore();
          toast(
            `¡GOL en la portería ${goal === 0 ? "azul" : "coral"}! Balón al centro.`,
          );
          dirty = true;
        }
      }
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
    villageView.update(dt);
    dirty = true;
    if (region !== journey.region) {
      region = journey.region;
      updateTravelUI();
    }
    navigationTime += dt;
    if (navigationTime > 0.2) {
      updateNavigation();
      navigationTime = 0;
    }
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
