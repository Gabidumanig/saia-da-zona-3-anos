const fs = require("fs");
const { PNG } = require("pngjs");

function isBg(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (max >= 205 && sat <= 0.14) return true;
  if (sat <= 0.1 && min >= 160 && max <= 235) return true;
  if (sat <= 0.08 && min >= 180 && max <= 250) return true;
  return false;
}

function processFile(src, dest) {
  const png = PNG.sync.read(fs.readFileSync(src));
  const { width: w, height: h, data } = png;
  const seen = new Uint8Array(w * h);
  const q = [];

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!isBg(data[i], data[i + 1], data[i + 2])) return;
    seen[idx] = 1;
    q.push(idx);
  }

  for (let x = 0; x < w; x += 1) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (q.length) {
    const idx = q.pop();
    const i = idx * 4;
    const x = idx % w;
    const y = (idx - x) / w;
    data[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 238 && g > 238 && b > 238) data[i + 3] = 0;
    else if (r > 220 && g > 220 && b > 220) {
      const edge = (Math.min(r, g, b) - 220) / 35;
      data[i + 3] = Math.max(0, Math.min(255, Math.round(255 * (1 - edge))));
    }
  }

  const out = new PNG({ width: w, height: h, colorType: 6 });
  data.copy(out.data);
  fs.writeFileSync(dest, PNG.sync.write(out));
  let a0 = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) a0 += 1;
  console.log("wrote", dest, `${w}x${h}`, "transparent", a0);
}

const src = process.argv[2];
const dest = process.argv[3] || src;
processFile(src, dest);
