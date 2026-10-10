import { A } from "./attrs.ts";

export type EngineId =
  | "google"
  | "bing"
  | "duckduckgo"
  | "yahoo"
  | "brave"
  | "ecosia"
  | "startpage"
  | "yandex"
  | "baidu"
  | "aol"
  | "qwant"
  | "kagi"
  | "you"
  | "mojeek";

export type TitleMode = "anchor-h3" | "anchor-h2" | "h2-anchor" | "h3-anchor" | "anchor-title";

export type PanelSpec = {
  label: string;
  className: string;
  attrs?: Record<string, string>;
};

export type CardSpec = {
  tag: "div" | "li" | "article";
  className: string;
  attrs?: Record<string, string>;
  title: TitleMode;
  titleClass?: string;
  list?: "ol" | "ul";
  listClass?: string;
  /** Real destination is on the card, not the tracking href. */
  useMu?: boolean;
};

export type EngineProfile = {
  id: EngineId;
  name: string;
  sampleHost: string;
  samplePath: (query: string) => string;
  host: (hostname: string) => boolean;
  isWebSearch: (url: URL) => boolean;
  roots: readonly string[];
  cards: string;
  titles: (scope: ParentNode) => HTMLAnchorElement[];
  /** Containers that are the AI panel even before the label text is read. */
  aiTrusted: string;
  /** Containers that count only when they also contain a recognized label. */
  aiLabeled: string;
  labels: readonly string[];
  panel: PanelSpec | null;
  card: CardSpec;
  matches: readonly string[];
};

const GOOGLE_DOMAINS = [
  "com",
  "co.uk",
  "ca",
  "com.au",
  "de",
  "fr",
  "co.jp",
  "co.in",
  "com.br",
  "it",
  "es",
  "com.mx",
  "nl",
  "pl",
  "com.tr",
  "co.id",
  "com.ar",
  "co.kr",
  "com.sa",
  "com.tw",
  "com.hk",
  "se",
  "be",
  "at",
  "ch",
  "com.eg",
  "co.za",
  "com.ph",
  "com.vn",
  "pt",
  "gr",
  "cz",
  "ro",
  "hu",
  "dk",
  "fi",
  "no",
  "co.nz",
  "ie",
  "com.co",
  "cl",
  "com.pe",
  "com.ng",
  "co.il",
  "ae",
  "com.ua",
  "com.pk",
  "com.sg",
  "co.th",
  "com.my",
] as const;

const GOOGLE_SUFFIX =
  /^(com|[a-z]{2}|(?:com|co|ne|or|ac|gov|org|net)\.[a-z]{2})$/;

function q(query: string): string {
  return encodeURIComponent(query);
}

export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function stripWww(hostname: string): string {
  const host = normalizeHost(hostname);
  return host.startsWith("www.") ? host.slice(4) : host;
}

function pathOf(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  return path || "/";
}

export function isGoogleProperty(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")) return true;
  if (host === "gstatic.com" || host.endsWith(".gstatic.com")) return true;
  const labels = host.split(".");
  const idx = labels.lastIndexOf("google");
  if (idx < 0 || idx === labels.length - 1) return false;
  return GOOGLE_SUFFIX.test(labels.slice(idx + 1).join("."));
}

export function isGoogleSearchHost(hostname: string): boolean {
  const host = stripWww(hostname);
  if (!host.startsWith("google.")) return false;
  return GOOGLE_SUFFIX.test(host.slice("google.".length));
}

function isGoogleWeb(url: URL): boolean {
  if (!isGoogleSearchHost(url.hostname)) return false;
  if (pathOf(url) !== "/search") return false;
  const tbm = url.searchParams.get("tbm");
  if (tbm && tbm !== "web") return false;
  const udm = url.searchParams.get("udm");
  if (udm && /^(2|6|7|8|14|18|28)$/.test(udm)) return false;
  return true;
}

function hostIn(hostname: string, names: readonly string[]): boolean {
  const host = stripWww(hostname);
  return names.some((name) => host === name || host.endsWith(`.${name}`));
}

function exactHost(hostname: string, names: readonly string[]): boolean {
  const host = stripWww(hostname);
  return names.includes(host);
}

