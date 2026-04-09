// Watches notify.js and rebuilds/restarts the Docker container on change
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "notify.js");
let lastMtime = fs.statSync(FILE).mtimeMs;
let rebuilding = false;

function rebuild() {
  if (rebuilding) return;
  rebuilding = true;
  console.log(`\n[${new Date().toLocaleTimeString()}] notify.js changed — rebuilding...`);
  try {
    execSync("docker build --no-cache -t cold-brew-notifier .", { cwd: __dirname, stdio: "inherit" });
    execSync("docker restart cold-brew-notifier", { stdio: "inherit" });
    console.log("Done. Container restarted.\n");
  } catch (e) {
    console.error("Rebuild failed:", e.message);
  }
  rebuilding = false;
}

fs.watch(FILE, () => {
  const mtime = fs.statSync(FILE).mtimeMs;
  if (mtime !== lastMtime) {
    lastMtime = mtime;
    rebuild();
  }
});

console.log("Watching notify.js — will rebuild & restart container on save.");
