# Testing a change locally

Everything runs from the repo root. You need Node 22 or newer; nothing else.

| Command | What it does |
|---|---|
| `npm run setup` | Installs exactly the locked dependencies for the game (`web/`) and the physics (`app/sim/`). |
| `npm run dev` | Starts the game at http://127.0.0.1:5173 with live reload. |
| `npm run check` | The same checks CI runs: type-check, build, web tests, physics tests, catalog check. |
| `npm run preview` | Builds the game as it is deployed and serves that build locally. |
| `npm run preview:docker` | Builds and runs the exact container the live site uses, at http://127.0.0.1:3021 (needs Docker). |

## Trying someone else's branch

    git fetch
    git switch their/branch
    npm run setup      # always: the branch may have added or changed dependencies
    npm run dev

Most "it works for them but not for me" cases have been one of these:

- **Dependencies not reinstalled after switching branch or pulling.** Run `npm run setup`.
- **A dev server left running from another branch.** Stop it (Ctrl+C) and start `npm run dev` again.
- **Using `npm install` inside `web/`.** `web/` uses pnpm and its lockfile; `npm run setup` does the right thing.
- **Old Node.** `node --version` must be 22 or newer.
- **It only breaks on the live site.** The dev server is forgiving in ways the deployed nginx is
  not. Use `npm run preview:docker` to run the real container.

## Before you push

Run `npm run check`. CI runs the same on every push and pull request and shows a red cross on
the commit if it fails. The Python data pipeline is tested separately (`pip install -r
requirements-dev.txt && python -m pytest`) and also runs in CI.

Useful addresses while developing: `/?planner` (engineering planner), `/?cutscene-demo`
(cutscene bench), `/?moon` (Moon explorer).
