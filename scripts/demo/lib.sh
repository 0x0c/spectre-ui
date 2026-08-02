#!/usr/bin/env bash
# Shared helpers for scripts/demo/*.sh. Sourced, not executed directly.

demo_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

demo_log() {
  printf '\033[1;34m==>\033[0m %s\n' "$1"
}

demo_warn() {
  printf '\033[1;33m!!\033[0m %s\n' "$1" >&2
}

demo_die() {
  printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2
  exit 1
}

demo_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || demo_die "'$1' is required but not on PATH. $2"
}
