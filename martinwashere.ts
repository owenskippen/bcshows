import { spawn } from "bun";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const MAX_SPAWNS = 999999999999999999n;

const countArg = process.argv[2];
const remaining = countArg === undefined ? MAX_SPAWNS : BigInt(countArg);

console.log("martin was here");

if (remaining > 0n) {
  const nextRemaining = remaining - 1n;

  spawn({
    cmd: ["bun", __filename, nextRemaining.toString()],
    stdout: "inherit",
    stderr: "inherit",
  });
}