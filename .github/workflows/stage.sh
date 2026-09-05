#!/usr/bin/env bash
# FR-CI-1 (R37): one stage of the CI job, timed.
#
# Every stage of `ci.yml` runs through here, so the job summary can say where
# the ten minutes went and the pull request that made CI slower is the one that
# shows it. A row is written whether the stage passed or failed — a stage that
# blew the budget is exactly the one worth timing — and the command's exit
# status is passed back on, so a red stage still fails the job.
#
# Usage: bash .github/workflows/stage.sh <name> <command> [args...]
# Rows go to $STAGE_TIMES (a TSV of name, seconds, exit status).
set -uo pipefail

name=$1
shift

start=$(date +%s)
"$@"
status=$?
end=$(date +%s)

printf '%s\t%s\t%s\n' "$name" "$((end - start))" "$status" >>"${STAGE_TIMES:?stage.sh needs STAGE_TIMES}"
exit "$status"
