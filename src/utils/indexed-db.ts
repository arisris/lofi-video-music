const DB_NAME = "IconifyDb";
const DB_VERSION = 1;
const STORE_NAME = "icons";

export interface IconRecord {
  id: string;
  prefix: string;
  name: string;
  body: string;
  width: number;
  height: number;
}

export const initDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("prefix", "prefix", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const hasIcons = async (): Promise<boolean> => {
  try {
    const db = await initDb();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        resolve(countRequest.result > 0);
      };
      countRequest.onerror = () => {
        resolve(false);
      };
    });
  } catch (err) {
    console.error("IndexedDB hasIcons check failed:", err);
    return false;
  }
};

export const populateIcons = async (
  progressCallback?: (message: string) => void,
): Promise<void> => {
  const db = await initDb();

  if (progressCallback) progressCallback("Loading Remix Icons...");
  const riModule = await import("@iconify-json/ri/icons.json");
  const riIcons = riModule.default as any;

  if (progressCallback) progressCallback("Loading Material Design Icons...");
  const mdiModule = await import("@iconify-json/mdi/icons.json");
  const mdiIcons = mdiModule.default as any;

  if (progressCallback)
    progressCallback(
      "Storing icons to database (this may take a few seconds)...",
    );

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Add all ri icons
    Object.keys(riIcons.icons).forEach((name) => {
      const icon = riIcons.icons[name];
      store.put({
        id: `ri:${name}`,
        prefix: "ri",
        name: name,
        body: icon.body,
        width: icon.width || riIcons.width || 24,
        height: icon.height || riIcons.height || 24,
      });
    });

    // Add all mdi icons
    Object.keys(mdiIcons.icons).forEach((name) => {
      const icon = mdiIcons.icons[name];
      store.put({
        id: `mdi:${name}`,
        prefix: "mdi",
        name: name,
        body: icon.body,
        width: icon.width || mdiIcons.width || 24,
        height: icon.height || mdiIcons.height || 24,
      });
    });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (e) => {
      reject((e.target as IDBRequest).error);
    };
  });
};

export const getIconFromDb = async (id: string): Promise<IconRecord | null> => {
  try {
    const db = await initDb();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        resolve((request.result as IconRecord) || null);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.error(`Failed to get icon ${id} from database:`, err);
    return null;
  }
};

export const getAllIconIds = async (): Promise<string[]> => {
  try {
    const db = await initDb();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        resolve((request.result as string[]) || []);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.error("Failed to get all icon keys from database:", err);
    return [];
  }
};
