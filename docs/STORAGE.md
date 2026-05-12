# Storage layout

> Single source of truth for where uploaded files live. Key builders in
> `apps/web/src/lib/storage-keys.ts` produce these paths — don't construct
> paths by hand in route handlers.

## Layout

```
apps/web/uploads/                           # UPLOADS_ROOT (env override)
├── public/                                 # CDN-cacheable, capability URL
│   ├── avatars/{userId}/{filename}
│   ├── lesson-media/
│   │   ├── images/{yyyy}/{mm}/{filename}
│   │   ├── videos/{yyyy}/{mm}/{filename}
│   │   └── pdfs/{yyyy}/{mm}/{filename}
│   └── exam-assets/{yyyy}/{mm}/{filename}
├── private/                                # auth required at serve time
│   └── submissions/{yyyy}/{mm}/{filename}
└── tmp/{yyyy-mm-dd}/{session}/{filename}   # auto-purge >24h
```

## Why three layers

| Layer     | Access policy                          | Migration to S3                                |
| --------- | -------------------------------------- | ---------------------------------------------- |
| `public`  | Capability URL (random suffix), CDN OK | Anonymous-read bucket + CloudFront / Cloudflare |
| `private` | Signed URL or proxied through app      | Private bucket, signed URLs only (5–15 min)    |
| `tmp`     | TTL'd, only readable by uploader       | Lifecycle rule: expire after 24h               |

Even on local disk, separating these now means switching to S3/R2 later is a
config change — not a refactor.

## Why date-shard most kinds

Anything that grows linearly (lesson media, exam assets, submissions, etc.)
gets `yyyy/mm` between the kind and the filename. Keeps any one directory
under a few thousand files so `rsync`/`ls`/backup tools don't choke. Year/month
is the right granularity until volume > a few hundred thousand files — at
which point switch to `yyyy/mm/dd`.

## Why user-shard avatars

Avatars are small but each user has 1 active + a tail of replaced versions.
Sharding by `userId` makes "delete everything for user X" a single
`rm -rf avatars/{userId}/` — important for the GDPR delete API (CLAUDE.md §5).

## URL contract

URLs in DB rows stay **flat** even though on-disk paths are sharded:

| URL                                    | On-disk (new)                                                  | On-disk (legacy, pre-migration)    |
| -------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `/api/avatars/{file}`                  | `public/avatars/{userId}/{file}`                               | `avatars/{file}`                   |
| `/api/lesson-media/images/{file}`      | `public/lesson-media/images/{yyyy}/{mm}/{file}`                | `lesson-images/{file}`             |
| `/api/lesson-media/videos/{file}`      | `public/lesson-media/videos/{yyyy}/{mm}/{file}`                | `lesson-videos/{file}`             |
| `/api/lesson-media/pdfs/{file}`        | `public/lesson-media/pdfs/{yyyy}/{mm}/{file}`                  | `lesson-pdfs/{file}`               |
| `/api/exam-assets/{file}`              | `public/exam-assets/{yyyy}/{mm}/{file}`                        | `exam-assets/{file}`               |
| `/api/assignment-media/{file}`         | `private/submissions/{yyyy}/{mm}/{file}`                       | `assignment-submissions/{file}`    |

The serving route derives the sharded path from the filename (timestamp or
userId encoded in the name) and falls back to the legacy flat path. So:

- New uploads land in the new layout immediately.
- Old files keep serving from the legacy path.
- Migration is a separate, optional housekeeping pass.

## Migration

Run from repo root:

```bash
node scripts/migrate-uploads.mjs          # dry-run, prints plan
node scripts/migrate-uploads.mjs --apply  # actually move files
```

Idempotent — safe to re-run. Does **not** touch the database; only moves files.

## Tmp / commit pattern

Used by rich-text image paste and any multi-step upload:

1. Client uploads to a `tmp/` key (returned by an upload endpoint).
2. User saves the parent entity (lesson, draft post, etc.).
3. Server calls `commitTmp(tmpKey, destKey)` from `storage.ts` — atomic move
   to the permanent location.
4. A daily cron cleans `tmp/` entries older than 24h.

## S3 / R2 switchover

Set in `.env.prod`:

```
S3_BUCKET=feedbackme-uploads        # shared bucket — keys get prefixed `public/`, `private/`, `tmp/`
S3_REGION=auto
S3_ENDPOINT=https://...r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.feedbackme.example   # for the `public` layer
```

Or per-layer buckets for stricter isolation:

```
S3_BUCKET_PUBLIC=feedbackme-public
S3_BUCKET_PRIVATE=feedbackme-private
S3_BUCKET_TMP=feedbackme-tmp
```

The `private` layer never returns a `publicUrl()` even when on S3 — callers
must mint signed URLs (TODO: helper to be added when private serving moves
off-app).
