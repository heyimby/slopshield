# SlopShield

Chrome and Firefox extension that hides recognized AI answer panels, and domains you choose, on web search results. Restore anything, or pause. Settings stay in the browser.

Version 0.2.0 covers web results on Google (including the usual country sites), Bing, DuckDuckGo, Yahoo, Brave, Ecosia, Startpage, Yandex, Baidu, AOL, Qwant, Kagi, You.com, and Mojeek.

It does not detect AI-written articles. Maps, images, news, shopping, and layouts it does not recognize stay visible. Startpage and Mojeek have no AI panel of their own, so only domain rules apply there.

## Develop

Node 22 or newer.

```bash
npm install
npm test
npm run build
```

`npm run build` writes an unpacked extension to `dist/` and a zip to `dist/slopshield.zip`.

### Chrome

1. Unzip, or use the `dist` folder directly.
2. Open `chrome://extensions`.
3. Turn on Developer mode.
4. Load unpacked and choose the folder that contains `manifest.json`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Load Temporary Add-on.
3. Choose `manifest.json`. Temporary add-ons unload when Firefox restarts.

## Layout

- `src/lib/slopshield/` is the shared filter: domain rules, per-engine recognition, and the popup.
- `src/extension/` is the Manifest V3 content script and popup entry.
- `src/extension/static/manifest.json` is the permission list. It is checked against the engine list by the tests.

Search-page markup changes. When an engine updates its AI panel, edit that engine in `src/lib/slopshield/engines.ts` and keep the fail-open rule: if the structure is unfamiliar, leave it on the page.
