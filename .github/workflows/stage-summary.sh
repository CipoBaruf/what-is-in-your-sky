#!/usr/bin/env bash
# FR-CI-1 (R37): the stage table `stage.sh` recorded, written to the job summary.
#
# Usage: bash .github/workflows/stage-summary.sh <title>
# Reads $STAGE_TIMES; $UNIT, $E2E and $WHY (D-1031's selection) are optional.
set -uo pipefail

touch "${STAGE_TIMES:?stage-summary.sh needs STAGE_TIMES}"
{
  echo "## CI stages — $1"
  echo
  if [ -n "${E2E:-}" ]; then
    echo "Tests run (D-1031): unit **${UNIT:-}**, e2e **$E2E** — ${WHY:-}"
    echo
  fi
  echo "| stage | wall time | |"
  echo "|---|---:|---|"
  awk -F'\t' '
    { total += $2; printf "| %s | %d:%02d | %s |\n", $1, $2 / 60, $2 % 60, ($3 == 0 ? "" : "failed") }
    END { printf "| **total** | **%d:%02d** | budget %s:00 (FR-CI-1) |\n", total / 60, total % 60, ENVIRON["CI_PR_BUDGET_MIN"] }
  ' "$STAGE_TIMES"
} >>"${GITHUB_STEP_SUMMARY:?}"
