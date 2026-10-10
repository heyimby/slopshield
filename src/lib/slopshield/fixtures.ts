import { A } from "./attrs";
import { engineById, type EngineId, type EngineProfile, type TitleMode } from "./engines";

export type ScenarioId = "door" | "chili" | "tube";

export type Scenario = {
  id: ScenarioId;
  label: string;
  query: string;
  path: string;
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "door",
    label: "Squeaky door",
    query: "how to stop a door from squeaking",
    path: "/search?q=how+to+stop+a+door+from+squeaking",
  },
  {
    id: "chili",
    label: "Weeknight chili",
    query: "weeknight chili recipe",
    path: "/search?q=weeknight+chili+recipe",
  },
  {
    id: "tube",
    label: "Patch a bike tube",
    query: "patch a bike tube",
    path: "/search?q=patch+a+bike+tube",
  },
];

type Result = { url: string; title: string; cite: string; snippet: string };
type Source = { href: string; name: string };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function titleLink(item: Result, mode: TitleMode, titleClass?: string): HTMLElement {
  const link = el("a", ["serp-title", titleClass].filter(Boolean).join(" "));
  link.href = item.url;
  if (mode === "anchor-title") {
    link.append(el("div", "title", item.title));
    return link;
  }
  const headingTag = mode === "anchor-h2" || mode === "h2-anchor" ? "h2" : "h3";
  if (mode === "anchor-h3" || mode === "anchor-h2") {
    link.append(el(headingTag, undefined, item.title));
    return link;
  }
  link.textContent = item.title;
  const wrap = el(headingTag);
  wrap.append(link);
  return wrap;
}

function renderCard(engine: EngineProfile, item: Result): HTMLElement {
  const spec = engine.card;
  const article = el(spec.tag, spec.className);
  for (const [key, value] of Object.entries(spec.attrs ?? {})) article.setAttribute(key, value);
  if (spec.useMu) {
    article.setAttribute("mu", item.url);
    const link = el("a", ["serp-title", spec.titleClass].filter(Boolean).join(" "));
    link.href = "https://www.baidu.com/link?url=opaque";
    link.append(el("h3", undefined, item.title));
    article.append(link);
  } else {
    const title = titleLink(item, spec.title, spec.titleClass);
    if (spec.title === "h2-anchor" || spec.title === "h3-anchor") {
      const heading = title;
      const link = heading.querySelector("a");
      if (link) link.href = item.url;
      article.append(heading);
    } else {
      article.append(title);
    }
  }
  const host = new URL(item.url).hostname;
  const cite = el("p", "serp-cite");
  const glyph = el("span", "serp-glyph", host.replace(/^www\./, "").slice(0, 1).toUpperCase());
  cite.append(glyph, document.createTextNode(item.cite));
  article.append(cite, el("p", "serp-snip", item.snippet));
  return article;
}

function aiPanel(engine: EngineProfile, paragraph: string, sources: Source[]): HTMLElement {
  const spec = engine.panel;
  const section = el("section", ["serp-ai", spec?.className].filter(Boolean).join(" "));
  if (spec) {
    for (const [key, value] of Object.entries(spec.attrs ?? {})) section.setAttribute(key, value);
    const kicker = el("p", "serp-ai-kicker");
    kicker.append(el("span", undefined, spec.label));
    section.append(kicker);
  }
  const chips = el("div", "serp-chips");
  for (const source of sources) {
    const chip = el("a", "serp-chip", source.name);
    chip.href = source.href;
    chips.append(chip);
  }
  section.append(el("p", "serp-ai-body", paragraph), chips);
  return section;
}

function paa(questions: string[]): HTMLElement {
  const box = el("section", "serp-paa");
  box.append(el("h2", "serp-kicker", "People also ask"));
  for (const question of questions) box.append(el("div", "serp-paa-q", question));
  return box;
}

function unknownBlock(): HTMLElement {
  const block = el("section", "serp-unknown");
  block.append(
    el("h2", "serp-kicker", "Quick read"),
    el(
      "p",
      "serp-snip",
      "This note looks generated, but it has no recognized AI label. SlopShield leaves unrecognized blocks on the page.",
    ),
  );
  return block;
}

function mountResults(root: HTMLElement, engine: EngineProfile, items: Result[]) {
  if (!engine.card.list) {
    for (const item of items) root.append(renderCard(engine, item));
    return;
  }
  const list = el(engine.card.list, engine.card.listClass);
  for (const item of items) list.append(renderCard(engine, item));
  root.append(list);
}

