import { World, SEED } from "./world.js?v=0.7.0";
import { Inventory } from "./inventory.js?v=0.7.0";
import { Player } from "./player.js?v=0.7.0";
import { Village } from "./village.js?v=0.7.0";

// Public web-app configuration preserved verbatim from the working prototype.
import { Journey } from "./connected.js?v=0.7.0";

const firebaseConfig = {
  apiKey: "AIzaSyDFe32AgdruOh_sUn8_O5NGAF2NDItP5jU",
  authDomain: "ari-craft.firebaseapp.com",
  projectId: "ari-craft",
  storageBucket: "ari-craft.firebasestorage.app",
  messagingSenderId: "787816491408",
  appId: "1:787816491408:web:7872b943b9540df6992b15",
};
export function decodeState(state) {
  if (
    !state ||
    ![4, 6, 7].includes(state.version) ||
    state.generator !== 1 ||
    !Number.isInteger(state.seed) ||
    typeof state.legacy !== "boolean"
  )
    throw new Error(
      "Esta partida necesita una versión compatible de ARI CRAFT.",
    );
  if (state.version === 7 && state.connected?.version !== 2)
    throw new Error("Ampliación de la partida incompleta");
  const world = new World({ seed: state.seed, legacy: state.legacy });
  world.restore(state.edits);
  const inventory = new Inventory();
  inventory.restore(state.inventory);
  const player = new Player(world);
  player.restore(state.player);
  if (
    state.location !== undefined &&
    !["home", "village"].includes(state.location)
  )
    throw new Error("Zona guardada no válida");
  if (state.location === "village" && !state.village)
    throw new Error("Falta la aldea guardada");
  if (
    state.village !== undefined &&
    (!state.village || typeof state.village !== "object")
  )
    throw new Error("Aldea guardada no válida");
  const village =
    state.village === undefined ? null : new Village(state.village);
  if (state.version >= 6 && (!state.connected || !village))
    throw new Error("Faltan datos del mundo conectado");
  const journey =
    state.version >= 6
      ? new Journey({ world, player }, village, state.location, state.connected)
      : null;
  return {
    journey,
    world,
    inventory,
    player,
    village,
    location: state.location || "home",
  };
}
export function encodeState(
  world,
  inventory,
  player,
  village = null,
  location = "home",
) {
  return {
    ...(village ? { village: village.snapshot(), location } : {}),
    version: 4,
    generator: 1,
    seed: world.seed,
    legacy: world.legacy,
    edits: world.serialize(),
    inventory: inventory.snapshot(),
    player: player.snapshot(),
  };
}
export function encodeJourney(journey, inventory) {
  const connected = journey.snapshot();
  return {
    ...encodeState(
      journey.home.world,
      inventory,
      journey.home.player,
      journey.village,
      journey.region === "village" ? "village" : "home",
    ),
    version: connected.version === 2 ? 7 : 6,
    connected,
  };
}
export function migrateLegacy(data) {
  const legacy = !!data && (Array.isArray(data.blocks) || data.version === 1);
  const world = new World({ seed: SEED, legacy }),
    inventory = new Inventory(),
    player = new Player(world);
  if (legacy) {
    const types = [1, 6, 3, 7, 4, 5];
    // Old cubes were centered at integers; +.5 in X/Z aligns their new cells.
    // The former y=0 ground now occupies y=8, so structures move up 8 cells.
    for (const b of data.blocks || []) {
      if (
        !b ||
        ![b.x, b.y, b.z, b.type].every(Number.isInteger) ||
        b.type < 0 ||
        b.type > 5
      )
        continue;
      if (
        !world.set(b.x, b.y + 8, b.z, types[b.type]) &&
        world.get(b.x, b.y + 8, b.z) !== types[b.type]
      )
        throw new Error(
          "La construcción antigua no cabe en este mundo. Se ha conservado la partida original.",
        );
    }
    if (data.player)
      player.restore({
        x: data.player.x + 0.5,
        y: data.player.y + 8.5 - 1.62,
        z: data.player.z + 0.5,
        yaw: 0,
        pitch: 0,
      });
  }
  return encodeState(world, inventory, player);
}
export class SaveConflict extends Error {
  constructor() {
    super(
      "Hay una partida más reciente en otro dispositivo. Descarga tu copia local antes de cargar la nube.",
    );
    this.code = "save/conflict";
  }
}
// Used by both cloud and local adapters. The first backup and next state are
// written atomically; existing backups and other document fields are retained.
export function prepareCommit(data, entry) {
  const current = data?.sandbox04;
  if (current?.commit === entry.commit) return null;
  if ((current?.revision || 0) !== entry.base) throw new SaveConflict();
  const result = {
    sandbox04: {
      revision: entry.base + 1,
      commit: entry.commit,
      state: entry.state,
    },
  };
  if (!data?.backupBefore05 && current && current.state.version === 4)
    result.backupBefore05 = current;
  if (
    entry.state.version >= 6 &&
    current &&
    current.state.version === 4 &&
    !data?.backupBefore06
  ) {
    result.backupBefore06 = {
      revision: current.revision,
      commit: current.commit,
      json: JSON.stringify(current.state),
    };
  }
  if (
    entry.state.version === 7 &&
    current &&
    current.state.version < 7 &&
    !data?.backupBefore07
  ) {
    result.backupBefore07 = {
      revision: current.revision,
      commit: current.commit,
      json: JSON.stringify(current.state),
    };
  }
  return result;
}
// Storage and remote adapter are injected so failures/concurrent writes are testable.
export class SaveSession {
  constructor(adapter, storage, key) {
    this.adapter = adapter;
    this.storage = storage;
    this.key = key;
    this.revision = 0;
    this.pending = null;
    this.flight = null;
    this.blocked = false;
    this.storageError = false;
  }
  readJournal() {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (
      !Number.isInteger(entry.base) ||
      entry.base < 0 ||
      typeof entry.commit !== "string"
    )
      throw new Error(
        "La copia local no se puede leer. Descárgala antes de continuar.",
      );
    decodeState(entry.state);
    return entry;
  }
  writeJournal() {
    try {
      if (this.pending)
        this.storage.setItem(this.key, JSON.stringify(this.pending));
      else this.storage.removeItem(this.key);
      this.storageError = false;
    } catch {
      this.storageError = true;
    }
  }
  async load() {
    const data = await this.adapter.read();
    const remote = data?.sandbox04;
    if (remote && (!Number.isInteger(remote.revision) || remote.revision < 1))
      throw new Error("Revisión de partida no válida");
    const state = remote ? remote.state : migrateLegacy(data);
    decodeState(state);
    this.backup =
      state.version < 7
        ? remote || { state }
        : data?.backupBefore07
          ? { state: JSON.parse(data.backupBefore07.json) }
          : data?.backupBefore06
            ? { state: JSON.parse(data.backupBefore06.json) }
            : remote || data?.backupBefore05 || { state };
    this.revision = remote?.revision || 0;
    const journal = this.readJournal();
    if (journal) {
      if (
        journal.state.version < 7 &&
        !this.storage.getItem(`${this.key}:before07-journal`)
      )
        this.storage.setItem(
          `${this.key}:before07-journal`,
          JSON.stringify(journal),
        );
      if (
        journal.state.version === 4 &&
        !this.storage.getItem(`${this.key}:before06-journal`)
      )
        this.storage.setItem(
          `${this.key}:before06-journal`,
          JSON.stringify(journal),
        );
      if (
        !journal.state.village &&
        !this.storage.getItem(`${this.key}:before05-journal`)
      ) {
        // Preserve unsynced progress from 0.4 before consuming or replacing it.
        this.storage.setItem(
          `${this.key}:before05-journal`,
          JSON.stringify(journal),
        );
      }
      if (remote?.commit === journal.commit) {
        this.pending = null;
        this.writeJournal();
      } else if (journal.base === this.revision) {
        this.pending = journal;
        return journal.state;
      } else {
        this.blocked = true;
        throw new SaveConflict();
      }
    }
    return state;
  }
  update(state) {
    if (this.blocked) return;
    this.pending = {
      base: this.revision,
      commit: globalThis.crypto.randomUUID(),
      state,
    };
    this.writeJournal();
  }
  async flush() {
    if (this.flight) return this.flight;
    if (!this.pending || this.blocked) return;
    const entry = this.pending;
    this.flight = (async () => {
      try {
        const revision = await this.adapter.commit(entry);
        this.revision = revision;
        if (this.pending === entry) this.pending = null;
        else this.pending.base = revision;
        this.writeJournal();
      } catch (error) {
        if (error.code === "save/conflict") this.blocked = true;
        throw error;
      } finally {
        this.flight = null;
      }
    })();
    return this.flight;
  }
}

