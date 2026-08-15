export type MatchRecordingMeta = {
  id: string;
  date: string;
  mapSlug: string;
  mapName: string;
  mode: string;
  brawler: string;
  brawlerSlug?: string;
  result: "Victoria" | "Derrota";
  duration: number;
  mimeType: string;
  size: number;
  source: "screen" | "import";
};

export type StoredMatchRecording = MatchRecordingMeta & {
  blob: Blob;
};

const DB_NAME = "brawl-draft-lab";
const STORE_NAME = "match-recordings";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    operation(store, resolve, reject);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Error de almacenamiento local"));
    };
  }));
}

export function saveMatchRecording(recording: StoredMatchRecording) {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function listMatchRecordings(): Promise<MatchRecordingMeta[]> {
  return withStore<MatchRecordingMeta[]>("readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const values = (request.result as StoredMatchRecording[])
        .map(({ blob: _blob, ...meta }) => meta)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      resolve(values);
    };
    request.onerror = () => reject(request.error);
  });
}

export function getMatchRecording(id: string): Promise<StoredMatchRecording | undefined> {
  return withStore<StoredMatchRecording | undefined>("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as StoredMatchRecording | undefined);
    request.onerror = () => reject(request.error);
  });
}

export function deleteMatchRecording(id: string) {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
