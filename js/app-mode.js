// Installation is independent of the game, authentication and saved worlds.
const $ = (id) => document.getElementById(id);
const standalone = matchMedia("(display-mode: standalone)");
const immersive = matchMedia("(display-mode: fullscreen)");
const installed = () =>
  standalone.matches || immersive.matches || navigator.standalone === true;
const ios =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const android = /Android/.test(navigator.userAgent);
let installPrompt = null;
let returnFocus = null;

function refresh() {
  $("installCard").hidden = installed();
  const full = !!document.fullscreenElement || immersive.matches;
  $("fullscreenButton").textContent = full
    ? "⛶ Pantalla completa activa"
    : "⛶ Pantalla completa";
  $("fullscreenButton").disabled = full;
  $("expandButton").hidden = full || installed();
}
function showInstallHelp() {
  returnFocus = document.activeElement;
  $("installHelp").showModal();
}
$("closeInstallHelp").onclick = () => $("installHelp").close();
$("installHelp").addEventListener("close", () => returnFocus?.focus());
$("installHelp").addEventListener("click", (event) => {
  if (event.target !== $("installHelp")) return;
  const box = event.target.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    event.target.close();
});
$("installAndroid").open = android;
$("installIphone").open = ios;
$("installDesktop").open = !ios && !android;

addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("installButton").textContent = "Añadir ARI CRAFT a mi pantalla";
});
addEventListener("appinstalled", () => {
  installPrompt = null;
  $("installButton").textContent = "Cómo abrir desde el icono";
  $("installMessage").textContent =
    "Ya está añadido. Abre ARI CRAFT desde su icono en la pantalla de inicio.";
});
$("installButton").onclick = async () => {
  if (!installPrompt) return showInstallHelp();
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted")
      $("installMessage").textContent =
        "Abre ARI CRAFT desde su nuevo icono para jugar sin barra de direcciones.";
  } catch {
    showInstallHelp();
  }
};

export async function enterFullscreen({ automatic = false } = {}) {
  if (document.fullscreenElement || immersive.matches || installed()) return;
  if (!document.documentElement.requestFullscreen) {
    // Do not interrupt Play with instructions on every unsupported iPhone.
    if (!automatic) showInstallHelp();
    return;
  }
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    if (!automatic) showInstallHelp();
  }
  refresh();
}
$("fullscreenButton").onclick = () => void enterFullscreen();
// Pause first: a help dialog must never leave movement running behind it.
$("expandButton").onclick = () => {
  $("pauseButton").click();
  void enterFullscreen();
};
document.addEventListener("fullscreenchange", refresh);
standalone.addEventListener("change", refresh);
immersive.addEventListener("change", refresh);
refresh();
