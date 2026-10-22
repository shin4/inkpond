// Builds the library into dist/: compiled modules and declarations, the
// stylesheet, and the font subsets with their licence. Plain Node with no
// shell commands, so it also runs as `prepare` when the package is installed
// straight from GitHub, on any platform.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (path) => join(root, path);
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

rmSync(at("dist"), { force: true, recursive: true });
execFileSync(process.execPath, [tsc, "-p", at("tsconfig.build.json")], {
  stdio: "inherit",
});
cpSync(at("src/inkpond.css"), at("dist/inkpond.css"));
mkdirSync(at("dist/assets"), { recursive: true });
cpSync(at("src/assets"), at("dist/assets"), { recursive: true });
