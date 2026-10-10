import { hiddenCount, isShieldNoise, reconcile, releaseAll, revealAll } from "../lib/slopshield/dom";
import { isSupportedSearchUrl } from "../lib/slopshield/engine";
import { detectEngine } from "../lib/slopshield/engines";
import { findSearchRoot, rootsAppeared } from "../lib/slopshield/serp";
import {
  MSG_APPLY,
  MSG_COUNT,
  MSG_REVEAL,
  createChromeStore,
  getBrowserApi,
  sanitizeSettings,
} from "../lib/slopshield/settings";

const STAMP = "#e23b24";

function boot() {
  const api = getBrowserApi();
  if (!api?.runtime?.onMessage) return;
  const store = createChromeStore(api);

  let timer = 0;
  const updateBadge = () => {
    const supported = isSupportedSearchUrl(location.href);
    const root = supported ? findSearchRoot(document) : null;
    const settings = store.get();
    const count = root ? hiddenCount(root) : 0;
    try {
      const text = !supported || settings.paused || count <= 0 ? "" : count > 99 ? "99" : String(count);
      void api.action?.setBadgeText({ text });
      void api.action?.setBadgeBackgroundColor({ color: STAMP });
    } catch {
      /* The bars on the page are the real control. */
    }
  };
  const hooks = { onChange: updateBadge };

  const run = () => {
    timer = 0;
    if (!store.ready) return;
    if (!isSupportedSearchUrl(location.href)) {
      releaseAll(document.body);
      updateBadge();
      return;
    }
    const root = findSearchRoot(document);
    if (!root) {
      updateBadge();
      return;
    }
    reconcile(root, store.get(), hooks);
    updateBadge();
  };

  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(run, 50);
  };

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as { type?: string; settings?: unknown };
    if (!isSupportedSearchUrl(location.href)) {
      sendResponse({ ok: false, hidden: 0 });
      return;
    }
    const root = findSearchRoot(document);
    if (!root) {
      sendResponse({ ok: false, hidden: 0 });
      return;
    }
    if (msg.type === MSG_REVEAL) {
      revealAll(root, hooks);
      sendResponse({ ok: true, hidden: hiddenCount(root) });
      return;
    }
    if (msg.type === MSG_APPLY) {
      reconcile(root, msg.settings ? sanitizeSettings(msg.settings) : store.get(), hooks);
      updateBadge();
      sendResponse({ ok: true, hidden: hiddenCount(root) });
      return;
    }
    if (msg.type === MSG_COUNT) {
      sendResponse({ ok: true, hidden: hiddenCount(root) });
    }
  });

  store.subscribe(() => schedule());

  const observer = new MutationObserver((mutations) => {
    const engine = detectEngine(location.href);
    const root = engine && isSupportedSearchUrl(location.href) ? findSearchRoot(document) : null;
    if (!root) {
      const appeared =
        engine &&
        mutations.some((mutation) =>
          [...mutation.addedNodes].some(
            (node) => node instanceof Element && rootsAppeared(node, engine),
          ),
        );
      if (appeared || !isSupportedSearchUrl(location.href)) schedule();
      return;
    }
    const inside = mutations.filter((mutation) => mutation.target instanceof Node && root.contains(mutation.target));
    if (inside.length === 0 || isShieldNoise(inside)) return;
    schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

boot();
