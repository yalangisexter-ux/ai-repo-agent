# AI Repo Agent — Repository-Level iPhone PWA

This build upgrades the original Python-only repair screen into a repository-level coding agent.

## What changed
- Loads source/configuration files across the repository, not only `.py`.
- Gemini can propose `create`, `modify`, and `delete` operations.
- New files can be created and existing files can be edited or deleted.
- The IDE can modify its own repository (`ai-repo-agent`) like any other repository.
- Before every approved push, a timestamped backup branch is created at the current branch HEAD.
- The approved operations are assembled into one Git commit and pushed with a non-force branch update.
- Binary assets are not sent to Gemini as text.

## Supported text/source formats
Python, JavaScript, TypeScript, JSX/TSX, Java, Kotlin/KTS, Swift, Go, Rust, Ruby, PHP, C/C++, C#, Dart, shell, HTML, CSS/SCSS, XML/SVG, JSON, YAML, TOML, INI/config, Gradle, SQL, GraphQL, protobuf, Markdown, text and common project files.

## GitHub permissions
For each repository the agent modifies, the fine-grained token needs Repository access to that repository and at least:
- Contents: Read and write
- Metadata: Read-only

## Self-modification
Set the repository to `yalangisexter-ux/ai-repo-agent`. The agent can load and propose changes to `app.js`, `index.html`, `styles.css`, manifest/config files, etc. After committing, GitHub Pages deploys the new version; reload the PWA to run it.

## Security note
The current personal-use PWA stores GitHub/Gemini credentials in browser localStorage. For public deployment, use the included Worker proxy for Gemini and preferably GitHub OAuth/GitHub App authentication instead of a raw PAT.
