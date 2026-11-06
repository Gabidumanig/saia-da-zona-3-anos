import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ALBUMS = [
  ["Camera Vale do Pati 2026 T2", "https://photos.app.goo.gl/fFCnGbNJGS1RJwBGA"],
  ["Camera Vale do Pati 2026 T1", "https://photos.app.goo.gl/Mdp5jFjFEQyvzJVs5"],
  ["Camera Monte Roraima", "https://photos.app.goo.gl/eDjqYmU63nn5QGEb9"],
  ["Camera Vale do Pati Galapagos", "https://photos.app.goo.gl/LDuXa3RVnyi5YLdz6"],
  ["Camera Lencois Maranhenses 2026 T1", "https://photos.app.goo.gl/Fce3Zg3Gj1UagJKT9"],
  ["Drone Chapada Diamantina 2025", "https://photos.app.goo.gl/iWWpXSPRLQWXJbKd9"],
  ["Drone Vale do Pati Galapagos", "https://photos.app.goo.gl/zdwa56fizVwk55hWA"],
  ["Drone Lencois Maranhenses 2025", "https://photos.app.goo.gl/Njwii2XiPKBMZw9N7"],
  ["Drone Vale do Pati 2026 T1", "https://photos.app.goo.gl/uBfq63wjN9tzH2mp8"],
  ["Drone Vale do Pati 2026 T2", "https://photos.app.goo.gl/yuo85saFsohPhNrK6"],
  ["Drone Lencois Maranhenses T2", "https://photos.app.goo.gl/yZ83udzeUSMuibNo6"],
  ["Drone Lencois Maranhenses T1", "https://photos.app.goo.gl/NWXDpwXAp2wkqddM7"],
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  const html = await res.text();
  return { final: res.url, html, status: res.status };
}

function extractUrls(html) {
  const found = html.match(/https:\/\/lh3\.googleusercontent\.com\/[-=\w/_.]+/g) || [];
  const cleaned = [];
  const seen = new Set();
  for (const u of found) {
    let base = u.replace(/=w\d+.*$/, "").replace(/=s\d+.*$/, "");
    if (seen.has(base)) continue;
    seen.add(base);
    cleaned.push(`${base}=w1920-h1080`);
  }
  return cleaned;
}

const albums = {};
const photos = [];

for (const [name, url] of ALBUMS) {
  try {
    const { final, html, status } = await fetchHtml(url);
    const urls = extractUrls(html);
    console.error(`${name}: status=${status} urls=${urls.length} final=${final.slice(0, 90)}`);
    const pick = urls.slice(0, 8);
    albums[name] = pick;
    for (const src of pick) photos.push({ album: name, src, albumUrl: url });
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message}`);
    albums[name] = [];
  }
}

const outPath = path.join(root, "js", "slideshow-photos.js");
const payload = { albums, photos };
fs.writeFileSync(
  outPath,
  `window.SDZ_SLIDESHOW_PHOTOS = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8"
);
console.error(`wrote ${outPath} with ${photos.length} photos`);
process.exit(photos.length ? 0 : 1);
