# Releasing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/).
Every push to `master` runs [`.github/workflows/release.yml`](.github/workflows/release.yml),
which analyses the commits, decides the next version, updates the changelog,
publishes to npm, creates a GitHub release, and commits the bumps back.

Publishing to npm uses **[trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)** —
there is **no `NPM_TOKEN`**. The workflow requests an OIDC token
(`id-token: write`), exchanges it with the npm registry, and npm generates
[provenance](https://docs.npmjs.com/generating-provenance-statements) automatically.

## Commit messages drive versions

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/).

| Commit prefix                       | Release  |
| ----------------------------------- | -------- |
| `fix: …`                            | patch    |
| `feat: …`                           | minor    |
| `feat!: …` or a `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `refactor:`, `test:`, `ci:` … | none |

Commits with no release-triggering type produce no release.

## One-time setup

These steps are manual (they need your npm login and the npm/GitHub web UIs).
Trusted publishing is per-package and per-repo, so the package must exist on npm
**before** it can be wired up — hence a single bootstrap publish first.

### 1. Bootstrap publish (once)

```bash
npm login                 # your account, with 2FA
npm whoami                # confirm you're logged in
git checkout master && git pull
npm publish               # runs lint + typecheck + test + build via prepublishOnly
```

This publishes the current `version` from `package.json` (`0.1.0`). No
provenance is generated for this local publish — that's expected; CI releases
will have it.

### 2. Configure the npm trusted publisher

On <https://www.npmjs.com/package/postcss-spine> → **Settings** → **Trusted
Publisher** → **GitHub Actions** → **Set up connection**, entering values that
**exactly** match the workflow:

| Field             | Value           |
| ----------------- | --------------- |
| Organization/user | `lsobolew`      |
| Repository        | `postcss-spine` |
| Workflow filename | `release.yml`   |
| Environment       | *(leave empty)* |

### 3. Set the version baseline

So semantic-release continues from `0.1.0` (instead of treating the next release
as the first and jumping to `1.0.0`), tag the published commit:

```bash
git tag v0.1.0
git push origin v0.1.0
```

### 4. GitHub repository settings

- **Settings → Actions → General → Workflow permissions:** *Read and write
  permissions* (so semantic-release can push the release commit/tag and create
  releases with the built-in `GITHUB_TOKEN`).
- **Settings → Secrets and variables → Actions → Variables:** add
  `RELEASE_ENABLED` = `true`. The release job is gated on this so it stays idle
  until everything above is done.
- If `master` is a **protected branch**, allow the release commit through
  (e.g. add a bypass for the GitHub Actions bot, or the `@semantic-release/git`
  push will be rejected).

## Day-to-day

Just merge Conventional-Commit work into `master`. The workflow does the rest.

Preview what the next release would be (needs a GitHub token + npm auth locally):

```bash
GITHUB_TOKEN=<token> npm run release:dry
```

## Troubleshooting

- **`EINVALIDNPMTOKEN` / falls back to token auth in CI** — the OIDC exchange
  failed, so it fell through to token auth. Check: `id-token: write` is present
  (it is in `release.yml`), the runner's npm is ≥ 11.5.1 (the workflow upgrades
  npm), the package exists, and the trusted-publisher fields match exactly
  (org, repo, `release.yml`, empty environment).
- **Release job doesn't run** — `RELEASE_ENABLED` variable not set to `true`.
- **Push of the release commit rejected** — branch protection on `master`; add a
  bypass for the release identity.
- **Wrong first version** — the `v0.1.0` baseline tag is missing.
