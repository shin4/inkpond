// Packaging smoke test: installs inkpond the two ways a user can — the
// packed tarball, and a git install that has to build through `prepare` —
// into fresh projects, then checks each one the way a consumer would meet
// it: Node imports, a strict `nodenext` type check, and a Vite + React build
// that must bundle all three font subsets.
//
// Run with `bun run smoke:pack` (needs network for the consumer's
// dependencies). Exits non-zero on the first failure.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const own = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dev = own.devDependencies;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "inherit"],
  });
const step = (name) => console.log(`\n▸ ${name}`);

const work = mkdtempSync(join(tmpdir(), "inkpond-smoke-"));
try {
  step("pack");
  const tarball = join(
    work,
    run(npm, ["pack", "--silent", "--pack-destination", work], root).trim(),
  );
  const git = `git+${pathToFileURL(root).href}#HEAD`;

  for (const [label, spec] of [
    ["tarball", tarball],
    ["git (builds through prepare)", git],
  ]) {
    const app = join(work, label.split(" ")[0]);
    mkdirSync(join(app, "src"), { recursive: true });
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({ name: "smoke", private: true, type: "module" }),
    );
    step(`install from ${label}`);
    run(
      npm,
      [
        "install",
        "--no-audit",
        "--no-fund",
        spec,
        `react@${dev.react}`,
        `react-dom@${dev["react-dom"]}`,
        `vite@${dev.vite}`,
        `@vitejs/plugin-react@${dev["@vitejs/plugin-react"]}`,
        `typescript@${dev.typescript}`,
        `@types/react@${dev["@types/react"]}`,
        `@types/react-dom@${dev["@types/react-dom"]}`,
      ],
      app,
    );
    const dist = readdirSync(join(app, "node_modules/inkpond/dist"));
    for (const file of ["index.js", "react.js", "inkpond.css", "assets"]) {
      if (!dist.includes(file)) throw new Error(`dist/ is missing ${file}`);
    }
    const react = readFileSync(
      join(app, "node_modules/inkpond/dist/react.js"),
      "utf8",
    );
    if (!/^(\/\/.*\n)*"use client";/.test(react)) {
      throw new Error('dist/react.js must start with "use client"');
    }

    step("Node imports");
    run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import("inkpond");
         if (m.SCENES.join() !== "shanshui,lotus,qingming,jieqi,beiming,dafeijing") throw new Error("SCENES");
         if (m.jieqiAt(new Date("2026-10-27T12:00:00+08:00")) !== "shuangjiang") throw new Error("jieqiAt");
         const r = await import("inkpond/react");
         if (typeof r.InkPond !== "function") throw new Error("InkPond");`,
      ],
      app,
    );

    step("nodenext type check");
    writeFileSync(
      join(app, "src/main.tsx"),
      `import { useRef } from "react";
import { createRoot } from "react-dom/client";
import { createInkPond, type InkPond as Pond } from "inkpond";
import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

const App = () => {
  const pondRef = useRef<Pond | null>(null);
  return (
    <main style={{ position: "relative", height: "100vh" }}>
      <InkPond active pondRef={pondRef} scene="qingming" />
      <form data-inkpond-avoid="" />
    </main>
  );
};
createRoot(document.getElementById("root")!).render(<App />);
const canvas = document.createElement("canvas");
createInkPond(canvas, { scene: "lotus", tint: false }).destroy();
`,
    );
    writeFileSync(
      join(app, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          lib: ["ES2022", "DOM"],
          module: "nodenext",
          moduleResolution: "nodenext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          types: ["vite/client"],
        },
        include: ["src"],
      }),
    );
    run(
      process.execPath,
      [join(app, "node_modules/typescript/bin/tsc"), "-p", app],
      app,
    );

    step("Vite build");
    writeFileSync(
      join(app, "index.html"),
      '<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>',
    );
    writeFileSync(
      join(app, "vite.config.js"),
      'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n',
    );
    run(
      process.execPath,
      [join(app, "node_modules/vite/bin/vite.js"), "build"],
      app,
    );
    const fonts = readdirSync(join(app, "dist/assets")).filter((f) =>
      f.endsWith(".woff2"),
    );
    if (fonts.length !== 6) {
      throw new Error(
        `expected 6 font subsets in the build, got ${fonts.length}`,
      );
    }
    console.log(`  ok: ${label}`);
  }
  console.log("\npackaging smoke test passed");
} finally {
  rmSync(work, { force: true, recursive: true });
}
