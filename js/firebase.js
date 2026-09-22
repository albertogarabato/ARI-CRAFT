import { World, SEED } from "./world.js";
import { Inventory } from "./inventory.js?v=0.4.2";
import { Player } from "./player.js";

// Public web-app configuration preserved verbatim from the working prototype.
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
    state.version !== 4 ||
    state.generator !== 1 ||
    !Number.isInteger(state.seed) ||
    typeof state.legacy !== "boolean"
  )
    throw new Error(
      "Esta partida necesita una versión compatible de ARI CRAFT.",
    );
  const world = new World({ seed: state.seed, legacy: state.legacy });
  world.restore(state.edits);
  const inventory = new Inventory();
  inventory.restore(state.inventory);
  const player = new Player(world);
  player.restore(state.player);
  return { world, inventory, player };
}
export function encodeState(world, inventory, player) {
  return {
    version: 4,
    generator: 1,
    seed: world.seed,
    legacy: world.legacy,
    edits: world.serialize(),
    inventory: inventory.snapshot(),
    player: player.snapshot(),
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
    this.revision = remote?.revision || 0;
    const journal = this.readJournal();
    if (journal) {
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
                  current = doc.data()?.sandbox04;
                if (current?.commit === entry.commit) return current.revision;
                if ((current?.revision || 0) !== entry.base)
                  throw new SaveConflict();
                const revision = entry.base + 1;
                // Replace only the new namespace; legacy fields remain untouched.
                transaction.set(
                  ref,
                  {
                    sandbox04: {
                      revision,
                      commit: entry.commit,
                      state: entry.state,
                    },
                    updatedAt: fire.serverTimestamp(),
                  },
                  { mergeFields: ["sandbox04", "updatedAt"] },
                );
                return revision;
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
