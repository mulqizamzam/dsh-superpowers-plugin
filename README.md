# dsh-superpowers-plugin

A DeepSeek Harness (DSH) bundle that exposes the
[obra/superpowers](https://github.com/obra/superpowers) skills to a session through
an isolated `dsh-skill-filesystem` provider.

The bundle does not vendor or copy the skills. It points one provider at the skills
directory of a superpowers checkout you already have.

## Requirements

- DSH with `@deepseek-ai/dsh-skill-filesystem` resolvable from the installation
  (this bundle declares `@deepseek-ai/dsh` peer `>= 0.2.0-rc.2`, so the harness
  evaluates plugin compatibility instead of skipping the check).
- A superpowers checkout containing `skills/<name>/SKILL.md` (15 skills at the
  time of writing).

## Install

Add the package to a DSH profile and list it in `dsh.profile.bundles`:

```json
{
  "dependencies": {
    "dsh-superpowers-plugin": "link:/path/to/dsh-superpowers-plugin"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-superpowers-plugin"]
    }
  }
}
```

The bundle applies `cordis.patch.yml`, which inserts exactly one row:

| field | value |
| --- | --- |
| row id | `superpowers-skills` |
| component | `@deepseek-ai/dsh-skill-filesystem` |
| `providerName` | `superpowers` |
| `includeDefaultRoots` | `false` |

`includeDefaultRoots: false` is what makes the provider *isolated*: it scans only its
explicit roots, so the project and user skill roots do not leak into this provider's
catalogue.

## Point it at your skills

The skills root is resolved when the row loads, so no path is baked into the file:

1. `$DSH_SUPERPOWERS_SKILLS_DIR`, when set.
2. `$DSH_HOME/superpowers/skills` otherwise (`~/.dsh/superpowers/skills` when
   `DSH_HOME` is unset).

Either set the variable, or place (or symlink) the skills at the second location:

```sh
ln -s /path/to/superpowers/skills "$DSH_HOME/superpowers/skills"
```

> **A wrong value fails silently.** The provider contributes no candidates and the
> skills simply do not appear; nothing errors. If the skills are missing from a
> session, check this path first. `npm test` prints the path resolved on your host.

## Verify

```sh
npm test
```

`tests/patch-resolution.test.mjs` evaluates the same `!!js` expression the loader
evaluates, and asserts: an explicit override wins, the `$DSH_HOME` default is used
otherwise, `~/.dsh` is the last fallback, no machine-specific path is pinned in the
patch, and — on a configured host — the resolved root actually holds skills.

## What this bundle does not do

- It does not vendor the skills into this repository.
- It does not modify them: the provider reads them in place.
- It does not add commands, tools, or hooks of its own. The patch has one row.

## License and credits

Skills are supplied by [obra/superpowers](https://github.com/obra/superpowers)
(MIT, Copyright (c) 2025 Jesse Vincent) and remain under that project's license.
This wrapper is MIT — see `LICENSE`.
