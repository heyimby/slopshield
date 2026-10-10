import { detectEngine, isNonResultHost, unwrapRedirect } from "./engines.ts";

export const VERSION = "0.2.0";

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

export type DomainResult = { ok: true; host: string } | { ok: false; error: string };

export function normalizeDomain(input: string): DomainResult {
  let value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "Enter a domain." };
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.replace(/^\/\//, "");
  value = value.split(/[/?#]/)[0] ?? "";
  if (value.includes("@")) value = value.slice(value.lastIndexOf("@") + 1);
  value = value.replace(/:\d+$/, "");
  if (value.startsWith("www.")) value = value.slice(4);
  if (value.endsWith(".")) value = value.slice(0, -1);
  if (!value || value.includes("*") || /\s/.test(value) || value.includes("..")) {
    return { ok: false, error: "Use a domain like example.com — no wildcards." };
  }
  const labels = value.split(".");
  if (labels.length < 2) return { ok: false, error: "Use a full domain like example.com." };
  if (!labels.every((label) => LABEL.test(label))) {
    return { ok: false, error: "That doesn't look like a domain." };
  }
  const tld = labels[labels.length - 1] ?? "";
  if (tld.length < 2) return { ok: false, error: "That doesn't look like a domain." };
  if (labels.length === 2 && tld.length === 2 && SECOND_LEVEL.has(labels[0] ?? "")) {
    return { ok: false, error: "Use a full site, like example.co.uk." };
  }
  return { ok: true, host: value };
}

export function hostMatches(hostname: string, rule: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const normalized = rule.toLowerCase().replace(/\.$/, "");
  if (!host || !normalized || host.includes(" ") || normalized.includes(" ")) return false;
  return host === normalized || host.endsWith(`.${normalized}`);
}

export function matchingRule(hostname: string, rules: readonly string[]): string | null {
  for (const rule of rules) {
    if (hostMatches(hostname, rule)) return rule;
  }
  return null;
}

export function extractHostname(href: string, base = "https://www.google.com/search"): string | null {
  return readHost(href, base, 0);
}

function readHost(href: string, base: string, depth: number): string | null {
  if (depth > 2) return null;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const next = unwrapRedirect(url);
  if (next) return readHost(next, base, depth + 1);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || isNonResultHost(host)) return null;
  return host;
}

export function isSupportedSearchUrl(url: string): boolean {
  return detectEngine(url) !== null;
}
