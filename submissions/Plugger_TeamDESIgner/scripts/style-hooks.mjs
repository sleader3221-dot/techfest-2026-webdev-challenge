import { readdir, readFile, writeFile } from "node:fs/promises";

const hooks = new Map();
for (const file of await readdir("src", { recursive: true })) {
  if (!file.endsWith(".tsx")) continue;
  const source = await readFile("src/" + file, "utf8");
  for (const match of source.matchAll(
    /data-(component|slot|state|variant|tone)\s*=\s*(?:"([^"]+)"|\{([^}]+)\})/g,
  )) {
    const values = match[2]
      ? [match[2]]
      : [...match[3].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    for (const value of values) {
      const key = "data-" + match[1] + '="' + value + '"';
      if (!hooks.has(key)) hooks.set(key, new Set());
      hooks.get(key).add(file.replaceAll("\\", "/"));
    }
  }
}
let output =
  "# Style hooks\n\nGenerated from the JSX in `src/`. Run `node scripts/style-hooks.mjs` after changing component attributes. Theme colors and typography are defined in `src/tokens.css`.\n\n| Selector | Source |\n| --- | --- |\n";
for (const [key, files] of [...hooks].sort(([a], [b]) => a.localeCompare(b)))
  output +=
    "| `[" +
    key +
    "]` | " +
    [...files]
      .sort()
      .map((f) => "`src/" + f + "`")
      .join(", ") +
    " |\n";
await writeFile("STYLE_HOOKS.md", output);
