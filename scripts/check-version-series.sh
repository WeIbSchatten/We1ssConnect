#!/usr/bin/env bash
# Fails unless a client version shares MAJOR.MINOR with the We1ssBoard panel on main: the
# clients follow the panel's release series, while patch versions stay independent.
# Usage: scripts/check-version-series.sh 1.9.0  (PANEL_VERSION=1.9.1 skips the download)
set -euo pipefail

version="${1#v}"
panel="${PANEL_VERSION:-$(curl -fsSL https://raw.githubusercontent.com/WeIbSchatten/We1ssBoard/main/internal/config/version)}"
panel="$(echo "$panel" | tr -d '[:space:]')"

series() { echo "$1" | cut -d. -f1,2; }

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "::error::Version '$version' is not MAJOR.MINOR.PATCH" >&2
    exit 1
fi
if [[ "$(series "$version")" != "$(series "$panel")" ]]; then
    echo "::error::We1ssConnect $version is not in the panel's $(series "$panel").x series (We1ssBoard $panel). Use $(series "$panel").<patch>." >&2
    exit 1
fi
echo "We1ssConnect $version follows We1ssBoard $panel ($(series "$panel").x)"
