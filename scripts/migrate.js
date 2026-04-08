const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const URI = "mongodb://localhost:27017";
const DB = "jardin";
const COLLECTION = "batches";
const CSV_PATH = path.join(__dirname, "cold-brew.csv");

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).filter(l => l.trim()).map((line) => {
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]));

    // Type conversions
    row.batch_id = parseInt(row.batch_id);
    row.vessel_ml = parseInt(row.vessel_ml);
    row.planned_steep_hours = parseFloat(row.planned_steep_hours);
    row.actual_steep_hours = row.actual_steep_hours ? parseFloat(row.actual_steep_hours) : null;
    row.rating = row.rating ? parseFloat(row.rating) : null;
    row.date_start = row.date_start ? new Date(row.date_start) : null;
    row.date_end = row.date_end ? new Date(row.date_end) : null;
    row.taste_notes = row.taste_notes || null;

    // Parse ingredients into array: "green tea:15g;mint:6 leaves (<1g)"
    row.ingredients = row.ingredients
      ? row.ingredients.split(";").map((item) => {
          const [name, quantity] = item.split(":");
          return { name: name.trim(), quantity: quantity ? quantity.trim() : null };
        })
      : [];

    return row;
  });
}

async function migrate() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const collection = client.db(DB).collection(COLLECTION);
    const batches = parseCsv(CSV_PATH);

    // Upsert each batch by batch_id
    for (const batch of batches) {
      await collection.updateOne(
        { batch_id: batch.batch_id },
        { $set: batch },
        { upsert: true }
      );
      console.log(`Upserted batch #${batch.batch_id}`);
    }

    console.log(`Done — ${batches.length} batch(es) migrated to ${DB}.${COLLECTION}`);
  } finally {
    await client.close();
  }
}

migrate().catch(console.error);
