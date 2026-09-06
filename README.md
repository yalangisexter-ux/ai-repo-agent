# AI Repo Agent — OpenRouter + GitHub

iPhone-first PWA that loads text/source/config files from a GitHub repository, sends selected files to OpenRouter, reviews proposed create/modify/delete actions, creates a backup branch, and commits approved changes.

## Required credentials

1. OpenRouter API key
2. GitHub fine-grained Personal Access Token:
   - Repository access: only selected repositories
   - Contents: Read and write
   - Metadata: Read-only

## Important

This version calls OpenRouter and GitHub directly from the browser. For a public multi-user deployment, move credentials behind a server/Cloudflare Worker and use OAuth/GitHub App where appropriate.

The agent does not execute arbitrary repository code in the browser. It displays a validation plan; actual tests should be run in CI/GitHub Actions.


## Optional Worker mode

If a Worker URL is entered, the PWA sends AI and GitHub requests through the Worker.
In that mode, `OPENROUTER_API_KEY` and `GITHUB_TOKEN` stay in Cloudflare Worker secrets and do not need to be entered into the browser.

If no Worker URL is entered, direct browser-to-API mode remains available for personal testing.


## Interactive dialogue
The PWA includes a chat box for natural-language instructions, questions, code reviews, and improvement suggestions. Ctrl/Cmd+Enter sends the prompt. If changes are proposed, they appear in the review section before commit.
