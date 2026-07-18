# Wayfarer

Collect momentos of the places you have been. Offline-first PWA, no backend.

## Deploy (GitHub Pages)

1. Upload every file in this folder (keep `vendor/` intact) to a public repo.
2. Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
3. Open the Pages URL in Safari on iPhone → Share → Add to Home Screen.
4. Launch from the home screen icon, allow location, then Sync → cache your regions on wifi.

Updating: upload the changed files over the old ones, commit, then on the phone open the app online, force-quit, and open again (updates apply on the second launch).

## How it plays

- Get within 60 m of a place (widened automatically when GPS accuracy is poor). The pin grows and the phone taps you when a place becomes spinnable.
- Spin the compass: drag the bezel round until it seats. A momento is pressed into your passport.
- Return on another day (20 h cooldown) and file a dispatch (text and/or photo of the place as you find it) to earn that place's rare momento.
- Tap a stamp or pin to read about the place: Wikipedia summary and links, stored offline after first load.

## Builder mode (testing)

The green ✚ places a POI by hand: pan until the pin sits on the spot, name it, pick a type, optionally attach a link. Password: `lemorne` (change `BUILDER_PIN` at the top of `app.js`; it is visible in source, so this is a testing gate, not security). While unlocked, opening one of your places shows a remove button, which also removes its stamps.

## Data sources

- ~90 curated seed places (Mauritius, Kruger, Johannesburg North, Pretoria East, Cape Town, Johannesburg) bundled into the app.
- Caching a region adds Wikidata (notable places + Wikipedia/website links) and OpenStreetMap via Overpass (parks, monuments, artworks, viewpoints, places of worship…), deduplicated, with point features preferred over area centroids.

## Offline design

- Map: MapLibre GL over OpenFreeMap vector tiles. Caching a region pre-downloads tiles (to z14, over-zoomed beyond) plus fonts and the TileJSON; the service worker serves them cache-first, so the map renders with zero signal.
- Places, stamps, dispatches, and fetched articles live in IndexedDB.
- Every action queues in an outbox for a future backend; nothing requires one today.

## Known limits

- iOS gives web apps no background location: the app must be open to notice you are near a place.
- Everything is stored on this phone only. Deleting the home-screen app deletes its data. No cross-device sync until there is a backend.
- Solo only: friends, leaderboards, and peer-reviewed submissions are the planned V2, with the builder form as the seed of the submission flow.

## Files

`index.html` (views + styles) · `app.js` (all logic) · `sw.js` (offline cache) · `manifest.json` · `vendor/` (MapLibre GL) · `icon-*.png`
