# Contributing

Issues are welcome. Pull requests are welcome once the change they carry exists as a
task, and not before.

That is not gatekeeping, it is how this repository is built. Every line of code here
traces to a requirement in [SPEC.md](SPEC.md), a mechanism in [PLAN.md](PLAN.md) and a
slice in [TASKS.md](TASKS.md), and every branch is one of those slices. A bare pull
request against `main` has no requirement to trace to and no acceptance criteria to meet,
so there is nothing to review it against and no way to say when it is done.

## Reporting something

Open an issue. For a bug, say what you did, what you expected and what you saw, with the
browser and the screen width — most of what can go wrong here is a layout that only
breaks at one size, or a pass that only disagrees at one latitude. A screenshot helps.
For a wrong prediction, include the location, the object and the time, so it can be
checked against the [Heavens-Above](https://www.heavens-above.com/) tables the physics
tests are pinned to.

## Proposing a change

1. **Open an issue first** and say what should be different for a person using the app.
2. **If it changes what the product does**, it is a SPEC change: a new or amended `FR-`
   requirement, and a Decision Log entry when it settles a question that could have gone
   another way. If it only changes how the product is built, it is a PLAN change.
3. **Then it is a task** — an entry in `TASKS.md` with a goal, the requirement ids it
   satisfies, its lane, its dependencies and a *done when* list that can be checked.
   `TASKS.md` is generated from the two documents, so it is not edited by hand except to
   check a task off.
4. **Then it is a branch**, one task per branch, with the task checked off on it.

Steps 2 and 3 are usually a separate pull request from step 4: the documents land first,
the code lands against them.

## What a pull request has to clear

- `npm test`, `npm run lint` and `npm run typecheck` pass, and CI is green inside its ten
  minute budget.
- Every acceptance criterion the task names has a test. Physics changes pass the golden
  fixtures unchanged; if a golden value has to move, the pull request says why.
- No test is changed to make a change pass.
- Plain language in the code, the docs and the commit message. No emoji, no trailers.

## What this repository is not looking for

Refactors with no requirement behind them, dependency bumps that are not fixing
something, and new features that have not been through the spec. The app is deliberately
small: one page, no backend, no accounts, no analytics.

By contributing you agree that your contribution is licensed under the
[MIT licence](LICENSE) that covers the rest of the repository.
