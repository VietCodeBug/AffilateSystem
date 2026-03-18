# Organic Publisher API (v2)

## New environment variables

- `PLATFORM_CREDENTIAL_SECRET`: secret used to encrypt platform tokens at rest.
- `FACEBOOK_GRAPH_VERSION`: optional, default `v21.0`.
- `THREADS_GRAPH_BASE`: optional, default `https://graph.threads.net/v1.0`.

## Main flow

1. Generate content pack:
   - `POST /api/content-packs/generate`
2. Approve/select variant:
   - `PATCH /api/content-packs/{pack_id}/approve`
   - `PATCH /api/content-packs/{pack_id}/select-variant`
3. Save platform credential:
   - `POST /api/platform-credentials`
4. Schedule publishing job:
   - `POST /api/publisher/jobs`
5. Run job manually:
   - `POST /api/publisher/jobs/{job_id}/run`
6. Collect metrics:
   - `POST /api/publisher/jobs/{job_id}/collect-metrics?window_label=15m`
   - `POST /api/metrics/ingest`
7. Analyze:
   - `GET /api/metrics/content/{pack_id}`
   - `GET /api/metrics/leaderboard?window=7d`

## Notes

- Facebook flow publishes post first, then first comment.
- Threads flow publishes text post and appends product link if missing.
- Scheduler applies random jitter and basic pacing for same content angle.
- Metrics support `15m`, `2h`, `24h`, `72h` windows (free-form `window_label`).

