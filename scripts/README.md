# Scripts

## migrate-ratings-to-subcollection.js

Moves every user's `ratings` field into a subcollection `users/{userId}/ratings` so user documents stay under Firestore's 1MB limit.

**Before running:**

1. Install dependencies: `npm install`
2. In [Firebase Console](https://console.firebase.google.com) → your project → **Project settings** → **Service accounts** → **Generate new private key**. Save the JSON file somewhere safe (e.g. `./service-account.json` — **do not commit this file**).
3. Set the env var and run once:

   ```bash
   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
   node scripts/migrate-ratings-to-subcollection.js
   ```

   On macOS/Linux use `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`.

**What it does:**

- Reads each `users/{userId}` document.
- For each user that has a `ratings` object, flattens all entries (movie + tv, all sentiments) into documents in `users/{userId}/ratings` with IDs like `movie_123` or `tv_456_show` / `tv_456_2`.
- Each rating document has: `mediaType`, `sentiment`, `mediaId`, `note`, `score`, `timestamp`, and optionally `season`.
- Removes the `ratings` field from the user document.

**After migration:** Update the app to read and write ratings from `users/{uid}/ratings` (subcollection) instead of the `ratings` field on the user doc.
