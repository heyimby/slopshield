import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractHostname, hostMatches, isSupportedSearchUrl, matchingRule, normalizeDomain, VERSION } from "./engine.ts";
import { ENGINES, EXTENSION_MATCHES, decodeBingU, detectEngine } from "./engines.ts";
import { addDomain, sanitizeSettings } from "./settings.ts";

test("normalizeDomain strips protocol, www, path, and port", () => {
  assert.deepEqual(normalizeDomain(" HTTPS://WWW.Example.com:443/a/b?q=1 "), { ok: true, host: "example.com" });
  assert.deepEqual(normalizeDomain("blog.example.com"), { ok: true, host: "blog.example.com" });
});

test("normalizeDomain rejects wildcards, bare names, and public suffixes", () => {
  assert.equal(normalizeDomain("").ok, false);
  assert.equal(normalizeDomain("*.example.com").ok, false);
  assert.equal(normalizeDomain("example").ok, false);
  assert.equal(normalizeDomain("co.uk").ok, false);
  assert.equal(normalizeDomain("notexample.com").ok, true);
});

test("hostMatches includes subdomains and rejects lookalikes", () => {
  assert.equal(hostMatches("example.com", "example.com"), true);
  assert.equal(hostMatches("www.example.com", "example.com"), true);
  assert.equal(hostMatches("a.b.example.com", "example.com"), true);
  assert.equal(hostMatches("notexample.com", "example.com"), false);
  assert.equal(hostMatches("example.com.evil.com", "example.com"), false);
  assert.equal(hostMatches("example.org", "example.com"), false);
  assert.equal(matchingRule("blog.familyhandyman.com", ["pinterest.com", "familyhandyman.com"]), "familyhandyman.com");
  assert.equal(matchingRule("notpinterest.com", ["pinterest.com"]), null);
});

test("extractHostname unwraps search redirects and ignores engine hosts", () => {
  assert.equal(extractHostname("https://www.familyhandyman.com/doors"), "www.familyhandyman.com");
  assert.equal(
    extractHostname("https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa&sa=U"),
    "example.com",
  );
  assert.equal(extractHostname("/url?q=https://example.com/x"), "example.com");
  assert.equal(extractHostname("/search?q=squeaky+door"), null);
  assert.equal(extractHostname("https://www.google.com/search?q=test"), null);
  assert.equal(extractHostname("https://webcache.googleusercontent.com/search?q=cache:abc"), null);
  assert.equal(extractHostname("javascript:alert(1)"), null);
  assert.equal(extractHostname("/url?sa=U"), null);
  const bingU = `a1${Buffer.from("https://example.com/a", "utf8").toString("base64url")}`;
  assert.equal(decodeBingU(bingU), "https://example.com/a");
  assert.equal(extractHostname(`https://www.bing.com/ck/a?u=${bingU}&ntb=1`, "https://www.bing.com/search"), "example.com");
  assert.equal(
    extractHostname("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=1", "https://duckduckgo.com/"),
    "example.com",
  );
  assert.equal(
    extractHostname(
      "https://r.search.yahoo.com/cbclk/RU=https%3A%2F%2Fexample.com%2Fa/RK=2/RS=abc",
      "https://search.yahoo.com/search",
    ),
    "example.com",
  );
  assert.equal(extractHostname("https://www.bing.com/search?q=doors", "https://www.bing.com/search"), null);
  assert.equal(extractHostname("https://www.baidu.com/link?url=opaque", "https://www.baidu.com/s"), null);
});

test("web results are supported and other tabs are not", () => {
  assert.equal(VERSION, "0.2.0");
  for (const engine of ENGINES) {
    const sample = `https://${engine.sampleHost}${engine.samplePath("squeaky door")}`;
    assert.equal(detectEngine(sample)?.id, engine.id, sample);
    assert.equal(isSupportedSearchUrl(sample), true, sample);
  }
  assert.equal(isSupportedSearchUrl("https://www.google.com/search?q=doors"), true);
  assert.equal(isSupportedSearchUrl("https://google.com/search?q=doors"), true);
  assert.equal(isSupportedSearchUrl("https://www.google.co.uk/search?q=doors"), true);
  assert.equal(isSupportedSearchUrl("https://www.google.com/maps"), false);
  assert.equal(isSupportedSearchUrl("https://www.google.com/search?q=cat&tbm=isch"), false);
  assert.equal(isSupportedSearchUrl("https://www.bing.com/images/search?q=doors"), false);
  assert.equal(isSupportedSearchUrl("https://duckduckgo.com/?q=doors&ia=images"), false);
  assert.equal(isSupportedSearchUrl("https://duckduckgo.com/"), false);
  assert.equal(isSupportedSearchUrl("https://images.search.yahoo.com/search?p=doors"), false);
  assert.equal(isSupportedSearchUrl("https://search.brave.com/images?q=doors"), false);
  assert.equal(isSupportedSearchUrl("https://www.qwant.com/?q=doors&t=images"), false);
  assert.equal(isSupportedSearchUrl("https://www.perplexity.ai/search?q=doors"), false);
  assert.equal(isSupportedSearchUrl("https://example.com/search?q=doors"), false);
  assert.equal(detectEngine("https://www.google.evil.com/search?q=doors"), null);
});

test("extension manifest only lists the supported web results", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../extension/static/manifest.json", import.meta.url), "utf8"),
  ) as { version: string; host_permissions: string[]; content_scripts: { matches: string[] }[] };
  assert.equal(manifest.version, VERSION);
  assert.deepEqual(manifest.host_permissions, [...EXTENSION_MATCHES]);
  assert.deepEqual(manifest.content_scripts[0]?.matches, [...EXTENSION_MATCHES]);
});

test("addDomain normalizes and refuses duplicates", () => {
  const start = sanitizeSettings({ hideAiPanels: false, domains: ["example.com"] });
  assert.equal(start.hideAiPanels, false);
  const again = addDomain(start, "www.example.com/path");
  assert.equal(again.error, "That domain is already listed.");
  const next = addDomain(start, "pinterest.com");
  assert.equal(next.error, null);
  assert.deepEqual(next.settings.domains, ["example.com", "pinterest.com"]);
  assert.deepEqual(start.domains, ["example.com"]);
});

test("sanitize drops junk and defaults panel hiding on", () => {
  const settings = sanitizeSettings({ domains: ["nope", "https://www.reddit.com/r/x", 4], paused: "yes" });
  assert.equal(settings.hideAiPanels, true);
  assert.equal(settings.paused, false);
  assert.deepEqual(settings.domains, ["reddit.com"]);
});
