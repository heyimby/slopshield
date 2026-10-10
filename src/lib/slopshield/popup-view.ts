import { VERSION } from "./engine";
import { MSG_APPLY, MSG_COUNT, MSG_REVEAL, addDomain, diagnosticsText, removeDomain } from "./settings";
import type { BrowserApi, Settings, SettingsStore } from "./settings";

export type PopupOptions = {
  mode: "studio" | "extension";
  store: SettingsStore;
  api?: BrowserApi | null;
  onChange?: () => void;
  onRevealAll?: () => void;
  getHidden?: () => number;
};

export type PopupHandle = {
  refresh: () => void;
  destroy: () => void;
};

function child<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function mark(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("class", "ss-mark");
  svg.setAttribute("aria-hidden", "true");
  const tile = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  tile.setAttribute("width", "32");
  tile.setAttribute("height", "32");
  tile.setAttribute("rx", "8");
  tile.setAttribute("fill", "currentColor");
  const slot = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  slot.setAttribute("x", "7");
  slot.setAttribute("y", "14");
  slot.setAttribute("width", "18");
  slot.setAttribute("height", "4");
  slot.setAttribute("rx", "1");
  slot.setAttribute("class", "ss-mark-slot");
  svg.append(tile, slot);
  return svg;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function messageTab(api: BrowserApi, message: unknown): Promise<{ ok: boolean; hidden: number }> {
  if (!api.tabs) return { ok: false, hidden: 0 };
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const id = tabs[0]?.id;
    if (id == null) return { ok: false, hidden: 0 };
    const response = (await api.tabs.sendMessage(id, message)) as { ok?: boolean; hidden?: number } | undefined;
    if (!response || response.ok === false) return { ok: false, hidden: 0 };
    return { ok: true, hidden: typeof response.hidden === "number" ? response.hidden : 0 };
  } catch {
    return { ok: false, hidden: 0 };
  }
}

