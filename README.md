# Tea Brew

Personal cold brew tea tracker built with [Sveld](https://marketplace.visualstudio.com/items?itemName=CdricDessalles.sveld) — a VS Code extension that renders `.sveld` files as live interactive views.

## Views

| File | Description |
|------|-------------|
| `cold-brew.sveld` | Active batches — start, confirm steps, mark done, add notes |
| `compare.sveld` | Side-by-side comparison of completed batches |
| `chart.sveld` | Charts — ratings, ingredient ratios, steep time vs rating |

## Setup

**Requirements:**
- [Sveld](https://marketplace.visualstudio.com/items?itemName=CdricDessalles.sveld) VS Code extension
- MongoDB running locally on port 27017
- A `.env` file in this directory (see below)

**`.env`**
```
MONGO_URI=mongodb://localhost:27017
MONGO_DB=jardin
```

Open any `.sveld` file in VS Code — it renders automatically.

## Notifier

A Docker container that polls batches every 5 minutes and sends email/SMS notifications for:
- Planned start time reminders
- Step confirmations (e.g. add mango at +4h)
- Ready to drink alerts

```bash
# Build and start
docker build -t cold-brew-notifier ./notifier
docker run -d --name cold-brew-notifier cold-brew-notifier

# Rebuild on file save
node notifier/watch.js
```

## Data model

Batches are stored in MongoDB (`jardin.batches`):

```json
{
  "batch_id": 42,
  "date_start": "<planned start Date>",
  "date_end": "<actual end Date | null>",
  "vessel_ml": 1500,
  "steps": [
    { "offset_hours": 0, "confirmed_at": "<Date | null>", "ingredients": [{ "name": "green tea", "quantity_g": 12 }] },
    { "offset_hours": 4, "confirmed_at": "<Date | null>", "ingredients": [{ "name": "mango", "quantity_g": 80 }] }
  ],
  "total_steep_hours": 10,
  "steep_temp": "fridge",
  "notes": [],
  "rating": null
}
```

**Status** is computed: `date_end` set → done · `steps[0].confirmed_at` set → steeping · otherwise → planned
