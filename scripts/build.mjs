// Builds the library into dist/: compiled modules and declarations, the
// stylesheet, and the font subsets with their licence. Plain Node with no
// shell commands, so it also runs as `prepare` when the package is installed
// straight from GitHub, on any platform.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (path) => join(root, path);
/**
 * Installed as someone's dependency (bun builds it in place, under
 * node_modules), the compiler sees their environment — say, no React types
 * in a project that does not use React — rather than ours.
 */
const asDependency = root.includes(`${sep}node_modules${sep}`);

rmSync(at("dist"), { force: true, recursive: true });
// The stylesheet and fonts first, so they are there whatever tsc says.
mkdirSync(at("dist/assets"), { recursive: true });
cpSync(at("src/inkpond.css"), at("dist/inkpond.css"));
cpSync(at("src/assets"), at("dist/assets"), { recursive: true });

let tsc;
try {
  tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
} catch {
  // npm installs our devDependencies before `prepare`; bun does not.
  console.error(
    "inkpond: building needs TypeScript. Add it to your project " +
      "(bun add -d typescript) and install again.",
  );
  process.exit(1);
}
try {
  execFileSync(process.execPath, [tsc, "-p", at("tsconfig.build.json")], {
    stdio: "inherit",
  });
} catch (error) {
  // tsc still emits on type errors; only our own build must be clean.
  if (!asDependency) throw error;
  console.warn("inkpond: type errors from this environment; output emitted.");
}
