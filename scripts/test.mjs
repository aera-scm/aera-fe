// Run real tests as soon as they exist; never hide a runner's no-tests exit status.
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0");

if (!files.some((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))) {
  console.log("No frontend application tests exist yet; no test coverage is claimed.");
} else {
  const runner = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [runner, "run"], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
