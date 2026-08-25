const DB = "ventura-ask";
const VER = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      if (!db.objectStoreNames.contains("asks")) db.createObjectStore("asks");
      if (!db.objectStoreNames.contains("replies")) db.createObjectStore("replies");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    const out = fn(store);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

export const nid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);

export async function putBlob(id, blob) {
  await withStore("blobs", "readwrite", (s) => s.put(blob, id));
  return id;
}

export async function getBlob(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readonly");
    const req = tx.objectStore("blobs").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function blobUrl(id) {
  if (!id) return "";
  if (id.startsWith("./") || id.startsWith("http") || id.startsWith("blob:")) return id;
  const blob = await getBlob(id);
  return blob ? URL.createObjectURL(blob) : "";
}

export async function saveAsk(ask) {
  ask.updatedAt = Date.now();
  if (!ask.createdAt) ask.createdAt = ask.updatedAt;
  await withStore("asks", "readwrite", (s) => s.put(ask, ask.id));
  localStorage.setItem("ventura-ask-current", ask.id);
  return ask;
}

export async function getAsk(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("asks", "readonly");
    const req = tx.objectStore("asks").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listAsks() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("asks", "readonly");
    const req = tx.objectStore("asks").getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveReply(reply) {
  reply.id = reply.id || nid(10);
  reply.at = reply.at || Date.now();
  await withStore("replies", "readwrite", (s) => s.put(reply, reply.id));
  return reply;
}

export async function listReplies(askId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("replies", "readonly");
    const req = tx.objectStore("replies").getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).filter((r) => r.askId === askId);
      rows.sort((a, b) => b.at - a.at);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export function currentAskId() {
  return localStorage.getItem("ventura-ask-current") || "";
}

export function takeUrl(id) {
  const u = new URL(location.href);
  u.search = `?take=${encodeURIComponent(id)}`;
  u.hash = "";
  return u.toString();
}

export async function hydrateAsk(ask) {
  if (!ask) return null;
  const steps = [];
  for (const step of ask.steps || []) {
    const media = step.mediaKey ? await blobUrl(step.mediaKey) : step.media || "";
    steps.push({ ...step, media });
  }
  return { ...ask, steps };
}