export function renderPopup(container: HTMLElement, options: PopupOptions): PopupHandle {
  const root = child("div", "ss-pop");
  container.replaceChildren(root);

  const head = child("div", "ss-head");
  const titleWrap = child("div", "ss-title");
  titleWrap.append(child("p", "ss-name", "SlopShield"), child("p", "ss-ver", `${VERSION} · on this device`));
  const state = child("p", "ss-state", "Active");
  state.dataset.state = "active";
  head.append(mark(), titleWrap, state);

  const onboard = child("div", "ss-card ss-onboard");
  onboard.append(
    child(
      "p",
      undefined,
      "Works on web results from Google, Bing, DuckDuckGo, Yahoo, Brave, Ecosia, Startpage, Yandex, Baidu, AOL, Qwant, Kagi, You.com, and Mojeek. Hides recognized AI answer panels and domains you add. It does not decide whether a page was written by AI.",
    ),
  );
  const gotIt = child("button", "ss-solid", "Got it");
  gotIt.type = "button";
  onboard.append(gotIt);

  const toggles = child("div", "ss-card");
  const aiButton = child("button", "ss-toggle");
  aiButton.type = "button";
  aiButton.append(child("span", undefined, "Hide AI answer panels"), switchFace());
  const pauseButton = child("button", "ss-toggle");
  pauseButton.type = "button";
  pauseButton.append(child("span", undefined, "Pause filtering"), switchFace());
  const pauseHint = child("p", "ss-hint", "Paused. This page stays unfiltered until you turn pause off.");
  toggles.append(aiButton, pauseButton, pauseHint);

  const domains = child("div", "ss-card");
  const domainLabel = child("label", "ss-label", "Domains");
  domainLabel.htmlFor = "ss-domain";
  const hint = child(
    "p",
    "ss-hint",
    "example.com also hides its subdomains. It does not hide notexample.com.",
  );
  const form = child("form", "ss-add");
  const input = child("input");
  input.id = "ss-domain";
  input.type = "text";
  input.placeholder = "pinterest.com";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-describedby", "ss-domain-error");
  const add = child("button", "ss-solid", "Add");
  add.type = "submit";
  form.append(input, add);
  const error = child("p", "ss-error");
  error.id = "ss-domain-error";
  error.setAttribute("role", "alert");
  const list = child("ul", "ss-list");
  domains.append(domainLabel, hint, form, error, list);

  const pageCard = child("div", "ss-card");
  const showAll = child("button", "ss-ghost", "Show hidden on this page");
  showAll.type = "button";
  const pageStatus = child("p", "ss-page");
  pageStatus.setAttribute("aria-live", "polite");
  pageCard.append(showAll, pageStatus);

  const report = child("div", "ss-card");
  const noteLabel = child("label", "ss-label", "What should a report mention? (optional)");
  noteLabel.htmlFor = "ss-note";
  const note = child("textarea", "ss-note");
  note.id = "ss-note";
  note.rows = 2;
  note.maxLength = 500;
  const copy = child("button", "ss-ghost", "Copy diagnostics");
  copy.type = "button";
  const copied = child("p", "ss-page");
  copied.setAttribute("aria-live", "polite");
  const reportOut = child("pre", "ss-report");
  reportOut.tabIndex = 0;
  reportOut.hidden = true;
  const fine = child(
    "p",
    "ss-fine",
    "Copy includes version, browser, and your switches. Searches, addresses, and page text stay out.",
  );
  report.append(noteLabel, note, copy, copied, reportOut, fine);

  root.append(head, onboard, toggles, domains, pageCard, report);

  let pageConnected = options.mode === "studio";
  let pageHidden = 0;
  let listKey = "";
  let locked = !options.store.ready;

  function switchFace(): HTMLSpanElement {
    const face = child("span", "ss-switch");
    face.setAttribute("aria-hidden", "true");
    face.append(child("span", "ss-switch-thumb"));
    return face;
  }

  function setLocked(next: boolean) {
    locked = next;
    root.querySelectorAll("button, input, textarea").forEach((node) => {
      if (
        node instanceof HTMLButtonElement ||
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement
      ) {
        node.disabled = next;
      }
    });
  }

  function paintControls() {
    const settings = options.store.get();
    aiButton.setAttribute("aria-pressed", settings.hideAiPanels ? "true" : "false");
    pauseButton.setAttribute("aria-pressed", settings.paused ? "true" : "false");
    state.textContent = settings.paused ? "Paused" : "Active";
    state.dataset.state = settings.paused ? "paused" : "active";
    onboard.hidden = settings.onboarded;
    pauseHint.hidden = !settings.paused;
    const key = settings.domains.join("\n");
    if (key !== listKey) {
      listKey = key;
      list.replaceChildren();
      if (settings.domains.length === 0) {
        list.append(child("li", "ss-empty", "No domains yet."));
      } else {
        for (const host of settings.domains) {
          const item = child("li", "ss-domain");
          item.append(child("span", undefined, host));
          const remove = child("button", "ss-text", "Remove");
          remove.type = "button";
          remove.setAttribute("aria-label", `Remove ${host}`);
          remove.addEventListener("click", () => {
            void push(removeDomain(options.store.get(), host));
          });
          item.append(remove);
          list.append(item);
        }
      }
    }
    if (locked) setLocked(true);
  }

  function paintStatus() {
    const settings = options.store.get();
    showAll.disabled = locked || !pageConnected || pageHidden === 0;
    if (settings.paused) {
      pageStatus.textContent = "Paused. Filtering is off until you resume.";
      return;
    }
    if (!pageConnected) {
      pageStatus.textContent = "Open a web results page on a supported search engine.";
      return;
    }
    pageStatus.textContent =
      pageHidden === 0
        ? options.mode === "studio"
          ? "Nothing hidden on this sample page."
          : "Nothing hidden on this search page."
        : pageHidden === 1
          ? options.mode === "studio"
            ? "1 hidden on this sample page."
            : "1 hidden on this search page."
          : options.mode === "studio"
            ? `${pageHidden} hidden on this sample page.`
            : `${pageHidden} hidden on this search page.`;
  }

  async function push(next: Settings) {
    options.store.replace(next);
    if (options.mode === "studio") {
      options.onChange?.();
      pageConnected = true;
      pageHidden = options.getHidden?.() ?? 0;
      paintStatus();
      return;
    }
    if (!options.api) {
      pageConnected = false;
      paintStatus();
      return;
    }
    const response = await messageTab(options.api, { type: MSG_APPLY, settings: options.store.get() });
    pageConnected = response.ok;
    pageHidden = response.hidden;
    paintStatus();
  }

  aiButton.addEventListener("click", () => {
    const current = options.store.get();
    void push({ ...current, hideAiPanels: !current.hideAiPanels });
  });
  pauseButton.addEventListener("click", () => {
    const current = options.store.get();
    void push({ ...current, paused: !current.paused });
  });
  gotIt.addEventListener("click", () => {
    void push({ ...options.store.get(), onboarded: true });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = addDomain(options.store.get(), input.value);
    if (result.error) {
      error.textContent = result.error;
      return;
    }
    error.textContent = "";
    input.value = "";
    void push(result.settings);
  });
  showAll.addEventListener("click", () => {
    if (options.mode === "studio") {
      options.onRevealAll?.();
      pageHidden = options.getHidden?.() ?? 0;
      paintStatus();
      return;
    }
    if (!options.api) return;
    void messageTab(options.api, { type: MSG_REVEAL }).then((response) => {
      pageConnected = response.ok;
      pageHidden = response.hidden;
      paintStatus();
    });
  });
  copy.addEventListener("click", () => {
    const text = diagnosticsText(options.store.get(), {
      surface: options.mode === "studio" ? "studio" : "extension",
      hidden: pageConnected ? pageHidden : null,
      note: note.value,
    });
    void copyText(text).then((ok) => {
      if (ok) {
        copied.textContent = "Copied.";
        reportOut.hidden = true;
        return;
      }
      copied.textContent = "Clipboard blocked. The report is below — select it.";
      reportOut.hidden = false;
      reportOut.textContent = text;
    });
  });

  const unsub = options.store.subscribe(() => {
    if (options.store.ready && locked) setLocked(false);
    paintControls();
    paintStatus();
  });

  function refresh() {
    if (options.store.ready && locked) setLocked(false);
    paintControls();
    if (options.mode === "studio") {
      pageConnected = true;
      pageHidden = options.getHidden?.() ?? 0;
      paintStatus();
      return;
    }
    if (!options.api) {
      pageConnected = false;
      paintStatus();
      return;
    }
    void messageTab(options.api, { type: MSG_COUNT }).then((response) => {
      pageConnected = response.ok;
      pageHidden = response.hidden;
      paintStatus();
    });
  }

  setLocked(!options.store.ready);
  paintControls();
  paintStatus();
  if (options.mode === "extension") refresh();

  return {
    refresh,
    destroy() {
      unsub();
      container.replaceChildren();
    },
  };
}
