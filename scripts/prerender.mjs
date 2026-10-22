// Runs after `vite build`: writes each page's rendered markup and head into
// dist-demo, so crawlers and AI assistants that do not run JavaScript still
// read the content. The browser then hydrates the same markup.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-demo");
const PAGES = { faq: "faq/index.html", index: "index.html" };

const vite = await createServer({
  appType: "custom",
  configFile: join(root, "vite.config.ts"),
  logLevel: "error",
  server: { hmr: false, middlewareMode: true },
});
try {
  const { render } = await vite.ssrLoadModule("/prerender.tsx");
  for (const [page, file] of Object.entries(PAGES)) {
    const path = join(out, file);
    const source = readFileSync(path, "utf8");
    for (const mark of ["<!--head-->", '<div id="root"></div>']) {
      if (!source.includes(mark)) throw new Error(`${file}: no ${mark}`);
    }
    const { head, html } = render(page);
    writeFileSync(
      path,
      source
        .replace("<!--head-->", head)
        .replace('<div id="root"></div>', `<div id="root">${html}</div>`),
    );
  }
} finally {
  await vite.close();
}
copyFileSync(
  join(root, "docs/images/social-preview.jpg"),
  join(out, "social-preview.jpg"),
);
console.log("prerendered:", Object.values(PAGES).join(", "));