let connection;
export async function connectFirebase() {
  if (connection) return connection;
  connection = (async () => {
    const [appSdk, authSdk, fire] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
      import(
        "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
      ),
    ]);
    const app = appSdk.initializeApp(firebaseConfig),
      auth = authSdk.getAuth(app),
      db = fire.getFirestore(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    return {
      watch: (callback) => authSdk.onAuthStateChanged(auth, callback),
      login: () =>
        authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
      logout: () => authSdk.signOut(auth),
      session(uid) {
        const ref = fire.doc(db, "players", uid);
        return new SaveSession(
          {
            async read() {
              const doc = await fire.getDocFromServer(ref);
              return doc.exists() ? doc.data() : null;
            },
            async commit(entry) {
              return fire.runTransaction(db, async (transaction) => {
                const doc = await transaction.get(ref),
                  data = doc.data();
                const patch = prepareCommit(data, entry);
                if (!patch) return data.sandbox04.revision;
                transaction.set(
                  ref,
                  { ...patch, updatedAt: fire.serverTimestamp() },
                  { mergeFields: [...Object.keys(patch), "updatedAt"] },
                );
                return patch.sandbox04.revision;
              });
            },
          },
          localStorage,
          `ari-craft:04:${uid}`,
        );
      },
    };
  })();
  try {
    return await connection;
  } catch (error) {
    connection = null;
    throw error;
  }
}
