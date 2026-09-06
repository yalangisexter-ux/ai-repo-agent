# AI Repo Agent Worker

Optional secure proxy for the PWA.

## Cloudflare setup

Create a Worker and set these encrypted secrets:

- `OPENROUTER_API_KEY`
- `GITHUB_TOKEN`

Example with Wrangler:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

Then configure the PWA to use the Worker URL.

## Routes

- `POST /ai` proxies requests to OpenRouter.
- `GET|POST|PATCH|DELETE /github?url=https://api.github.com/...` proxies GitHub API requests.

For production, change `ALLOWED_ORIGIN` in `worker.js` to your exact PWA origin and consider additional authentication/rate limiting.
