import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(webDir, "..");

const winVenvPython = path.join(rootDir, "engine", "venv", "Scripts", "python.exe");
const unixVenvPython = path.join(rootDir, "engine", "venv", "bin", "python");
const pythonBin = fs.existsSync(winVenvPython)
  ? winVenvPython
  : fs.existsSync(unixVenvPython)
    ? unixVenvPython
    : "python";

console.log("[SignalDesk] Starting FastAPI Engine (port 8000) + Next.js Turbopack Web (port 3000)...");
console.log(`[SignalDesk] Using Python executable: ${pythonBin}`);

const isWin = process.platform === "win32";

const engineProc = spawn(
  `"${pythonBin}"`,
  ["-m", "uvicorn", "engine.api.main:app", "--host", "0.0.0.0", "--port", "8000"],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env, PYTHONPATH: rootDir },
  }
);

engineProc.on("error", (err) => console.error("[Engine Error]:", err));
engineProc.on("exit", (code) => console.log(`[Engine exited with code ${code}]`));

const nextBin = path.join(webDir, "node_modules", "next", "dist", "bin", "next");
const webProc = spawn(
  `"${process.execPath}"`,
  [`"${nextBin}"`, "dev", "-p", "3000"],
  {
    cwd: webDir,
    stdio: "inherit",
    shell: isWin,
  }
);

webProc.on("error", (err) => console.error("[Web Error]:", err));
webProc.on("exit", (code) => console.log(`[Web exited with code ${code}]`));

function shutdown() {
  console.log("\n[SignalDesk] Shutting down Engine and Web processes...");
  try {
    engineProc.kill();
  } catch {}
  try {
    webProc.kill();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
