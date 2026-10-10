import { renderPopup } from "../lib/slopshield/popup-view";
import { createChromeStore, getBrowserApi } from "../lib/slopshield/settings";

const api = getBrowserApi();
const mount = document.querySelector("#app");
if (api && mount instanceof HTMLElement) {
  renderPopup(mount, { mode: "extension", store: createChromeStore(api), api });
}
