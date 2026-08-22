import sharp from "sharp";

const [input, output, seedMode] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: input output");

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const key = (r, g, b) => `${Math.round(r / 4)},${Math.round(g / 4)},${Math.round(b / 4)}`;
const borderCounts = new Map();
const sample = (x, y) => {
  const i = (y * width + x) * channels;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 8 && Math.min(r, g, b) > 225) {
    const k = key(r, g, b);
    borderCounts.set(k, (borderCounts.get(k) || 0) + 1);
  }
};
for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
for (let y = 0; y < height; y++) { sample(0, y); sample(width - 1, y); }
const colors = [...borderCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([value]) => value.split(",").map((part) => Number(part) * 4));

const matches = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const neutralBright = Math.max(r, g, b) - Math.min(r, g, b) < 16 && Math.min(r, g, b) > 210;
  const sampled = colors.some(([sr, sg, sb]) =>
    Math.abs(r - sr) <= 14 && Math.abs(g - sg) <= 14 && Math.abs(b - sb) <= 14,
  );
  return neutralBright || sampled;
};
const seen = new Uint8Array(width * height);
const queue = new Uint32Array(width * height);
let head = 0, tail = 0;
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (seen[p] || !matches(p * channels)) return;
  seen[p] = 1;
  queue[tail++] = p;
};
for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
if (seedMode === "center") {
  for (let y = Math.floor(height * .35); y < Math.floor(height * .68); y += 12)
    for (let x = Math.floor(width * .32); x < Math.floor(width * .68); x += 12)
      push(x, y);
}
while (head < tail) {
  const p = queue[head++];
  const x = p % width, y = Math.floor(p / width);
  push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
}
for (let p = 0; p < seen.length; p++) if (seen[p]) data[p * channels + 3] = 0;
await sharp(data, { raw: { width, height, channels } }).png().toFile(output);
