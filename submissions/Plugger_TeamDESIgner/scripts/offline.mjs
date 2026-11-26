import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist", { recursive: true, withFileTypes: true }))
  .filter((x) => x.isFile() && !["_redirects", "sw.js"].includes(x.name))
  .map((x) =>
    (x.parentPath + "/" + x.name).replaceAll("\\", "/").split("dist/").pop(),
  )
  .sort();
const hash = createHash("sha256");
for (const path of assets) hash.update(await readFile("dist/" + path));
const key = "plugged-" + hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const cacheName=${JSON.stringify(key)};
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(${JSON.stringify(assets.map((x) => "/" + x))})).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('plugged-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.open(cacheName).then(async c=>(await c.match(e.request.mode==='navigate'?'/index.html':e.request,{ignoreVary:true}))||fetch(e.request)))});
`,
);
