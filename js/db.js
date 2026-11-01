// Small IndexedDB wrapper. One database per name; the app uses 'negative-archive',
// tests use their own names. Fires a 'db-change' event after each write transaction.

export const DB_NAME = 'negative-archive';
const VERSION = 1;

export const STORES = ['rolls', 'negatives', 'shots', 'cameras', 'lenses', 'filmStocks', 'lightingItems', 'blobs', 'meta'];

function upgrade(idb) {
  const rolls = idb.createObjectStore('rolls', { keyPath: 'id' });
  rolls.createIndex('status', 'status');

  const negatives = idb.createObjectStore('negatives', { keyPath: 'id' });
  negatives.createIndex('rollId', 'rollId');
  negatives.createIndex('rollFrame', ['rollId', 'frame']);
  ['dateTaken', 'filmStock', 'cameraId', 'lensId', 'category', 'action', 'social', 'print', 'posted', 'status']
    .forEach((field) => negatives.createIndex(field, field));

  const shots = idb.createObjectStore('shots', { keyPath: 'id' });
  shots.createIndex('rollId', 'rollId');
  shots.createIndex('rollShot', ['rollId', 'shotNumber']);

  idb.createObjectStore('cameras', { keyPath: 'id' });
  idb.createObjectStore('lenses', { keyPath: 'id' });
  idb.createObjectStore('filmStocks', { keyPath: 'name' });
  idb.createObjectStore('lightingItems', { keyPath: 'id' });
  idb.createObjectStore('blobs', { keyPath: 'id' });
  idb.createObjectStore('meta', { keyPath: 'key' });
}

/** Wraps an IDBRequest in a promise. */
function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store helpers bound to one transaction. Only await these inside a transaction():
// awaiting anything else lets the transaction auto-commit.
function bind(tx) {
  const store = (name) => tx.objectStore(name);
  return {
    get: (name, key) => done(store(name).get(key)),
    getAll: (name, query) => done(store(name).getAll(query)),
    getAllKeys: (name, query) => done(store(name).getAllKeys(query)),
    byIndex: (name, index, query) => done(store(name).index(index).getAll(query)),
    count: (name, query) => done(store(name).count(query)),
    put: (name, value) => done(store(name).put(value)),
    add: (name, value) => done(store(name).add(value)), // rejects with ConstraintError on a duplicate key
    remove: (name, key) => done(store(name).delete(key)),
    clear: (name) => done(store(name).clear()),
  };
}

const changes = new EventTarget();

/** Calls fn({ name, stores }) after every committed write. Returns an unsubscribe function. */
export function onChange(fn) {
  const listener = (event) => fn(event.detail);
  changes.addEventListener('db-change', listener);
  return () => changes.removeEventListener('db-change', listener);
}

export async function openDb(name = DB_NAME) {
  const idb = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, VERSION);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Database ${name} is open in another tab.`));
  });

  /**
   * Runs fn(t) in one transaction; resolves with fn's result once it commits.
   * If fn throws, the transaction is aborted and nothing is written.
   */
  const transaction = (stores, mode, fn) => new Promise((resolve, reject) => {
    const tx = idb.transaction(stores, mode);
    let result;
    let failure;
    tx.oncomplete = () => {
      if (mode === 'readwrite') {
        changes.dispatchEvent(new CustomEvent('db-change', { detail: { name, stores } }));
      }
      resolve(result);
    };
    tx.onabort = () => reject(failure || tx.error || new Error('Transaction aborted'));
    Promise.resolve()
      .then(() => fn(bind(tx)))
      .then((value) => { result = value; })
      .catch((error) => {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      });
  });

  const read = (store, fn) => transaction([store], 'readonly', fn);
  const write = (store, fn) => transaction([store], 'readwrite', fn);

  return {
    name,
    transaction,
    get: (store, key) => read(store, (t) => t.get(store, key)),
    getAll: (store, query) => read(store, (t) => t.getAll(store, query)),
    byIndex: (store, index, query) => read(store, (t) => t.byIndex(store, index, query)),
    count: (store, query) => read(store, (t) => t.count(store, query)),
    put: (store, value) => write(store, (t) => t.put(store, value)),
    add: (store, value) => write(store, (t) => t.add(store, value)),
    remove: (store, key) => write(store, (t) => t.remove(store, key)),
    close: () => idb.close(),
  };
}

let appDb;

/** The app's database, opened once. */
export function getDb() {
  appDb = appDb || openDb(DB_NAME);
  return appDb;
}

/** Deletes a database by name (used by tests). */
export function deleteDb(name) {
  return done(indexedDB.deleteDatabase(name));
}
