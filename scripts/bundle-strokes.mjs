/**
 * Copia in `public/hanzi-data/` solo i tratti dei caratteri presenti nel
 * curriculum. HanziWriter li legge in locale: niente CDN, e il build non
 * si porta dietro gli oltre 9.000 caratteri del pacchetto completo.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const curriculumPath = path.join(root, "src/data/generated-curriculum.json");
const destDir = path.join(root, "public/hanzi-data");

function resolveSourceDir() {
  const candidates = [
    path.join(root, "node_modules/hanzi-writer-data"),
    path.join(root, "node_modules/hanzi-writer-data/data"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "人.json"))) return dir;
  }
  throw new Error(
    "hanzi-writer-data non trovato. Esegui `npm install` prima di bundle-strokes.",
  );
}

const sourceDir = resolveSourceDir();
const raw = readFileSync(curriculumPath, "utf8");
const characters = new Set();

for (const char of raw) {
  if (/\p{Script=Han}/u.test(char)) characters.add(char);
}

mkdirSync(destDir, { recursive: true });

const copied = [];
const missing = [];

for (const char of [...characters].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))) {
  const filename = `${char}.json`;
  const source = path.join(sourceDir, filename);
  if (!existsSync(source)) {
    missing.push(char);
    continue;
  }
  copyFileSync(source, path.join(destDir, filename));
  copied.push(char);
}

const keep = new Set(copied.map((char) => `${char}.json`));
keep.add("index.json");

for (const file of readdirSync(destDir)) {
  if (!file.endsWith(".json") || keep.has(file)) continue;
  rmSync(path.join(destDir, file));
}

writeFileSync(
  path.join(destDir, "index.json"),
  `${JSON.stringify({ characters: copied })}\n`,
);

const sample = missing.slice(0, 12).join(" ");
console.log(
  `Tratti offline: ${copied.length} caratteri in public/hanzi-data` +
    ` (${missing.length} senza dati${sample ? `: ${sample}` : ""}).`,
);
