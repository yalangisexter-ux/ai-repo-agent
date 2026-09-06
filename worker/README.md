# Optional Gemini proxy

Use this Cloudflare Worker if you do not want the Gemini API key exposed to the browser.

Set a Worker secret named `GEMINI_API_KEY`, then deploy `worker.js` and change `gemini()` in `app.js` to POST to the Worker URL. Keep the GitHub token in the browser only for your personal deployment; a production multi-user app should use GitHub OAuth/Apps instead.