const DOOR: Result[] = [
  {
    url: "https://www.familyhandyman.com/doors/squeaky-hinge/",
    title: "How to fix a squeaky door in ten minutes",
    cite: "www.familyhandyman.com › doors",
    snippet: "Lift the hinge pin, wipe off the grit, and add one drop of oil. Skip the cooking oil.",
  },
  {
    url: "https://blog.familyhandyman.com/hinge-pins/",
    title: "The hinge pin is usually the squeak",
    cite: "blog.familyhandyman.com › hinge-pins",
    snippet: "A subdomain of the same publisher. A rule for familyhandyman.com holds this too.",
  },
  {
    url: "https://www.homedepot.com/c/hinge-hardware",
    title: "Door hinge hardware",
    cite: "www.homedepot.com › hinge-hardware",
    snippet: "Replacement pins, bushings, and screws if the old ones are stripped.",
  },
  {
    url: "https://www.bobvila.com/articles/squeaky-hinges/",
    title: "Silence a hinge without making a mess",
    cite: "www.bobvila.com › articles",
    snippet: "A graphite stick works when you don't want oil near painted trim.",
  },
  {
    url: "https://www.reddit.com/r/HomeImprovement/comments/squeak/",
    title: "Door squeaks only in August — what worked",
    cite: "www.reddit.com › HomeImprovement",
    snippet: "Humidity swells the slab. Several people shimmed the top hinge instead of oiling it.",
  },
  {
    url: "https://www.pinterest.com/pin/squeaky-door-ideas/",
    title: "Squeaky door ideas",
    cite: "www.pinterest.com › pin",
    snippet: "A wall of unrelated photos. Useful as a domain you may be tired of seeing.",
  },
  {
    url: "https://notpinterest.com/door-ideas",
    title: "Not a Pinterest clone",
    cite: "notpinterest.com › door-ideas",
    snippet: "A lookalike name. Blocking pinterest.com must leave this result up.",
  },
];

const CHILI: Result[] = [
  {
    url: "https://www.seriouseats.com/weeknight-chili",
    title: "Weeknight chili that still tastes slow",
    cite: "www.seriouseats.com › weeknight-chili",
    snippet: "Brown the beef, bloom the chili powder in the fat, then simmer for forty minutes.",
  },
  {
    url: "https://blog.seriouseats.com/chili-powder",
    title: "Which chili powder actually matters",
    cite: "blog.seriouseats.com › chili-powder",
    snippet: "Ancho for body, cayenne for heat. Add them to the oil, not to a boiling pot.",
  },
  {
    url: "https://www.allrecipes.com/recipe/chili/",
    title: "Classic beef chili",
    cite: "www.allrecipes.com › recipe",
    snippet: "A crowd recipe with kidney beans, tomatoes, and a long comment thread.",
  },
  {
    url: "https://cooking.nytimes.com/recipes/chili",
    title: "Melissa Clark's turkey chili",
    cite: "cooking.nytimes.com › recipes",
    snippet: "Ground turkey, chipotle in adobo, and a spoon of brown sugar.",
  },
  {
    url: "https://www.pinterest.com/pin/chili-bowls/",
    title: "Chili bowls worth pinning",
    cite: "www.pinterest.com › pin",
    snippet: "Garnish photos. Little about heat, salt, or time.",
  },
  {
    url: "https://notpinterest.com/chili",
    title: "Chili, but not that site",
    cite: "notpinterest.com › chili",
    snippet: "Lookalike domain. It should survive a pinterest.com rule.",
  },
];

const TUBE: Result[] = [
  {
    url: "https://www.parktool.com/blog/repair/patch-a-tube",
    title: "How to patch an inner tube",
    cite: "www.parktool.com › repair",
    snippet: "Find the hole in a bucket of water, scuff wider than the patch, and wait on the cement.",
  },
  {
    url: "https://www.sheldonbrown.com/flats.html",
    title: "Sheldon Brown on flats",
    cite: "www.sheldonbrown.com › flats",
    snippet: "Most repeat flats are a sharp still stuck in the tire, not a bad patch.",
  },
  {
    url: "https://www.rei.com/learn/bike-tube",
    title: "Patch kit vs. a spare tube",
    cite: "www.rei.com › learn",
    snippet: "Carry both. A patch gets you home when the second flat happens.",
  },
];

