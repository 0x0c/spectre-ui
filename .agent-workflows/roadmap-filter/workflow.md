# Roadmap status filter

Survey the roadmap by `Status`. This workflow is **read-only**: it prints one table so you can pick
the items to open in full. It never authors, implements, or edits an item.

## What it does

Every roadmap item under `roadmaps/` carries its own `Status` in the metadata block of its English
file, and that field is the single source of truth for how far along the item is. When you need the
items in one status, query those files directly rather than reading the index wholesale.

```bash
STATUS="Proposal"
for f in roadmaps/SU-*/SU-*.md; do
  case "$f" in *-ja.md) continue ;; esac
  grep -q "^| Status | \*\*${STATUS}\*\* |" "$f" || continue
  printf '%s\t%s\t%s\n' \
    "$(basename "$(dirname "$f")" | cut -d- -f1-2)" \
    "$(grep -m1 '^# ' "$f" | sed 's/^# //')" \
    "$f"
done | sort
```

The loop skips the `-ja.md` mirrors, whose metadata says the same thing in Japanese, so each item is
reported once.

`STATUS` is one of:

- `Proposal` — open, not yet started
- `In progress` — being built
- `Implemented` — shipped
- `Proposal (deferred)` — deliberately parked

The query is pure and offline: it reads each item's own metadata, with no network and no other
source of truth. Because the repository is still in its design phase, every item is currently
`Proposal`.

## Output

Three tab-separated columns:

| Column | Meaning |
|---|---|
| `ID` | the item's `SU-NNNN` |
| `Item` | the item's title, taken from its top-level heading |
| `Path` | the relative path to the item's English file |

## How to use it

1. Run the query for the status you care about.
2. Read the table to find the items relevant to the task.
3. **Open the file at the `Path`** to get the full proposal text — that column is exactly what to
   open next. For the Japanese mirror, swap the `.md` suffix for `-ja.md`.

Keep the survey narrow: pull only the status you need, then open only the items that matter. That is
the whole point of the filter over reading the index wholesale.
