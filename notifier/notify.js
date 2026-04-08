const https = require("https");
const fs = require("fs");
const path = require("path");

// --- Load .env ---
const envPath = path.join(__dirname, "data", ".env");
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split("=");
  if (key && val) process.env[key.trim()] = val.trim();
});

// --- Config ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL;
const CSV_PATH = path.join(__dirname, "data", "cold-brew.csv");

// --- Send email via Resend ---
function sendEmail(subject, message) {
  const body = JSON.stringify({
    from: "onboarding@resend.dev",
    to: TO_EMAIL,
    subject,
    text: message,
  });

  const options = {
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
  };

  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => console.log(`Email sent — status: ${res.statusCode}`));
  });
  req.on("error", (e) => console.error("Email error:", e.message));
  req.write(body);
  req.end();
}

// --- Parse CSV ---
function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]));
  });
}

// --- Schedule notifications ---
const scheduled = new Set(); // track batch IDs already scheduled

function scheduleBatches() {
  const batches = parseCsv(CSV_PATH);

  for (const batch of batches) {
    if (scheduled.has(batch.batch_id)) continue; // already scheduled
    if (batch.date_end) continue; // already done
    if (!batch.date_start || !batch.planned_steep_hours) continue;

    const start = new Date(batch.date_start);
    const readyAt = new Date(start.getTime() + parseFloat(batch.planned_steep_hours) * 60 * 60 * 1000);
    const now = new Date();
    const delay = readyAt - now;

    if (delay <= 0) {
      console.log(`Batch ${batch.batch_id}: already past ready time (${readyAt.toLocaleString()})`);
      continue;
    }

    console.log(`Batch ${batch.batch_id}: ready at ${readyAt.toLocaleString()} (in ${Math.round(delay / 60000)} min)`);

    setTimeout(() => {
      sendEmail(
        `Cold brew #${batch.batch_id} ready!`,
        `Time to take batch #${batch.batch_id} out of the fridge!\n\nVessel: ${batch.vessel_ml}ml\nIngredients: ${batch.ingredients}\nStarted: ${batch.date_start}`
      );
    }, delay);

    scheduled.add(batch.batch_id);
  }
}

// --- Watch CSV for changes ---
scheduleBatches();

let watchDebounce = null;
fs.watch(CSV_PATH, () => {
  clearTimeout(watchDebounce);
  watchDebounce = setTimeout(() => {
    console.log("CSV updated — checking for new batches...");
    scheduleBatches();
  }, 1000);
});

console.log("Watching for new batches in cold-brew.csv...");
