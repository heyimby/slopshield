import { A, COLLAPSED } from "./attrs";
import { matchingRule } from "./engine";
import type { Settings } from "./settings";
import { cardHostname, columnSelector, engineFor, findAiModules, findOrganicCards } from "./serp";

export type ShieldHooks = { onChange?: () => void };

function tooBroad(el: HTMLElement, root: HTMLElement): boolean {
  if (el === root || el === document.body || el === document.documentElement) return true;
  if (!root.contains(el)) return true;
  const selector = columnSelector();
  try {
    if (el.querySelector(selector)) return true;
  } catch {
    return true;
  }
  return false;
}

function reveal(el: HTMLElement) {
  el.classList.remove(COLLAPSED);
  el.removeAttribute(A.state);
  el.removeAttribute(A.reason);
  el.removeAttribute(A.detail);
  const bar = el.previousElementSibling;
  if (bar instanceof HTMLElement && bar.hasAttribute(A.bar)) bar.remove();
}

function hide(
  el: HTMLElement,
  reason: "ai-panel" | "domain",
  detail: string,
  onRestore: () => void,
) {
  if (el === document.body || el === document.documentElement) return;
  const text = reason === "ai-panel" ? "AI panel hidden" : `Hidden by your domain rule · ${detail}`;
  if (
    el.getAttribute(A.state) === "hidden" &&
    el.getAttribute(A.reason) === reason &&
    (el.getAttribute(A.detail) ?? "") === detail &&
    el.classList.contains(COLLAPSED)
  ) {
    return;
  }
  let bar = el.previousElementSibling;
  if (!(bar instanceof HTMLElement) || !bar.hasAttribute(A.bar)) {
    const created = document.createElement("div");
    created.className = "slopshield-bar";
    created.setAttribute(A.bar, "");
    created.setAttribute("role", "group");
    el.before(created);
    bar = created;
  }
  bar.setAttribute("aria-label", text);
  bar.replaceChildren();
  const label = document.createElement("span");
  label.className = "slopshield-label";
  label.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slopshield-restore";
  button.textContent = "Restore";
  button.addEventListener("click", () => {
    el.setAttribute(A.restored, "1");
    reveal(el);
    onRestore();
  });
  bar.append(label, button);
  el.classList.add(COLLAPSED);
  el.setAttribute(A.state, "hidden");
  el.setAttribute(A.reason, reason);
  if (detail) el.setAttribute(A.detail, detail);
  else el.removeAttribute(A.detail);
}

function sweep(root: ParentNode) {
  root.querySelectorAll(`[${A.bar}]`).forEach((bar) => {
    const next = bar.nextElementSibling;
    if (!(next instanceof HTMLElement) || next.getAttribute(A.state) !== "hidden") bar.remove();
  });
}

export function hiddenCount(root: ParentNode): number {
  return root.querySelectorAll(`[${A.state}="hidden"]`).length;
}

export function revealAll(root: ParentNode, hooks?: ShieldHooks) {
  root.querySelectorAll(`[${A.state}="hidden"]`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.setAttribute(A.restored, "1");
    reveal(node);
  });
  hooks?.onChange?.();
}

export function releaseAll(root: ParentNode) {
  root.querySelectorAll(`[${A.state}="hidden"]`).forEach((node) => {
    if (node instanceof HTMLElement) reveal(node);
  });
}

export function reconcile(root: HTMLElement, settings: Settings, hooks?: ShieldHooks): number {
  const onRestore = () => hooks?.onChange?.();
  const engine = engineFor(root);
  if (settings.paused || !engine) {
    root.querySelectorAll(`[${A.state}="hidden"]`).forEach((node) => {
      if (node instanceof HTMLElement) reveal(node);
    });
    sweep(root);
    return 0;
  }

  const modules = findAiModules(root, engine);
  const desired = new Map<HTMLElement, { reason: "ai-panel" | "domain"; detail: string }>();
  if (settings.hideAiPanels) {
    for (const module of modules) {
      if (module.getAttribute(A.restored) === "1") continue;
      desired.set(module, { reason: "ai-panel", detail: "" });
    }
  }
  for (const card of findOrganicCards(root, modules, engine)) {
    if (card.getAttribute(A.restored) === "1") continue;
    const host = cardHostname(card, engine);
    if (!host) continue;
    const rule = matchingRule(host, settings.domains);
    if (!rule) continue;
    desired.set(card, { reason: "domain", detail: rule });
  }

  root.querySelectorAll(`[${A.state}="hidden"]`).forEach((node) => {
    if (node instanceof HTMLElement && !desired.has(node)) reveal(node);
  });
  for (const [el, info] of desired) {
    if (tooBroad(el, root)) continue;
    hide(el, info.reason, info.detail, onRestore);
  }
  sweep(root);
  return hiddenCount(root);
}

function noiseOnly(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    for (const node of nodes) {
      if (node instanceof Element) {
        if (node.hasAttribute(A.bar) || node.closest(`[${A.bar}]`)) continue;
        return false;
      }
      if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim()) return false;
    }
  }
  return true;
}

export function isShieldNoise(mutations: MutationRecord[]): boolean {
  return noiseOnly(mutations);
}

export function watchResults(
  root: HTMLElement,
  getSettings: () => Settings,
  hooks?: ShieldHooks,
): () => void {
  let timer = 0;
  const run = () => {
    timer = 0;
    reconcile(root, getSettings(), hooks);
    hooks?.onChange?.();
  };
  const observer = new MutationObserver((mutations) => {
    if (noiseOnly(mutations)) return;
    if (timer) return;
    timer = window.setTimeout(run, 40);
  });
  observer.observe(root, { childList: true, subtree: true });
  reconcile(root, getSettings(), hooks);
  return () => {
    observer.disconnect();
    if (timer) window.clearTimeout(timer);
  };
}
