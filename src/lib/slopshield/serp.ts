import { A } from "./attrs";
import { extractHostname } from "./engine";
import {
  ALL_ROOTS_SELECTOR,
  detectEngine,
  engineById,
  type EngineProfile,
} from "./engines";

function ownText(el: Element): string {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  }
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function engineFor(root: HTMLElement): EngineProfile | null {
  const tagged = engineById(root.getAttribute(A.engine));
  if (tagged) return tagged;
  const href = root.ownerDocument?.defaultView?.location?.href;
  if (!href) return null;
  return detectEngine(href);
}

function isResultsColumn(el: Element, engine: EngineProfile): boolean {
  if (el.hasAttribute(A.results)) return true;
  return engine.roots.some((selector) => {
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  });
}

function boundModule(start: HTMLElement, root: HTMLElement, engine: EngineProfile, trusted: boolean): HTMLElement | null {
  if (!root.contains(start)) return null;
  let el = start;
  while (el.parentElement) {
    const parent = el.parentElement;
    if (parent === root || isResultsColumn(parent, engine) || !root.contains(parent)) break;
    if (engine.titles(parent).length > engine.titles(el).length) break;
    el = parent;
  }
  if (el === root || isResultsColumn(el, engine) || el === el.ownerDocument.body) return null;
  const fixture = el.getAttribute(A.fixture) === "ai-panel" || start.getAttribute(A.fixture) === "ai-panel";
  const cap = trusted || fixture ? 4 : 2;
  if (engine.titles(el).length >= cap) return null;
  return el;
}

function dedupeOuter(modules: HTMLElement[]): HTMLElement[] {
  const unique = [...new Set(modules)];
  return unique.filter((el) => !unique.some((other) => other !== el && other.contains(el)));
}

function hasLabel(el: Element, labels: ReadonlySet<string>): boolean {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current instanceof HTMLElement && labels.has(ownText(current))) return true;
    current = walker.nextNode();
  }
  return false;
}

export function findSearchRoot(doc: Document): HTMLElement | null {
  const explicit = doc.querySelector(`[${A.results}]`);
  if (explicit instanceof HTMLElement) return explicit;
  const engine = detectEngine(doc.URL);
  if (!engine) return null;
  for (const selector of engine.roots) {
    const found = doc.querySelector(selector);
    if (found instanceof HTMLElement) return found;
  }
  let hint: Element | null = null;
  try {
    hint = doc.querySelector(engine.cards);
  } catch {
    hint = null;
  }
  const parent = hint?.parentElement;
  if (parent instanceof HTMLElement && parent !== doc.body && parent !== doc.documentElement) return parent;
  return null;
}

export function rootsAppeared(node: Element, engine: EngineProfile): boolean {
  const selector = engine.roots.join(", ");
  if (!selector) return false;
  try {
    return node.matches(selector) || Boolean(node.querySelector(selector));
  } catch {
    return false;
  }
}

export function findAiModules(root: HTMLElement, engine: EngineProfile): HTMLElement[] {
  const labels = new Set(engine.labels);
  const modules: HTMLElement[] = [];
  const consider = (start: Element, trusted: boolean) => {
    if (!(start instanceof HTMLElement)) return;
    if (start.closest(`[${A.bar}]`)) return;
    const module = boundModule(start, root, engine, trusted);
    if (module) modules.push(module);
  };

  if (engine.aiTrusted) {
    root.querySelectorAll(engine.aiTrusted).forEach((el) => consider(el, true));
  }
  if (engine.aiLabeled && labels.size > 0) {
    root.querySelectorAll(engine.aiLabeled).forEach((el) => {
      if (hasLabel(el, labels)) consider(el, true);
    });
  }
  root.querySelectorAll(`[${A.fixture}="ai-panel"]`).forEach((el) => consider(el, true));

  if (labels.size > 0) {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
        const tag = node.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.hasAttribute(A.bar)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let current: Node | null = walker.nextNode();
    while (current) {
      if (current instanceof HTMLElement) {
        const text = ownText(current);
        if (labels.has(text) && current.childElementCount <= 3 && !current.closest(`a, h2, h3, [${A.organic}]`)) {
          consider(current, false);
        }
      }
      current = walker.nextNode();
    }
  }

  return dedupeOuter(modules);
}

export function findOrganicCards(root: HTMLElement, modules: readonly HTMLElement[], engine: EngineProfile): HTMLElement[] {
  const insideAi = new Set<HTMLElement>(modules);
  for (const module of modules) {
    module.querySelectorAll(engine.cards).forEach((node) => {
      if (node instanceof HTMLElement) insideAi.add(node);
    });
  }

  const cards: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  root.querySelectorAll(engine.cards).forEach((node) => {
    if (!(node instanceof HTMLElement) || seen.has(node) || insideAi.has(node)) return;
    if (node.closest(`[${A.bar}]`)) return;
    const anchors = engine.titles(node);
    if (anchors.length !== 1) return;
    const anchor = anchors[0];
    if (!anchor) return;
    const nested = node.querySelector(engine.cards);
    if (
      nested instanceof HTMLElement &&
      nested !== node &&
      nested.contains(anchor) &&
      engine.titles(nested).length === 1
    ) {
      return;
    }
    seen.add(node);
    cards.push(node);
  });
  return cards;
}

export function cardHostname(card: HTMLElement, engine: EngineProfile): string | null {
  const base = `https://${engine.sampleHost}/`;
  if (engine.card.useMu) {
    const mu = card.getAttribute("mu");
    if (mu) {
      const host = extractHostname(mu, base);
      if (host) return host;
    }
  }
  const href = engine.titles(card)[0]?.getAttribute("href");
  if (!href) return null;
  return extractHostname(href, base);
}

export function columnSelector(): string {
  return `${ALL_ROOTS_SELECTOR}, [${A.results}]`;
}