const NON_WEB_IA = new Set(["images", "videos", "news", "shopping", "maps"]);

function isDuckWeb(url: URL): boolean {
  const host = stripWww(url.hostname);
  if (host !== "duckduckgo.com" && host !== "html.duckduckgo.com" && host !== "safe.duckduckgo.com") {
    return false;
  }
  const ia = (url.searchParams.get("ia") || url.searchParams.get("iax") || "").toLowerCase();
  if (ia && NON_WEB_IA.has(ia)) return false;
  const path = pathOf(url);
  if (path !== "/" && path !== "/html" && path !== "/lite") return false;
  return url.searchParams.has("q");
}

function isYahooHost(hostname: string): boolean {
  const host = stripWww(hostname);
  return (
    host === "search.yahoo.com" ||
    host.endsWith(".search.yahoo.com") ||
    host === "search.yahoo.co.jp" ||
    host.endsWith(".search.yahoo.co.jp")
  );
}

function isYahooWeb(url: URL): boolean {
  if (!isYahooHost(url.hostname)) return false;
  const host = stripWww(url.hostname);
  if (/^(images|news|video|local|shopping)\./.test(host)) return false;
  return pathOf(url) === "/search";
}

function isBingWeb(url: URL): boolean {
  if (!hostIn(url.hostname, ["bing.com"])) return false;
  return pathOf(url) === "/search";
}

function isBraveWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["search.brave.com"])) return false;
  return pathOf(url) === "/search";
}

function isEcosiaWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["ecosia.org"])) return false;
  return pathOf(url) === "/search";
}

function isStartpageWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["startpage.com"])) return false;
  const path = pathOf(url);
  return path === "/sp/search" || path === "/do/search";
}

function isYandexHost(hostname: string): boolean {
  return exactHost(hostname, ["yandex.com", "yandex.ru", "yandex.by", "yandex.kz", "yandex.uz", "ya.ru"]);
}

function isYandexWeb(url: URL): boolean {
  if (!isYandexHost(url.hostname)) return false;
  return pathOf(url) === "/search";
}

function isBaiduWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["baidu.com"])) return false;
  return pathOf(url) === "/s";
}

function isAolWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["search.aol.com"])) return false;
  return pathOf(url) === "/aol/search";
}

function isQwantWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["qwant.com"])) return false;
  if (pathOf(url) !== "/") return false;
  const tab = (url.searchParams.get("t") || "web").toLowerCase();
  if (tab !== "web") return false;
  return url.searchParams.has("q");
}

function isKagiWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["kagi.com"])) return false;
  return pathOf(url) === "/search";
}

function isYouWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["you.com"])) return false;
  return pathOf(url) === "/search";
}

function isMojeekWeb(url: URL): boolean {
  if (!exactHost(url.hostname, ["mojeek.com"])) return false;
  return pathOf(url) === "/search";
}

function headingAnchors(scope: ParentNode, heading: string): HTMLAnchorElement[] {
  if (!(scope instanceof Node)) return [];
  const found: HTMLAnchorElement[] = [];
  scope.querySelectorAll("a[href]").forEach((node) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    if (node.querySelector(heading)) {
      found.push(node);
      return;
    }
    const outer = node.closest(heading);
    if (outer && scope.contains(outer)) found.push(node);
  });
  return found;
}

function classAnchors(scope: ParentNode, selector: string): HTMLAnchorElement[] {
  const found: HTMLAnchorElement[] = [];
  scope.querySelectorAll("a[href]").forEach((node) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    if (node.matches(selector) || node.querySelector(selector)) found.push(node);
  });
  return found;
}

function mergeAnchors(...groups: HTMLAnchorElement[][]): HTMLAnchorElement[] {
  return [...new Set(groups.flat())];
}

function googleMatches(): string[] {
  const matches: string[] = [];
  for (const domain of GOOGLE_DOMAINS) {
    matches.push(`https://www.google.${domain}/search*`, `https://google.${domain}/search*`);
  }
  return matches;
}

function pair(host: string, path: string): string[] {
  if (host.startsWith("www.")) {
    return [`https://${host}${path}`, `https://${host.slice(4)}${path}`];
  }
  return [`https://${host}${path}`];
}

