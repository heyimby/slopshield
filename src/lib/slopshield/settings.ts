import { normalizeDomain, VERSION } from "./engine.ts";

export { VERSION };

export const SETTINGS_KEY = "slopshield.settings";
export const DOMAIN_CAP = 100;

export type Settings = {
  hideAiPanels: boolean;
  paused: boolean;
  domains: string[];
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  hideAiPanels: true,
  paused: false,
  domains: [],
  onboarded: false,
};

export function blankSettings(): Settings {
  return { hideAiPanels: true, paused: false, domains: [], onboarded: false };
}

export function sanitizeSettings(value: unknown): Settings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const domains: string[] = [];
  if (Array.isArray(raw.domains)) {
    for (const item of raw.domains) {
      if (typeof item !== "string") continue;
      const parsed = normalizeDomain(item);
      if (!parsed.ok || domains.includes(parsed.host)) continue;
      domains.push(parsed.host);
      if (domains.length >= DOMAIN_CAP) break;
    }
  }
  return {
    hideAiPanels: raw.hideAiPanels !== false,
    paused: raw.paused === true,
    domains,
    onboarded: raw.onboarded === true,
  };
}

export function addDomain(
  settings: Settings,
  input: string,
): { settings: Settings; error: string | null } {
  const parsed = normalizeDomain(input);
  if (!parsed.ok) return { settings, error: parsed.error };
  if (settings.domains.includes(parsed.host)) {
    return { settings, error: "That domain is already listed." };
  }
  if (settings.domains.length >= DOMAIN_CAP) {
    return { settings, error: "The list holds 100 domains." };
  }
  return { settings: { ...settings, domains: [...settings.domains, parsed.host] }, error: null };
}

export function removeDomain(settings: Settings, host: string): Settings {
  return { ...settings, domains: settings.domains.filter((item) => item !== host) };
}

export type SettingsListener = (settings: Settings) => void;

export type SettingsStore = {
  readonly ready: boolean;
  get(): Settings;
  replace(next: Settings): void;
  subscribe(listener: SettingsListener): () => void;
  dispose(): void;
};

export function createLocalStore(): SettingsStore {
  let current = readLocal();
  const listeners = new Set<SettingsListener>();
  const notify = () => {
    for (const listener of listeners) listener(current);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_KEY) return;
    current = readLocal();
    notify();
  };
  window.addEventListener("storage", onStorage);
  return {
    ready: true,
    get: () => current,
    replace(next) {
      current = sanitizeSettings(next);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      window.removeEventListener("storage", onStorage);
      listeners.clear();
    },
  };
}

function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return blankSettings();
    return sanitizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return blankSettings();
  }
}

export type BrowserApi = {
  storage: {
    local: {
      get: (key: string, callback: (items: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>) => void;
    };
    onChanged: {
      addListener: (
        listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
      ) => void;
    };
  };
  tabs?: {
    query: (query: { active: boolean; currentWindow: boolean }) => Promise<Array<{ id?: number }>>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  action?: {
    setBadgeText: (details: { text: string }) => void;
    setBadgeBackgroundColor: (details: { color: string }) => void;
  };
  runtime?: {
    onMessage: {
      addListener: (
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
  };
};

export function getBrowserApi(): BrowserApi | null {
  const scope = globalThis as typeof globalThis & { chrome?: BrowserApi; browser?: BrowserApi };
  const api = scope.chrome ?? scope.browser;
  if (!api?.storage?.local || !api.storage.onChanged) return null;
  return api;
}

export function createChromeStore(api: BrowserApi): SettingsStore {
  let current = blankSettings();
  let ready = false;
  const listeners = new Set<SettingsListener>();
  const notify = () => {
    for (const listener of listeners) listener(current);
  };
  const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, SETTINGS_KEY)) return;
    current = sanitizeSettings(changes[SETTINGS_KEY]?.newValue);
    ready = true;
    notify();
  };
  api.storage.onChanged.addListener(onChanged);
  api.storage.local.get(SETTINGS_KEY, (items) => {
    const stored = items?.[SETTINGS_KEY];
    if (stored == null) {
      current = blankSettings();
      api.storage.local.set({ [SETTINGS_KEY]: current });
    } else {
      current = sanitizeSettings(stored);
    }
    ready = true;
    notify();
  });
  return {
    get ready() {
      return ready;
    },
    get: () => current,
    replace(next) {
      current = sanitizeSettings(next);
      ready = true;
      api.storage.local.set({ [SETTINGS_KEY]: current });
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  };
}

export function diagnosticsText(
  settings: Settings,
  extra: { surface: string; hidden: number | null; note: string },
): string {
  const lines = [
    `SlopShield ${VERSION}`,
    `Surface: ${extra.surface}`,
    `Browser: ${typeof navigator === "undefined" ? "unknown" : navigator.userAgent}`,
    `Hide AI panels: ${settings.hideAiPanels ? "yes" : "no"}`,
    `Paused: ${settings.paused ? "yes" : "no"}`,
    `Domain rules: ${settings.domains.length}`,
    `Hidden on page: ${extra.hidden == null ? "unknown" : String(extra.hidden)}`,
  ];
  const note = extra.note.trim();
  if (note) lines.push(`Note: ${note}`);
  lines.push("Queries, URLs, and page contents are not included.");
  return lines.join("\n");
}

export const MSG_APPLY = "slopshield:apply";
export const MSG_REVEAL = "slopshield:reveal-all";
export const MSG_COUNT = "slopshield:count";
