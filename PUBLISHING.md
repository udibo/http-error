# Publishing @udibo/http-error

The package is published to [npm](https://www.npmjs.com/package/@udibo/http-error)
and [JSR](https://jsr.io/@udibo/http-error) from one semantic-release run on
every push to `main` whose [Conventional Commits](https://www.conventionalcommits.org)
call for a release (`feat` is a minor release, `fix`, `perf`, and `chore(deps)`
are patch releases). While the version is 0.x, breaking changes also release a
minor version, so a `BREAKING CHANGE` footer never produces 1.0.0 on its own.

The release job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) only
runs when the repository variable `RELEASE_ENABLED` is `true`. Until it is set,
merging to `main` runs the checks and publishes nothing. The first release after
the Node migration is **0.12.0** (the migration PR is a `feat`, and `0.11.1` is
the last tag).

## One-time setup

1. **JSR.** The `@udibo/http-error` package already exists in the `@udibo`
   scope. In its settings on jsr.io, confirm it is linked to the GitHub
   repository `udibo/http-error`. The release job publishes with GitHub OIDC;
   no JSR token is stored.
2. **npm, first publish.** The package does not exist on npm yet, and npm cannot
   configure a trusted publisher for a package that does not exist. For the
   first release only:
   1. Create a granular npm access token that can publish new packages in the
      `@udibo` scope (read and write, scoped to `@udibo/*`, short expiry).
   2. Save it as the repository secret `NPM_TOKEN`.
3. **Enable releases.** Set the repository variable
   `RELEASE_ENABLED=true` (Settings, Secrets and variables, Actions, Variables,
   or `gh variable set RELEASE_ENABLED --body true --repo udibo/http-error`).
4. **Merge the migration PR** (squash merge with a `feat:` title). The release
   job publishes 0.12.0 to npm (with a provenance attestation) and JSR, pushes
   the `chore(release)` commit that updates `package.json` and `jsr.json`, tags
   `0.12.0`, and creates the GitHub release.
5. **npm trusted publishing.** Once the package exists on npm, open
   npmjs.com, then `@udibo/http-error`, then Settings, then Trusted Publisher,
   and add a GitHub Actions publisher: organization `udibo`, repository
   `http-error`, workflow filename `ci.yml`, environment empty.
6. **Remove the bootstrap token.** Delete the `NPM_TOKEN` repository secret and
   revoke the token on npm. A stored token takes precedence over the OIDC
   exchange, so leaving it in place keeps the long-lived credential alive.
   Later releases authenticate with the job's OIDC token only.

If `main` gains a ruleset that requires pull requests, the release commit needs
a bypass. Generate an SSH deploy key with write access, store the private half
as a secret, and pass it to `actions/checkout` as `ssh-key`.

## Validate locally

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:coverage
pnpm build
pnpm smoke
pnpm jsr:dry-run
```

`pnpm smoke` packs the package, installs the tarball into an empty project, type
checks a consumer under NodeNext resolution, and runs it on Node. CI runs the
same steps on Node 22, 24, and 26.

## What the release does

- Computes the next version from the commits since the last tag.
- Updates the version in `package.json` and `jsr.json`.
- Publishes `dist/` to npm (`pnpm build` runs before semantic-release so npm
  authentication is verified before anything is pushed) and the TypeScript
  sources in `src/` to JSR.
- Commits the version files, tags the release, and creates the GitHub release.

A release is not a transaction across Git, npm, and JSR. If publication fails
partway, inspect all three before re-running. npm and JSR versions are
immutable, so a version that already exists on either registry cannot be
overwritten.
