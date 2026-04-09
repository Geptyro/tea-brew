# Tea Brew — Claude Instructions

## Planning batches
When the user asks to plan a batch, insert directly into MongoDB (localhost:27017, db: `jardin`, collection: `batches`). Use `Module.createRequire('/home/geptyro/.svd/index.js')` to load mongodb.

Schema:
```json
{
  "batch_id": <next int>,
  "date_start": <Date|null>,
  "date_end": null,
  "vessel_ml": <int>,
  "steps": [
    { "offset_hours": 0, "confirmed_at": null, "ingredients": [{ "name": "...", "quantity_g": <float|null>, "quantity_u": <int|null> }] },
    { "offset_hours": 4, "confirmed_at": null, "ingredients": [...] }
  ],
  "total_steep_hours": <int>,
  "steep_temp": "fridge",
  "notes": [],
  "rating": null
}
```

- `steps[0].confirmed_at` = actual start time (replaces `date_start` for start tracking)
- `date_start` = planned start time for "time to start" notifications
- `steps[i].confirmed_at` = when that step was confirmed (null if not yet done)
- Status is computed: `date_end` → done, `steps[0].confirmed_at` → steeping, else → planned

## Vessels & default dosages

| Vessel | Green tea | g/L  | Notes |
|--------|-----------|------|-------|
| 1500ml | 12g       | 8    | Main batch, first part of day |
| 770ml  | 4.5g      | 5.8  | Lower caffeine — drunk until evening |
| 435ml  | —         | —    | Experimental, ask the user |

Mango and other ingredients vary per batch — ask the user.

## Typical steep
- Total: 10h
- Multi-step: green tea at start (offset 0), mango at +4h
- Temp: fridge

## Consumption
~1.5–2L/day. May run multiple vessels simultaneously (e.g. 1.5L main + 770ml secondary).

## Notifier
Docker container `cold-brew-notifier`, polls every 5 min.
- `planned_start` on batch → sends "time to start" email
- After `date_start` set → sends step + ready emails
- Sent notifications tracked in `notified` array on the batch document
- Rebuild: `docker build --no-cache -t cold-brew-notifier . && docker restart cold-brew-notifier` from `notifier/`
- Auto-rebuild on file save: `node notifier/watch.js`

## File watcher (sveld extension)
Saves to `.sveld` files auto-refresh the VS Code preview via `onDidSaveTextDocument`.
If not refreshing: run `Developer: Restart Extension Host`.
