# CoolSheet PVT — Team Git Workflow

How the two of us pull, push, and work on this repo together without breaking each other's work.

**Repo:** https://github.com/coolsheet-pvt/coolsheet-pvt.github.io
**Live site:** https://coolsheet-pvt.github.io

---

## One-time setup (each person, first time only)

Clone the repo to your computer:

```bash
git clone https://github.com/coolsheet-pvt/coolsheet-pvt.github.io.git
cd coolsheet-pvt.github.io
```

(Mike's copy already lives at `C:\Users\MIKE-PC\Desktop\PVT-Calculator`.)

---

## The Golden Rule

**Always `git pull` before you start working, and `git push` when you're done.**

This alone prevents 90% of problems.

---

## Everyday workflow (different files — the easy case)

If you're confident you're not editing the same file as the other person at the same time:

```bash
# 1. Get the latest code
git pull

# 2. ...make your changes...

# 3. Save your changes to the repo
git add .
git commit -m "Short description of what you changed"
git push
```

That's it.

---

## Working on the same files at the same time (use branches)

When you're both going to be editing the same files, each person works on their **own branch** so you never overwrite each other.

### Mike
```bash
git checkout main
git pull
git checkout -b mike/what-im-doing
# ...make changes...
git add .
git commit -m "What I changed"
git push -u origin mike/what-im-doing
```

### Friend
```bash
git checkout main
git pull
git checkout -b friend/what-im-doing
# ...make changes...
git add .
git commit -m "What I changed"
git push -u origin friend/what-im-doing
```

Branch naming: `yourname/short-description` (e.g. `mike/edit-mains-temp`, `dan/fix-economics`).

### Merging a branch into main
1. Go to the repo on GitHub.
2. You'll see a yellow banner — click **"Compare & pull request"**.
3. Click **"Merge pull request"**.
4. Everyone updates their local main afterwards:
   ```bash
   git checkout main
   git pull
   ```

---

## Merge conflicts (Mike handles these)

A conflict happens when you both change the **same lines** of the same file. Git can't decide which version wins, so it stops and marks the file like this:

```
<<<<<<< HEAD
   your version of the line
=======
   the other version of the line
>>>>>>> branch-name
```

**The plan: Mike resolves all conflicts in Claude Code.**

If you hit a conflict on your machine and you're not sure, **don't force it** — just tell Mike, and he'll pull the branches together and have Claude Code resolve it cleanly.

### How Mike resolves a conflict
```bash
git checkout main
git pull
git merge friend/their-branch     # conflict appears here
```
Then in Claude Code: *"I have a merge conflict, fix it."*
Claude reads both versions, merges them correctly, and Mike finishes with:
```bash
git add .
git commit -m "Resolve merge conflict"
git push
```

---

## Quick reference

| I want to... | Command |
|---|---|
| Get latest code | `git pull` |
| See what I've changed | `git status` |
| Save + upload my changes | `git add .` then `git commit -m "msg"` then `git push` |
| Start a new branch | `git checkout -b yourname/description` |
| Switch back to main | `git checkout main` |
| Upload a new branch | `git push -u origin branch-name` |

---

## Important rules for this project

- **Do NOT edit** the thermal **Model A** (simple linear) or **Model B** (ISO 9806) — another student's work. Read/test only.
- The PV/irradiance "supply side" (geometry, transposition, PV electrical) **is** fine to change.
- Azimuth convention: **0° = NORTH-facing**, 180° = SOUTH. Default tilt 30, azimuth 0.
- When unsure about a conflict, **stop and ask Mike** rather than guessing.
