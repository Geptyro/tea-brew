// @deps mongodb
const { execSync } = require("child_process");
const { existsSync } = require("fs");

// --- Auto-install missing deps ---
const src = require("fs").readFileSync(__filename, "utf8");
const depsMatch = src.match(/^\/\/ @deps (.+)/m);
const BUILTINS = new Set(["fs", "path", "os", "http", "https", "child_process", "crypto", "url", "util", "events", "stream", "buffer"]);
if (depsMatch) {
  const missing = depsMatch[1].split(",").map(d => d.trim())
    .filter(d => !BUILTINS.has(d) && !existsSync(`/app/node_modules/${d}`));
  if (missing.length) {
    console.log(`Installing: ${missing.join(", ")}...`);
    execSync(`npm install ${missing.join(" ")}`, { cwd: "/app", stdio: "inherit" });
  }
}

const https = require("https");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

// --- Load .env ---
const envPath = path.join(__dirname, "data", ".env");
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  const val = rest.join("=");
  if (key && val) process.env[key.trim()] = val.trim();
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL;
const MONGO_URI = process.env.MONGO_URI || "mongodb://host.docker.internal:27017";
const POLL_MS = 5 * 60 * 1000;

// --- Email ---
function sendEmail(subject, message) {
  const body = JSON.stringify({ from: "onboarding@resend.dev", to: TO_EMAIL, subject, text: message });
  const req = https.request({
    hostname: "api.resend.com", path: "/emails", method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Authorization: `Bearer ${RESEND_API_KEY}` },
  }, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => console.log(`Email "${subject}" — status: ${res.statusCode}`));
  });
  req.on("error", e => console.error("Email error:", e.message));
  req.write(body);
  req.end();
}

// --- MongoDB ---
async function withDb(fn) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    return await fn(client.db("jardin").collection("batches"));
  } finally {
    await client.close();
  }
}

async function markNotified(batchId, key) {
  await withDb(col => col.updateOne({ batch_id: batchId }, { $addToSet: { notified: key } }));
}

async function markDone(batchId) {
  await withDb(col => col.updateOne({ batch_id: batchId }, { $set: { date_end: new Date() } }));
}

// --- Format ---
function fmtIngredients(ingredients) {
  return (ingredients || [])
    .map(i => `${i.name}${i.quantity_g ? ` ${i.quantity_g}g` : ""}${i.quantity_u ? ` ${i.quantity_u}u` : ""}`)
    .join(", ");
}

// --- Check if an event time is "due" (past but within last poll window) ---
function isDue(eventTime) {
  const now = Date.now();
  return eventTime <= now && eventTime > now - POLL_MS;
}

// --- Main check ---
async function check() {
  console.log(`[${new Date().toLocaleTimeString()}] checking...`);

  let batches;
  try {
    batches = await withDb(col => col.find({ date_end: null }).toArray());
  } catch (e) {
    console.error("MongoDB error:", e.message);
    return;
  }

  for (const batch of batches) {
    const notified = new Set(batch.notified || []);
    const steps = batch.steps || [{ offset_hours: 0, ingredients: batch.ingredients || [] }];
    const totalHours = batch.total_steep_hours ?? batch.planned_steep_hours ?? 0;

    const isStarted = !!steps[0]?.confirmed_at;
    const startMs = isStarted ? new Date(steps[0].confirmed_at).getTime() : null;

    // Planned: "time to start" notification
    if (!isStarted && batch.date_start) {
      const key = "start";
      if (!notified.has(key) && isDue(new Date(batch.date_start).getTime())) {
        const firstIngredients = steps.length ? fmtIngredients(steps[0].ingredients) : "";
        sendEmail(
          `Time to start cold brew #${batch.batch_id}`,
          `Start batch #${batch.batch_id} now!\n\nAdd to fridge: ${firstIngredients}\nVessel: ${batch.vessel_ml}ml\nSteep: ${totalHours}h`
        );
        await markNotified(batch.batch_id, key);
      }
    }

    // Steeping: step notifications
    if (isStarted && startMs) {
      for (const step of steps) {
        if (step.offset_hours === 0) continue;
        const key = `step:${step.offset_hours}`;
        if (!notified.has(key) && isDue(startMs + step.offset_hours * 3600000)) {
          sendEmail(
            `Cold brew #${batch.batch_id} — add ingredients`,
            `Time to add to batch #${batch.batch_id}:\n\n${fmtIngredients(step.ingredients)}`
          );
          await markNotified(batch.batch_id, key);
        }
      }

      // Ready notification
      const key = "ready";
      if (!notified.has(key) && isDue(startMs + totalHours * 3600000)) {
        const allIngredients = steps.flatMap(s => s.ingredients);
        sendEmail(
          `Cold brew #${batch.batch_id} ready!`,
          `Time to extract batch #${batch.batch_id}!\n\nVessel: ${batch.vessel_ml}ml\nIngredients: ${fmtIngredients(allIngredients)}`
        );
        await markNotified(batch.batch_id, key);
        await markDone(batch.batch_id);
        console.log(`Batch #${batch.batch_id}: marked as done`);
      }
    }
  }
}

// --- Loop ---
async function loop() {
  await check();
  setTimeout(loop, POLL_MS);
}

loop();
console.log(`Notifier running — checking every ${POLL_MS / 60000} min`);
