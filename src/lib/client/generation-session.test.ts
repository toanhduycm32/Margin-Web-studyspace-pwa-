import { afterEach, expect, it, vi } from "vitest";
import { generationKey, generationStorage, rememberedGeneration, rememberGeneration, forgetGeneration, waitForReader } from "./generation-session";
afterEach(() => vi.unstubAllGlobals());
function storage() { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) || null,
  setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } }; }
const id = "12345678-1234-4234-8234-123456789abc";
it("recovers after tab closure while separating account, revision, source and action", () => {
  const disk = storage(); const tab = storage(); const key = generationKey("a", "r", "d", "m", "quiz");
  rememberGeneration(key, id, disk, tab);
  expect(rememberedGeneration(key, disk, storage())).toBe(id);
  for (const scope of [["b", "r", "d", "m", "quiz"], ["a", "s", "d", "m", "quiz"],
    ["a", "r", "e", "m", "quiz"], ["a", "r", "d", "n", "quiz"], ["a", "r", "d", "m", "summary"]]) {
    expect(rememberedGeneration(generationKey(...scope as [string, string, string, string, string]), disk, tab)).toBeNull();
  }
  forgetGeneration(key, disk, tab); expect(rememberedGeneration(key, disk, tab)).toBeNull();
});
it("migrates a tab continuation and ignores malformed identifiers", () => {
  const disk = storage(); const tab = storage(); tab.setItem("key", id);
  expect(rememberedGeneration("key", disk, tab)).toBe(id); expect(disk.getItem("key")).toBe(id);
  disk.setItem("bad", "not-an-id"); expect(rememberedGeneration("bad", disk, tab)).toBeNull();
});
it("keeps current-tab recovery usable when persistent storage is denied", () => {
  const denied = { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: () => { throw Error(); } };
  const tab = storage(); rememberGeneration("key", id, denied, tab);
  expect(rememberedGeneration("key", denied, tab)).toBe(id);
  forgetGeneration("key", denied, tab); expect(tab.getItem("key")).toBeNull();
});
it("tolerates browsers that deny the storage property itself", () => {
  const tab = storage();
  vi.stubGlobal("window", { get localStorage() { throw new DOMException("Denied", "SecurityError"); }, sessionStorage: tab });
  rememberGeneration("key", id, ...generationStorage());
  expect(rememberedGeneration("key", ...generationStorage())).toBe(id);
});
it("waits for both foreground visibility and connectivity before continuing", async () => {
  const page = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  const windowEvents = new EventTarget(); const network = { onLine: false };
  vi.stubGlobal("document", page); vi.stubGlobal("window", windowEvents); vi.stubGlobal("navigator", network);
  const paused = vi.fn(); let continued = false;
  const waiting = waitForReader(new AbortController().signal, paused).then(() => { continued = true; });
  expect(paused).toHaveBeenCalledOnce();
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve(); expect(continued).toBe(false);
  network.onLine = true; windowEvents.dispatchEvent(new Event("online"));
  await waiting; expect(continued).toBe(true);
});
it("cancels a paused continuation and removes wake listeners", async () => {
  const page = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  const windowEvents = new EventTarget(); const remove = vi.spyOn(page, "removeEventListener");
  vi.stubGlobal("document", page); vi.stubGlobal("window", windowEvents); vi.stubGlobal("navigator", { onLine: true });
  const controller = new AbortController(); const waiting = waitForReader(controller.signal, () => {});
  controller.abort(new Error("Stopped"));
  await expect(waiting).rejects.toThrow("Stopped"); expect(remove).toHaveBeenCalledOnce();
});
