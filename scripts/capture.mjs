// Headless Chrome + SwiftShader screenshots: node scripts/capture.mjs <name> <url> <width> <height>
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const [name, url, w = "1440", h = "900"] = process.argv.slice(2);
execFileSync("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--no-first-run", `--user-data-dir=${join(tmpdir(), "covered-shot")}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars",
  `--window-size=${w},${h}`, "--virtual-time-budget=12000", `--screenshot=${resolve("shots", name + ".png")}`, url,
], { stdio: "ignore" });
console.log("shots/" + name + ".png");
