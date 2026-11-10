# betterfinder-mod-git-panel

[![release](https://img.shields.io/github/v/release/bryanthaboi/betterfinder-mod-git-panel)](https://github.com/bryanthaboi/betterfinder-mod-git-panel/releases)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![betterfinder](https://img.shields.io/badge/betterfinder-mod-8a5cf6)](https://github.com/bryanthaboi/betterfinder)

git info for the repo ur looking at. branch in the status bar, a side panel w a branch switcher, and right click to ignore stuff.

## what u get

- status bar shows the current branch. click it to open the panel
- panel: branch, commit, upstream, remotes, and a warning if a merge or rebase is mid-flight
- branch dropdown to switch, plus a field to create a new one
- status button: conflicts, staged, changed and untracked files, and the last few commits
- right click `Add to .gitignore`, or `Hide from Git (Local Only)` which writes `.git/info/exclude` and leaves `.gitignore` alone

## grants

- `ui`: panel, context menu, status bar
- `fs.read` (selection, recursive): reads `.git` in the folder ur viewing for branch and remote info
- `ui.selection` (paths): knows which repo and which items a git command is for
- `process.exec` (unrestricted): runs `git` to switch branches and read status, and `sh` to append ignore rules

branch info is read straight from `.git`, so browsing never prompts. anything that runs a program asks first. pick `Always Allow git` once and switching and status stop asking.

detection works at a repo's top folder. in a subfolder the panel offers a Git Status button instead.

needs a betterfinder build w `select` nodes and status bar `panel` links (v0.1.20 or newer).

## install

browse tab in betterfinder settings, or grab `git-panel.bfmod` from the [latest release](https://github.com/bryanthaboi/betterfinder-mod-git-panel/releases/latest). nothing turns on until u approve the grants.

## build it urself

```sh
betterfinder-mod validate .
betterfinder-mod package . --out git-panel.bfmod
```

mit. do whatever.
