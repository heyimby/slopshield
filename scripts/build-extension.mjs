import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";
import { build } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(root, ".extension-build");
const unpacked = join(root, "dist");
const zipPath = join(root, "dist/slopshield.zip");

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, "ascii");
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0);
  return Buffer.concat([length, name, data, sum]);
}

function inRoundRect(x, y, left, top, right, bottom, radius) {
  if (x < left || y < top || x >= right || y >= bottom) return false;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function paintIcon(x, y, size) {
  const px = x + 0.5;
  const py = y + 0.5;
  const margin = size * 0.06;
  if (!inRoundRect(px, py, margin, margin, size - margin, size - margin, size * 0.22)) return [0, 0, 0, 0];
  const slot = inRoundRect(px, py, size * 0.22, size * 0.42, size * 0.78, size * 0.58, Math.max(1, size * 0.08));
  if (slot) return [244, 241, 234, 255];
  return [226, 59, 36, 255];
}

function png(size) {
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paintIcon(x, y, size);
      const offset = row + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function bundle(name) {
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    build: {
      outDir: join(staging, name),
      emptyOutDir: true,
      copyPublicDir: false,
      sourcemap: false,
      minify: true,
      target: "es2022",
      rollupOptions: {
        input: join(root, `src/extension/${name}.ts`),
        output: {
          format: "iife",
          inlineDynamicImports: true,
          entryFileNames: `${name}.js`,
          name: `SlopShield${name}`,
        },
      },
    },
  });
}

await rm(staging, { recursive: true, force: true });
await rm(unpacked, { recursive: true, force: true });
await bundle("content");
await bundle("popup");
await mkdir(join(unpacked, "icons"), { recursive: true });

await cp(join(staging, "content/content.js"), join(unpacked, "content.js"));
await cp(join(staging, "popup/popup.js"), join(unpacked, "popup.js"));
await cp(join(root, "src/lib/slopshield/popup.css"), join(unpacked, "popup.css"));
await cp(join(root, "src/lib/slopshield/content.css"), join(unpacked, "content.css"));
await cp(join(root, "src/extension/static/popup.html"), join(unpacked, "popup.html"));
await cp(join(root, "src/extension/static/manifest.json"), join(unpacked, "manifest.json"));
await cp(join(root, "src/extension/static/INSTALL.txt"), join(unpacked, "INSTALL.txt"));
await cp(join(root, "src/extension/static/PRIVACY.txt"), join(unpacked, "PRIVACY.txt"));

for (const size of [16, 32, 48, 128]) {
  await writeFile(join(unpacked, "icons", `icon-${size}.png`), png(size));
}

const content = await readFile(join(unpacked, "content.js"), "utf8");
if (/\bimport\s|\bexport\s/.test(content)) {
  throw new Error("content.js still has import/export; the extension bundle must be self-contained");
}

const zipped = spawnSync(
  "python3",
  [
    "-c",
    `
import os, sys, zipfile
src, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for dirpath, _, files in os.walk(src):
        for name in files:
            full = os.path.join(dirpath, name)
            if name == "slopshield.zip":
                continue
            rel = os.path.relpath(full, src)
            archive.write(full, os.path.join("slopshield", rel))
`,
    unpacked,
    zipPath,
  ],
  { stdio: "inherit" },
);
if (zipped.status !== 0) process.exit(zipped.status ?? 1);
await rm(staging, { recursive: true, force: true });
console.log("wrote", zipPath);
