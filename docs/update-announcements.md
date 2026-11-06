# Update announcement drafts

Generate a draft for both `Project-Pandora-Game/pandora` and `pandora-assets`, review it, and copy the parts to Discord after the deployment has been verified. Generation only reads GitHub; it does not deploy, change PRs, send messages, or publish announcements.

## Run locally before deploying

Build the CLI and its dependencies from the feature branch (a running Pandora server is not needed):

```sh
pnpm install --frozen-lockfile
pnpm --filter 'pandora-cli...' run build
node pandora-cli/dist/index.js updates --help
node pandora-cli/dist/index.js updates > announcement.md
node pandora-cli/dist/index.js updates --format json > announcement.json
node pandora-cli/dist/index.js updates --format discord > announcement-parts.txt
```

Diagnostics go to stderr, so redirects contain only the selected output. JSON includes source commits, deployment IDs, PR links, unmatched commits, extracted entries, warnings, suggested pings, announcement text, and Discord parts. Keep this file with the reviewed announcement to retain the exact source ranges. Markdown output is the combined editable text; Discord output contains numbered part separators that should not be copied into Discord.

The default range is the most recent successful deployment in the exact `Production` environment through the current `master` commit, independently for each repository. Targets are resolved to full SHAs before comparison. PTB is excluded by environment name. Newer failed or unfinished production deployments are reported because they can make the running version uncertain.

Use explicit refs to reproduce a draft, select a release other than master, or generate changes since the last announcement rather than the last deployment:

```sh
node pandora-cli/dist/index.js updates \
  --main-base MAIN_BASE_SHA --main-target MAIN_TARGET_SHA \
  --assets-base ASSETS_BASE_SHA --assets-target ASSETS_TARGET_SHA \
  --format json > announcement.json
```

A target behind or diverged from its baseline fails rather than producing a misleading draft. Handle rollbacks by explicitly choosing the intended range. Client-only baselines produce a warning: those deployment records cannot establish which server changes are running. Use the last appropriate full deployment commit when preparing a full release. An unchanged repository can use the same SHA for its base and target.

Optional authentication uses `PANDORA_UPDATES_GITHUB_TOKEN`, then `GH_TOKEN`, then `GITHUB_TOKEN`. Public reads work without a token, but GitHub's unauthenticated rate limit can be too small for a full range. Use an existing GitHub CLI login without writing its token to a file:

```sh
GH_TOKEN="$(gh auth token)" node pandora-cli/dist/index.js updates --format json > announcement.json
```

For private access, a token needs read access to Contents, Pull requests, and Deployments for both repositories. Never expose the deployment App private key or a token in web-client configuration. An installation token from the existing deployment App can be passed through the environment; the generator does not create or refresh App tokens.

## Admin UI

Open Management → Updates as a lead developer. Enter target refs and optional base overrides, then generate a draft. The Directory server supplies the same generator used by the CLI. Set `PANDORA_UPDATES_GITHUB_TOKEN` on the Directory server if authenticated reads are needed; the browser never receives it. Generation uses the existing management endpoint authentication and lead-developer authorization.

The page shows exact compared commits, review warnings, source PRs, and commits without an included merged PR. Edit the announcement text to correct wording, add missing changes, and move important changes first. Choose ping categories and whether to append a final heart, then copy each part. Copy draft JSON to retain the edited text and its source ranges. Starting again explicitly discards the current draft; changes to ping choices preserve text edits.

## Extraction and review

Both repos' existing `## Changelog` templates are supported, including fenced Markdown, `Authored by:`, multiple sections, and nested bullets. HTML comments and the checklist are excluded. Explicit `[by Name]` credits are preserved; otherwise credits use `Authored by:`. Missing credits fall back to the GitHub login with a warning. Check aliases and coauthors manually.

Entries are grouped by section and alphabetically by credited author, preserving each author's original order. Unknown sections are retained with a review warning. PRs are deduplicated within each repository; only merged PRs whose merge commit is in the selected range are included. Commit and PR-association pagination is followed, and API errors or incomplete ranges fail visibly. Commits without a matching PR remain available for review, including direct dependency updates.

An explicit `_None_` changelog is treated as an intentional omission. Missing or empty changelogs remain visible for review; the tool never invents descriptions from a PR title or claims to have checked the diff. Verify that release notes match the actual changes. In particular, review PRs without entries and unmatched commits before posting.

Ping suggestions reflect included sections. Major-update pings always require a manual choice. `@Ping: ...` labels are placeholders matching the exported Discord history; replace them with the actual Discord roles when posting. The CLI can override suggestions using `--pings 'Any update,Asset updates'`, or suppress them with `--pings ''`. `--no-heart` suppresses the final heart in Discord parts.

Each Discord part is limited to 2,000 UTF-16 code units, preferring paragraph and line boundaries. Very long entries can span parts; review the preview for formatting. Only the final part receives a heart.

GitHub deployment status alone does not prove application health or safe migrations. Confirm that the selected commits actually shipped, verify health and migration results, then post and publish the reviewed parts manually. No Discord credentials are required by this tool.
