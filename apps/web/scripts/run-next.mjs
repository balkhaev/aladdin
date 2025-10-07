import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const searchRoots = [
  process.cwd(),
  resolve(process.cwd(), ".."),
  resolve(process.cwd(), "../.."),
];

let nextBinPath;
for (const base of searchRoots) {
  try {
    nextBinPath = require.resolve("next/dist/bin/next", { paths: [base] });
    break;
  } catch {
    // Try next location
  }
}

if (!nextBinPath) {
  console.error(
    "Unable to resolve Next.js CLI. Ensure dependencies are installed.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(process.execPath, [nextBinPath, ...args], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
