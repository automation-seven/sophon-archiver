# Sophon Archiver (100% free-tier version)

Paste a live-broadcast URL into a web page → GitHub Actions records it (yt-dlp) and uploads it to Cloudflare R2 → a Cloudflare Worker gives you a page to trigger jobs and watch/download the results. Nothing runs on your own machine, and closing your laptop/phone doesn't stop anything — the recording happens entirely on GitHub's servers.

**Cost: $0.** GitHub Actions is free/unlimited on a public repo (2,000 free min/month if you keep it private, which is what I'd recommend — see note below). Cloudflare Workers + R2 free tier easily covers personal use, with zero egress fees, so rewatching is also free.

---

## 1. Create the GitHub repo

1. Create a new repo on GitHub (I'd make it **private** — see note below) and push this whole folder to it.
2. Go to **Settings → Actions → General → Workflow permissions** and make sure Actions are enabled for the repo.

**Private vs public note:** Public repos get unlimited free Actions minutes, but workflow run logs (which will include the URLs you paste) are visible to anyone. Private repos get 2,000 free minutes/month, which is plenty for occasional live-stream capture (a 2-hour stream ≈ 120 minutes), and keeps things private. I'd go private.

## 2. Set up Cloudflare R2

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free)
2. R2 → Create bucket → name it `live-archive` (or update the name in `wrangler.toml`)
3. No API tokens needed for the Worker — it uses a native R2 binding (already wired up in `wrangler.toml`)

## 3. Set up GitHub Actions secrets (for the upload step)

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add these (R2 → Manage R2 API Tokens → Create API token, scoped to your bucket):

- `R2_ENDPOINT` — `https://<your-account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` — e.g. `live-archive`

## 4. Create a GitHub token for the Worker (to trigger the workflow)

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
2. Scope it to just this one repo
3. Permissions: **Contents: Read-only**, **Actions: Read and write**
4. Copy the token — you'll need it in step 6

## 5. Install Wrangler and log in to Cloudflare

```bash
cd sophon-archiver
npm install
npx wrangler login
```

## 6. Set Worker secrets

```bash
npx wrangler secret put GH_TOKEN
# paste the fine-grained PAT from step 4

npx wrangler secret put GH_OWNER
# your GitHub username

npx wrangler secret put GH_REPO
# the repo name from step 1
```

## 7. Deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://sophon-archiver.<your-subdomain>.workers.dev` — that's your app.

## 8. Use it

1. Open the Worker URL on any device
2. When a live broadcast starts, paste its URL, optionally add a title, hit **Start Recording**
3. Close the tab, close your laptop, whatever — the job runs on GitHub's servers
4. Come back anytime, open the same URL — your recording shows up under **Saved Recordings** with **Watch** (streams in-browser) and **Download** links

## Notes & limits

- **6-hour cap per job** — GitHub's hosted runners hard-stop at 6 hours. Fine for essentially any livestream; if you ever need longer, the job would need to be split, which isn't set up here.
- **Joining mid-stream**: yt-dlp captures from the moment the job starts, not from the actual beginning of the broadcast — same caveat as before. If the broadcaster has DVR/rewind enabled, add `--live-from-start` to the yt-dlp command in `.github/workflows/record.yml`.
- **One job at a time** conceptually — nothing stops you from triggering two, but the status panel only reflects the most recent run.
- **Legal note**: downloading/archiving YouTube live content is technically against YouTube's ToS even for personal use. This is a common gray area for personal archiving, but worth knowing if you ever expand this beyond just-for-you use.
