type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const operationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A browser can throw on the storage property itself, before getItem is called.
const unavailableStorage: StorageLike = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
export function generationStorage(): [StorageLike, StorageLike] {
  let persistent = unavailableStorage, tab = unavailableStorage;
  try { persistent = window.localStorage; } catch { /* Browser storage is disabled. */ }
  try { tab = window.sessionStorage; } catch { /* Server checkpoints are unaffected. */ }
  return [persistent, tab];
}

export function generationKey(email: string, rule: string, documentId: string, md5: string, kind: string) {
  return `margin-ai-${email}-${rule}-${documentId}-${md5}-${kind}`;
}

// Store only the opaque operation identifier. Model responses and learning data
// remain in account-bound Drive records; every resumed server call reauthorizes.
export function rememberedGeneration(key: string, persistent: StorageLike, tab: StorageLike): string | null {
  let value: string | null = null;
  try { value = persistent.getItem(key); } catch { /* Storage can be disabled. */ }
  if (!value) { try { value = tab.getItem(key); } catch { /* No stored continuation. */ } }
  if (!value || !operationIdPattern.test(value)) return null;
  rememberGeneration(key, value, persistent, tab);
  return value;
}

export function rememberGeneration(key: string, id: string, persistent: StorageLike, tab: StorageLike) {
  if (!operationIdPattern.test(id)) throw Error("Invalid generation identifier");
  try { persistent.setItem(key, id); } catch { /* Current-tab recovery remains available. */ }
  try { tab.setItem(key, id); } catch { /* Server checkpoints remain safe. */ }
}

export function forgetGeneration(key: string, persistent: StorageLike, tab: StorageLike) {
  try { persistent.removeItem(key); } catch { /* No storage access. */ }
  try { tab.removeItem(key); } catch { /* No storage access. */ }
}

// A foreground reader can continue with its learning panel closed. Hidden/offline
// pages do not initiate another expensive request. The current request may finish
// server-side; the ordinary checkpoint replay reconciles it on return.
export async function waitForReader(signal: AbortSignal, onPause: () => void): Promise<void> {
  if (signal.aborted) throw signal.reason;
  if (document.visibilityState !== "hidden" && navigator.onLine) return;
  onPause();
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      signal.removeEventListener("abort", abort);
    };
    const check = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine) { cleanup(); resolve(); }
    };
    const abort = () => { cleanup(); reject(signal.reason); };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    signal.addEventListener("abort", abort, { once: true });
    check();
    if (signal.aborted) abort();
  });
}
