# AI Repo Agent — iPhone-only PWA

This is a no-Xcode, no-laptop version. It is a static Progressive Web App using GitHub REST APIs and Gemini `generateContent`.

## Run on iPhone
1. Host this folder on any HTTPS static host (GitHub Pages is suitable).
2. Open the site in Safari.
3. Share → Add to Home Screen.
4. Open Settings inside the app and enter a GitHub fine-grained token with Contents read/write for the target repository, plus a Gemini API key.
5. Enter `owner/repository`, branch, select files, give an instruction, Analyze & Fix, review, then commit.

## Security
The simple build calls Gemini directly from the browser, so the Gemini key is available to the browser. For a public deployment, use `worker/worker.js` as a proxy and keep the Gemini key in the Worker secret. Do not share your GitHub token.

## Git behavior
The commit flow reads the current branch tip, creates blobs for changed files, creates a tree based on the current tree, creates one commit, then updates the branch. GitHub documents this Git database workflow and the Contents write permission requirement.