export const ENGINES: readonly EngineProfile[] = [
  {
    id: "google",
    name: "Google",
    sampleHost: "www.google.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: isGoogleSearchHost,
    isWebSearch: isGoogleWeb,
    roots: ["#rso", "#center_col", "#search"],
    cards: `[${A.organic}], div.g, .tF2Cxc`,
    titles: (scope) => headingAnchors(scope, "h3"),
    aiTrusted: "",
    aiLabeled: `[data-subtree="aimc"]`,
    labels: ["ai overview", "ai overviews"],
    panel: {
      label: "AI Overview",
      className: "",
      attrs: { "data-subtree": "aimc" },
    },
    card: {
      tag: "div",
      className: "serp-card g",
      attrs: { [A.organic]: "" },
      title: "anchor-h3",
    },
    matches: googleMatches(),
  },
  {
    id: "bing",
    name: "Bing",
    sampleHost: "www.bing.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => hostIn(hostname, ["bing.com"]),
    isWebSearch: isBingWeb,
    roots: ["#b_content", "#b_results"],
    cards: "li.b_algo",
    titles: (scope) => headingAnchors(scope, "h2"),
    aiTrusted: ".b_genserp_container, #copans_container",
    aiLabeled: "",
    labels: ["copilot", "ai overview", "ai overviews"],
    panel: { label: "Copilot", className: "b_genserp_container" },
    card: { tag: "li", className: "serp-card b_algo", title: "h2-anchor", list: "ol", listClass: "serp-list" },
    matches: ["https://www.bing.com/search*", "https://bing.com/search*", "https://cn.bing.com/search*"],
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    sampleHost: "duckduckgo.com",
    samplePath: (query) => `/?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["duckduckgo.com", "html.duckduckgo.com", "safe.duckduckgo.com"]),
    isWebSearch: isDuckWeb,
    roots: ["#links", "[data-testid='mainline']", "[data-area='mainline']", ".react-results--main"],
    cards: "article[data-testid='result'], li[data-layout='organic'], div.result, article.result",
    titles: (scope) =>
      mergeAnchors(
        classAnchors(scope, "a.result__a, a.result-link, a[data-testid='result-title-a']"),
        headingAnchors(scope, "h2"),
      ),
    aiTrusted: "[data-testid='search-assist'], [data-testid='duckassist']",
    aiLabeled: "",
    labels: ["search assist", "duckassist"],
    panel: { label: "Search Assist", className: "", attrs: { "data-testid": "search-assist" } },
    card: {
      tag: "article",
      className: "serp-card result",
      attrs: { "data-testid": "result" },
      title: "h2-anchor",
      titleClass: "result__a",
    },
    matches: ["https://duckduckgo.com/*", "https://html.duckduckgo.com/*", "https://safe.duckduckgo.com/*"],
  },
  {
    id: "yahoo",
    name: "Yahoo",
    sampleHost: "search.yahoo.com",
    samplePath: (query) => `/search?p=${q(query)}`,
    host: isYahooHost,
    isWebSearch: isYahooWeb,
    roots: ["#web", "#main"],
    cards: "div.dd.algo, div.algo, li.dd",
    titles: (scope) => mergeAnchors(classAnchors(scope, "a.compTitle"), headingAnchors(scope, "h3")),
    aiTrusted: "[data-testid='yahoo-scout']",
    aiLabeled: "",
    labels: ["yahoo scout", "explore ai results with yahoo scout"],
    panel: { label: "Yahoo Scout", className: "", attrs: { "data-testid": "yahoo-scout" } },
    card: { tag: "div", className: "serp-card dd algo", title: "h3-anchor", titleClass: "compTitle" },
    matches: ["https://search.yahoo.com/search*", "https://*.search.yahoo.com/search*", "https://search.yahoo.co.jp/search*"],
  },
  {
    id: "brave",
    name: "Brave",
    sampleHost: "search.brave.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["search.brave.com"]),
    isWebSearch: isBraveWeb,
    roots: ["#results"],
    cards: "div.snippet[data-type='web']",
    titles: (scope) => classAnchors(scope, ".title, .snippet-title"),
    aiTrusted: "#llm-snippet, .snippet[data-type='llm'], [data-type='llm']",
    aiLabeled: "",
    labels: ["ai answer", "ai answers", "brave ai", "summarizer"],
    panel: { label: "AI Answer", className: "snippet", attrs: { "data-type": "llm", id: "llm-snippet" } },
    card: {
      tag: "div",
      className: "serp-card snippet",
      attrs: { "data-type": "web" },
      title: "anchor-title",
    },
    matches: ["https://search.brave.com/search*"],
  },
  {
    id: "ecosia",
    name: "Ecosia",
    sampleHost: "www.ecosia.org",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["ecosia.org"]),
    isWebSearch: isEcosiaWeb,
    roots: ["[data-test-id='mainline']", "#main", "main"],
    cards: "[data-test-id='organic-result'], article.result",
    titles: (scope) => headingAnchors(scope, "h2, h3"),
    aiTrusted: "[data-test-id='ai-overview'], [data-testid='ai-overview']",
    aiLabeled: "",
    labels: ["ai overview", "ai overviews"],
    panel: { label: "AI Overview", className: "", attrs: { "data-test-id": "ai-overview" } },
    card: {
      tag: "article",
      className: "serp-card result",
      attrs: { "data-test-id": "organic-result" },
      title: "anchor-h2",
    },
    matches: ["https://www.ecosia.org/search*", "https://ecosia.org/search*"],
  },
  {
    id: "startpage",
    name: "Startpage",
    sampleHost: "www.startpage.com",
    samplePath: (query) => `/sp/search?query=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["startpage.com"]),
    isWebSearch: isStartpageWeb,
    roots: ["#main", "#results"],
    cards: "div.result",
    titles: (scope) => mergeAnchors(classAnchors(scope, "a.result-link"), headingAnchors(scope, "h2")),
    aiTrusted: "",
    aiLabeled: "",
    labels: ["ai overview", "ai overviews"],
    panel: null,
    card: {
      tag: "div",
      className: "serp-card result",
      title: "h2-anchor",
      titleClass: "result-link result-title",
    },
    matches: ["https://www.startpage.com/sp/search*", "https://www.startpage.com/do/search*", "https://startpage.com/sp/search*", "https://startpage.com/do/search*"],
  },
  {
    id: "yandex",
    name: "Yandex",
    sampleHost: "yandex.com",
    samplePath: (query) => `/search/?text=${q(query)}`,
    host: isYandexHost,
    isWebSearch: isYandexWeb,
    roots: ["#search-result", ".serp-list", "#search"],
    cards: "li.serp-item",
    titles: (scope) => mergeAnchors(classAnchors(scope, "a.OrganicTitle-Link"), headingAnchors(scope, "h2")),
    aiTrusted: ".NeuroAnswer, [data-fast-name='neuro']",
    aiLabeled: "",
    labels: ["yandexgpt", "нейро", "alice", "алиса"],
    panel: { label: "YandexGPT", className: "NeuroAnswer" },
    card: {
      tag: "li",
      className: "serp-card serp-item",
      title: "h2-anchor",
      titleClass: "OrganicTitle-Link",
      list: "ul",
      listClass: "serp-list",
    },
    matches: [
      "https://yandex.com/search*",
      "https://yandex.ru/search*",
      "https://ya.ru/search*",
      "https://yandex.by/search*",
      "https://yandex.kz/search*",
      "https://yandex.uz/search*",
    ],
  },
  {
    id: "baidu",
    name: "Baidu",
    sampleHost: "www.baidu.com",
    samplePath: (query) => `/s?wd=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["baidu.com"]),
    isWebSearch: isBaiduWeb,
    roots: ["#content_left"],
    cards: "div.c-container",
    titles: (scope) => headingAnchors(scope, "h3"),
    aiTrusted: ".ai-summary, [tpl='ai_answer']",
    aiLabeled: "",
    labels: ["文心一言", "ai智能回答", "智能回答"],
    panel: { label: "文心一言", className: "ai-summary" },
    card: { tag: "div", className: "serp-card c-container", title: "h3-anchor", useMu: true },
    matches: ["https://www.baidu.com/s*", "https://baidu.com/s*"],
  },
  {
    id: "aol",
    name: "AOL",
    sampleHost: "search.aol.com",
    samplePath: (query) => `/aol/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["search.aol.com"]),
    isWebSearch: isAolWeb,
    roots: ["#web", "#main", "#b_results"],
    cards: "div.dd.algo, div.algo, li.b_algo",
    titles: (scope) => mergeAnchors(headingAnchors(scope, "h3"), headingAnchors(scope, "h2")),
    aiTrusted: ".b_genserp_container, #copans_container, [data-testid='yahoo-scout']",
    aiLabeled: "",
    labels: ["copilot", "yahoo scout", "ai overview", "ai overviews"],
    panel: { label: "Copilot", className: "b_genserp_container" },
    card: { tag: "div", className: "serp-card algo", title: "h3-anchor" },
    matches: ["https://search.aol.com/aol/search*"],
  },
  {
    id: "qwant",
    name: "Qwant",
    sampleHost: "www.qwant.com",
    samplePath: (query) => `/?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["qwant.com"]),
    isWebSearch: isQwantWeb,
    roots: ["[data-testid='sectionWeb']", "main"],
    cards: "article[data-testid='web-result'], div.result",
    titles: (scope) => headingAnchors(scope, "h2"),
    aiTrusted: "[data-testid='qwant-ai']",
    aiLabeled: "",
    labels: ["qwant ai"],
    panel: { label: "Qwant AI", className: "", attrs: { "data-testid": "qwant-ai" } },
    card: {
      tag: "article",
      className: "serp-card",
      attrs: { "data-testid": "web-result" },
      title: "h2-anchor",
    },
    matches: ["https://www.qwant.com/*", "https://qwant.com/*"],
  },
  {
    id: "kagi",
    name: "Kagi",
    sampleHost: "kagi.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["kagi.com"]),
    isWebSearch: isKagiWeb,
    roots: ["#main", "main"],
    cards: "div.search-result",
    titles: (scope) => mergeAnchors(classAnchors(scope, "a.__sr-title"), headingAnchors(scope, "h3")),
    aiTrusted: ".kagi-assistant, [data-kagi='assistant']",
    aiLabeled: "",
    labels: ["kagi assistant"],
    panel: { label: "Kagi Assistant", className: "kagi-assistant" },
    card: { tag: "div", className: "serp-card search-result", title: "h3-anchor", titleClass: "__sr-title" },
    matches: ["https://kagi.com/search*"],
  },
  {
    id: "you",
    name: "You.com",
    sampleHost: "you.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["you.com"]),
    isWebSearch: isYouWeb,
    roots: ["[data-testid='search-results']", "main"],
    cards: "article[data-testid='search-result']",
    titles: (scope) => headingAnchors(scope, "h2"),
    aiTrusted: "[data-testid='smart-answer']",
    aiLabeled: "",
    labels: ["smart answer", "youchat"],
    panel: { label: "Smart Answer", className: "", attrs: { "data-testid": "smart-answer" } },
    card: {
      tag: "article",
      className: "serp-card",
      attrs: { "data-testid": "search-result" },
      title: "h2-anchor",
    },
    matches: ["https://you.com/search*"],
  },
  {
    id: "mojeek",
    name: "Mojeek",
    sampleHost: "www.mojeek.com",
    samplePath: (query) => `/search?q=${q(query)}`,
    host: (hostname) => exactHost(hostname, ["mojeek.com"]),
    isWebSearch: isMojeekWeb,
    roots: ["ul.results", "#results"],
    cards: "ul.results > li",
    titles: (scope) => headingAnchors(scope, "h2"),
    aiTrusted: "",
    aiLabeled: "",
    labels: [],
    panel: null,
    card: { tag: "li", className: "serp-card", title: "h2-anchor", list: "ul", listClass: "results serp-list" },
    matches: ["https://www.mojeek.com/search*", "https://mojeek.com/search*"],
  },
];

const BY_ID = new Map(ENGINES.map((engine) => [engine.id, engine]));

export function engineById(id: string | null | undefined): EngineProfile | null {
  if (!id) return null;
  return BY_ID.get(id as EngineId) ?? null;
}

export function detectEngine(url: string): EngineProfile | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  for (const engine of ENGINES) {
    if (engine.isWebSearch(parsed)) return engine;
  }
  return null;
}

export const EXTENSION_MATCHES: readonly string[] = ENGINES.flatMap((engine) => [...engine.matches]);

export const ALL_ROOTS_SELECTOR = [...new Set(ENGINES.flatMap((engine) => [...engine.roots]))].join(", ");

function asHttp(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return null;
}

function decodeRepeated(value: string): string | null {
  let current = value.trim();
  for (let i = 0; i < 2; i += 1) {
    const http = asHttp(current);
    if (http) return http;
    try {
      const next = decodeURIComponent(current);
      if (!next || next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return asHttp(current);
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9+/_=-]+$/.test(value) || value.length < 8) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return binary;
  } catch {
    return null;
  }
}

export function decodeBingU(value: string): string | null {
  const raw = value.trim();
  const body = raw.startsWith("a1") ? raw.slice(2) : raw;
  return decodeRepeated(body) || asHttp(decodeBase64Url(body));
}

function yahooTarget(url: URL): string | null {
  const fromQuery = url.searchParams.get("RU") || url.searchParams.get("ru");
  if (fromQuery) {
    const decoded = decodeRepeated(fromQuery);
    if (decoded) return decoded;
  }
  const match = url.pathname.match(/\/RU=([^/]+)/i);
  if (!match?.[1]) return null;
  return decodeRepeated(match[1]);
}

/** Pull an off-site destination out of a search engine click redirect. */
export function unwrapRedirect(url: URL): string | null {
  const host = normalizeHost(url.hostname);
  if (isGoogleProperty(host) && (url.pathname === "/url" || url.pathname.startsWith("/url/"))) {
    return decodeRepeated(url.searchParams.get("q") || url.searchParams.get("url") || "") ;
  }
  if (hostIn(host, ["bing.com"]) && url.pathname.startsWith("/ck/")) {
    const param = url.searchParams.get("u");
    return param ? decodeBingU(param) : null;
  }
  if (
    (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) &&
    (url.pathname === "/l" || url.pathname === "/l/")
  ) {
    return decodeRepeated(url.searchParams.get("uddg") || "");
  }
  if (
    host === "r.search.yahoo.com" ||
    isYahooHost(host) ||
    (host.endsWith(".yahoo.com") && url.pathname.toLowerCase().includes("/ru="))
  ) {
    const target = yahooTarget(url);
    if (target) return target;
  }
  if (exactHost(host, ["search.aol.com"]) || host.endsWith(".aol.com")) {
    const target = yahooTarget(url) || decodeRepeated(url.searchParams.get("u") || "");
    if (target) return target;
  }
  if (exactHost(host, ["startpage.com"])) {
    const path = pathOf(url);
    if (path.startsWith("/do/") || path.startsWith("/sp/")) {
      return decodeRepeated(url.searchParams.get("url") || url.searchParams.get("u") || "");
    }
  }
  if (host === "redirect.ecosia.org" || (exactHost(host, ["ecosia.org"]) && url.pathname.startsWith("/redirect"))) {
    return decodeRepeated(url.searchParams.get("url") || url.searchParams.get("u") || "");
  }
  return null;
}

export function isNonResultHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (isGoogleProperty(host)) return true;
  if (hostIn(host, ["bing.com"])) return true;
  if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) return true;
  if (isYahooHost(host) || host === "r.search.yahoo.com") return true;
  if (exactHost(host, ["search.brave.com"])) return true;
  if (exactHost(host, ["ecosia.org"]) || host === "redirect.ecosia.org") return true;
  if (exactHost(host, ["startpage.com"])) return true;
  if (isYandexHost(host)) return true;
  if (exactHost(host, ["baidu.com"])) return true;
  if (exactHost(host, ["search.aol.com"])) return true;
  if (exactHost(host, ["qwant.com"])) return true;
  if (exactHost(host, ["kagi.com"])) return true;
  if (exactHost(host, ["you.com"])) return true;
  if (exactHost(host, ["mojeek.com"])) return true;
  return false;
}
