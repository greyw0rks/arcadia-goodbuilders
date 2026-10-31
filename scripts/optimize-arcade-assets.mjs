import { createRequire } from "node:module";
import { readdir, stat, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const fromNext = createRequire(require.resolve("next/package.json"));
const sharp = fromNext("sharp");
const assets = [];
for (const file of (await readdir("public/world")).filter(file => file.endsWith(".png"))) {
  const output = `public/world/${file.replace(/\.png$/, ".webp")}`;
  await sharp(`public/world/${file}`).webp({ quality: 84, alphaQuality: 95, effort: 5 }).toFile(output);
  assets.push({ file: output, bytes: (await stat(output)).size, source: "Original Blender geometry rendered with scripts/build-arcade-world.py; no external textures or models." });
}
for (const file of (await readdir("public/models")).filter(file => file.endsWith(".glb"))) assets.push({ file: `public/models/${file}`, bytes: (await stat(`public/models/${file}`)).size, source: "Original Blender geometry, Draco compressed." });
await writeFile("docs/evidence/arcade-assets.json", JSON.stringify({ generatedAt: new Date().toISOString(), generator: "scripts/build-arcade-world.py", blender: "4.5.3", assets }, null, 2) + "\n");
console.log(JSON.stringify(assets, null, 2));
