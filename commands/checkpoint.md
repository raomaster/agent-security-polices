---
description: "Create a labeled safety checkpoint (git stash) before a risky operation — invoke this manually when you know a large or destructive change is coming"
---

Create a named git stash checkpoint so you can safely roll back to this exact state if needed.

$ARGUMENTS (optional: label for the checkpoint; defaults to a timestamp)

## Process

### 1. Check for existing checkpoints

```bash
echo "=== Existing asp-checkpoints ==="
git stash list | grep "asp-checkpoint" | nl -v 0 || echo "(no checkpoints yet)"
```

### 2. Show current state

Show what will be captured in the checkpoint:

```bash
echo "=== Current working tree state ==="
git status --short

echo ""
echo "=== Uncommitted changes summary ==="
git diff --stat 2>/dev/null || echo "(no changes)"

echo ""
echo "=== Current branch and recent commits ==="
git log --oneline -5
```

### 3. Determine the checkpoint label

```bash
# Use $ARGUMENTS as label, or generate timestamp
LABEL="${ARGUMENTS:-$(date +%Y%m%d-%H%M%S)}"
STASH_MSG="asp-checkpoint: ${LABEL}"
echo "Checkpoint label: ${LABEL}"
```

### 4. Create the checkpoint

> **Important:** This stash captures ALL uncommitted changes (both staged and unstaged).
> Committed work is already in git history and does not need to be stashed.

If there are uncommitted changes:
```bash
git stash push --include-untracked -m "asp-checkpoint: ${LABEL}"
echo "Checkpoint created: asp-checkpoint: ${LABEL}"
git stash pop  # Restore working tree — stash is kept as a safety copy
```

> Note: `git stash pop` restores the working tree immediately after creating the stash.
> The stash remains as a recoverable backup while you continue working.
> If there are no uncommitted changes, create a checkpoint from the current HEAD instead:

```bash
# No uncommitted changes — checkpoint is just a reference to current HEAD
git log --oneline -1
echo "Checkpoint: HEAD is clean at $(git rev-parse --short HEAD)"
echo "Use /rollback with commit hash or branch name to return here if needed"
```

### 5. Confirm checkpoint is saved

```bash
echo ""
echo "=== Available checkpoints after creation ==="
git stash list | grep "asp-checkpoint" | head -5
echo ""
echo "Checkpoint ready. Proceed with your task."
echo "Run /rollback to return to this state if needed."
```

### 6. Notes for the agent

- This checkpoint saves the CURRENT state of all uncommitted files
- Use `/rollback` to restore this checkpoint later
- Checkpoints are local to this git repository — they are not pushed to remote
- If working on committed code only (clean working tree), the checkpoint is implicit in git history
- Checkpoints accumulate — run `git stash list | grep asp-checkpoint` to see all
