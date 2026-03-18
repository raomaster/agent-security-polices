---
description: "Revert the project to a previous asp-checkpoint and discard changes made after it"
---

Revert the project to a previous checkpoint and discard the changes produced after it.

$ARGUMENTS (optional: checkpoint label or index; with no argument, show the list)

## Process

### 1. List available checkpoints

```bash
echo "=== Available asp-checkpoints ==="

if git rev-parse --is-inside-work-tree 2>/dev/null; then
  git stash list | grep "asp-checkpoint" | nl -v 0
  if [[ -z "$(git stash list | grep asp-checkpoint)" ]]; then
    echo "(no asp-checkpoints found)"
    echo ""
    echo "All git stashes (including non-checkpoint ones):"
    git stash list | head -10 || echo "(no stashes at all)"
  fi
else
  ls -lt .asp-checkpoints/ 2>/dev/null | grep -v log.json || echo "(no file-based checkpoints)"
fi
```

### 2. Show changes that will be lost

Before rolling back, show what will be discarded:

```bash
echo ""
echo "=== Changes that will be lost ==="
git diff --stat 2>/dev/null || echo "(no pending git changes)"
git status --short 2>/dev/null | grep "^?" || true
echo ""
echo "=== Recent commits on current branch ==="
git log --oneline -5
```

### 3. Confirm with the user

Ask for explicit confirmation before rolling back. Non-recoverable changes will be lost.

**Ask:** "The above changes will be discarded. Do you want to proceed with the rollback? (yes/no)"

If the user says no: abort and explain that no changes were made.

### 3a. Git stash rollback (by index)

If `$ARGUMENTS` is empty or a number:

```bash
STASH_IDX="${ARGUMENTS:-0}"

# Show what we are rolling back to
STASH_REF="stash@{$STASH_IDX}"
echo "Rolling back to: $(git stash list | sed -n "$((STASH_IDX + 1))p")"

# Discard current uncommitted changes
git checkout -- . 2>/dev/null || true
git clean -fd 2>/dev/null || true

# Restore the checkpoint
git stash pop "stash@{$STASH_IDX}"
echo "Rollback completed to checkpoint at index $STASH_IDX"
```

> `pop` restores and removes the checkpoint. Use `apply` instead if you want to keep it for future use.

### 3b. Roll back by label

If `$ARGUMENTS` is a string (checkpoint label):

```bash
LABEL="$ARGUMENTS"
STASH_REF=$(git stash list | grep "asp-checkpoint: $LABEL" | head -1 | cut -d: -f1)

if [[ -n "$STASH_REF" ]]; then
  echo "Rolling back to: asp-checkpoint: $LABEL ($STASH_REF)"
  git checkout -- . 2>/dev/null || true
  git clean -fd 2>/dev/null || true
  git stash pop "$STASH_REF"
  echo "Rolled back to: $LABEL"
else
  echo "Checkpoint '$LABEL' was not found"
  echo ""
  echo "Available checkpoints:"
  git stash list | grep "asp-checkpoint"
fi
```

### 3c. Rollback committed changes (git revert)

If the agent made commits that need to be undone (no stash available):

```bash
# Show recent commits to identify which ones were made by the agent
git log --oneline -10

# To revert the last N commits (creates new revert commits, safe and non-destructive):
# git revert HEAD~N..HEAD --no-edit

# To discard the last N commits entirely (destructive — only if commits are NOT pushed):
# git reset --hard HEAD~N
```

**Ask the user**: "Which commits should be reverted? Provide the commit hash or 'last N' where N is the number of commits to undo."

> Use `git revert` (creates inverse commit) over `git reset --hard` unless the commits have NOT been pushed to remote.

### 3d. File-based rollback (no git)

If the project has no git and uses file-based checkpoints at `.asp-checkpoints/`:

```bash
BACKUP_DIR=".asp-checkpoints/${ARGUMENTS:-$(ls -t .asp-checkpoints/ 2>/dev/null | grep -v log.json | head -1)}"

if [[ -d "$BACKUP_DIR" ]]; then
  rsync -a --delete \
    --exclude='.asp-checkpoints/' \
    "$BACKUP_DIR/" \
    .
  echo "Rollback restored from: $BACKUP_DIR"
else
  echo "No file-based checkpoint found at: $BACKUP_DIR"
fi
```

### 4. Verify the state

```bash
echo ""
git status 2>/dev/null || echo "State restored"
echo ""
echo "Rollback complete. Project state restored to the selected checkpoint."
echo ""
echo "Remaining checkpoints:"
git stash list | grep "asp-checkpoint" | head -5
```

### 5. Next steps

- Understand why the agent's changes were not acceptable before retrying
- Improve the instructions or context before the next attempt
- If the next task is large or risky, run `/checkpoint` first as a safety net
- Consider splitting the task into smaller pieces if it failed due to complexity

> Rollback is cheaper than trying to repair bad agent output with additional prompts.
> Roll back first — improve the plan — then retry.