const MORE: Record<ScenarioId, Result[]> = {
  door: [
    {
      url: "https://www.wikihow.com/Stop-a-Door-from-Squeaking",
      title: "Stop a door from squeaking",
      cite: "www.wikihow.com › Stop-a-Door",
      snippet: "A picture guide. The useful part is still the hinge pin.",
    },
    {
      url: "https://www.pinterest.com/pin/door-hardware/",
      title: "Door hardware pins",
      cite: "www.pinterest.com › pin",
      snippet: "Another pin from a domain you can hold back.",
    },
  ],
  chili: [
    {
      url: "https://food52.com/recipes/weeknight-chili",
      title: "A chili that starts with bacon",
      cite: "food52.com › recipes",
      snippet: "Render the bacon, then use that fat for the onions and spices.",
    },
    {
      url: "https://www.pinterest.com/pin/chili-night/",
      title: "Chili night",
      cite: "www.pinterest.com › pin",
      snippet: "More bowls. Same domain rule if you added one.",
    },
  ],
  tube: [
    {
      url: "https://www.pinkbike.com/news/patch-or-replace.html",
      title: "When a patch isn't worth it",
      cite: "www.pinkbike.com › news",
      snippet: "Sidewall gashes and valve-stem tears get a new tube, not a sticker.",
    },
  ],
};

const DOOR_SOURCES: Source[] = [
  { href: "https://www.familyhandyman.com/doors/squeaky-hinge/", name: "Family Handyman" },
  { href: "https://www.bobvila.com/articles/squeaky-hinges/", name: "Bob Vila" },
];

const CHILI_SOURCES: Source[] = [
  { href: "https://www.seriouseats.com/weeknight-chili", name: "Serious Eats" },
  { href: "https://cooking.nytimes.com/recipes/chili", name: "NYT Cooking" },
];

function engineOf(id: EngineId): EngineProfile {
  const engine = engineById(id);
  if (!engine) throw new Error(`Unknown engine ${id}`);
  return engine;
}

export function renderScenario(root: HTMLElement, id: ScenarioId, engineId: EngineId = "google") {
  const engine = engineOf(engineId);
  root.setAttribute(A.engine, engine.id);
  root.removeAttribute("data-slopshield-more");
  root.replaceChildren();
  if (id === "door") {
    if (engine.panel) {
      root.append(
        aiPanel(
          engine,
          "Most squeaks are a dry hinge pin. Lift the pin out, wipe it, and add a drop of household oil. Avoid cooking oil — it turns sticky. If the slab is rubbing the frame, tighten the hinge screws before you oil anything.",
          DOOR_SOURCES,
        ),
      );
    }
    root.append(
      paa([
        "Why does my door squeak only in summer?",
        "Can I use WD-40 on door hinges?",
        "How do you fix a squeaky door without oil?",
      ]),
    );
    mountResults(root, engine, DOOR);
    return;
  }
  if (id === "chili") {
    if (engine.panel) {
      root.append(
        aiPanel(
          engine,
          "Brown the meat, bloom chili powder in the fat for a minute, then add tomatoes and simmer. Salt at the end. Beans are optional and not a moral question.",
          CHILI_SOURCES,
        ),
      );
    }
    root.append(paa(["Does chili need beans?", "How spicy is ancho?", "Can I make chili in a Dutch oven?"]));
    mountResults(root, engine, CHILI);
    return;
  }
  root.append(unknownBlock());
  mountResults(root, engine, TUBE);
}

export function appendMore(root: HTMLElement, id: ScenarioId, engineId: EngineId = "google") {
  const engine = engineOf(engineId);
  const batch = MORE[id];
  if (root.hasAttribute("data-slopshield-more")) return;
  root.setAttribute("data-slopshield-more", "");
  const list =
    engine.card.list && root.querySelector(`.serp-list, ul.results`) instanceof HTMLElement
      ? root.querySelector(`.serp-list, ul.results`)
      : null;
  if (list) {
    for (const item of batch) list.append(renderCard(engine, item));
    return;
  }
  const wrap = document.createElement("div");
  for (const item of batch) wrap.append(renderCard(engine, item));
  root.append(wrap);
}

export function appendUnknown(root: HTMLElement) {
  root.append(unknownBlock());
}
