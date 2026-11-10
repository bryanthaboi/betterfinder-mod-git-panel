import { ui, fs, locations, process, log } from "betterfinder";
import type { ActivateHandler, LocationChangedHandler, CommandRunHandler, CommandResult, FileRef, UINode } from "betterfinder";

const PANEL = "git";
const STATUS_ITEM = "branch";
const MAX_BRANCHES = 128;
const GIT = "/usr/bin/git";

const IGNORE_SCRIPT = [
  'mode=$1; shift',
  'for p; do',
  'd=$(dirname "$p"); b=$(basename "$p")',
  'top=$(git -C "$d" rev-parse --show-toplevel) || exit 2',
  'pre=$(git -C "$d" rev-parse --show-prefix)',
  'e=$(printf "%s" "/$pre$b" | sed "s/[][*?\\\\]/\\\\\\\\&/g")',
  '[ -d "$p" ] && e="$e/"',
  'if [ "$mode" = exclude ]; then f=$(git -C "$d" rev-parse --git-path info/exclude); case $f in /*) ;; *) f="$d/$f";; esac; mkdir -p "$(dirname "$f")"; else f="$top/.gitignore"; fi',
  'grep -qxF -- "$e" "$f" 2>/dev/null && continue',
  '[ -s "$f" ] && [ -n "$(tail -c1 "$f")" ] && echo >> "$f"',
  'printf "%s\\n" "$e" >> "$f"; echo "$e"',
  'done',
].join("\n");

interface Remote { name: string; url: string; }
interface Upstream { branch: string; remote: string; }
interface Repo {
  path: string;
  branch: string;
  detached: boolean;
  sha: string;
  branches: string[];
  remotes: Remote[];
  upstream: string;
  state: string;
}
interface Look { folder?: FileRef; repo?: Repo; linked: boolean; }

interface Change { code: string; path: string; }
interface Status {
  path: string;
  sync: string;
  staged: Change[];
  changed: Change[];
  untracked: Change[];
  conflicts: Change[];
  commits: string[];
  failure: string;
}

let lastStatus: Status | undefined = undefined;
let lastError = "";

async function findChild(dir: FileRef, name: string): Promise<FileRef | undefined> {
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 4; page++) {
    const result = await fs.list(dir, 128, "name", cursor);
    for (const entry of result.entries) if (entry.name === name) return entry;
    if (!result.cursor) return undefined;
    cursor = result.cursor;
  }
  return undefined;
}

function pick(entries: FileRef[], name: string): FileRef | undefined {
  for (const entry of entries) if (entry.name === name) return entry;
  return undefined;
}

function parseConfig(text: string): { remotes: Remote[]; upstreams: Upstream[] } {
  const remotes: Remote[] = [];
  const upstreams: Upstream[] = [];
  let section = "";
  let name = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const header = /^\[([A-Za-z0-9.-]+)(?:\s+"(.*)")?\]$/.exec(line);
    if (header) {
      section = (header[1] || "").toLowerCase();
      name = header[2] || "";
      continue;
    }
    const pair = /^([A-Za-z0-9-]+)\s*=\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = (pair[1] || "").toLowerCase();
    const value = pair[2] || "";
    if (section === "remote" && key === "url") remotes.push({ name: name, url: value });
    if (section === "branch" && key === "remote") upstreams.push({ branch: name, remote: value });
  }
  return { remotes: remotes, upstreams: upstreams };
}

function shortUrl(url: string): string {
  return url.replace(/^[a-z+]+:\/\//, "").replace(/^[^@\/]*@/, "").replace(/\.git$/, "");
}

async function readRepo(folder: FileRef): Promise<Look> {
  const dotGit = await findChild(folder, ".git");
  if (!dotGit) return { folder: folder, linked: false };
  if (dotGit.kind !== "folder") return { folder: folder, linked: true };
  const entries = (await fs.list(dotGit, 128, "name")).entries;
  const headFile = pick(entries, "HEAD");
  if (!headFile) return { folder: folder, linked: false };
  const head = (await fs.readText(headFile, 4096)).trim();
  const prefix = "ref: refs/heads/";
  const detached = !head.startsWith(prefix);
  const branch = detached ? "" : head.slice(prefix.length);
  let sha = detached ? head : "";

  const names: string[] = [];
  const packedFile = pick(entries, "packed-refs");
  if (packedFile) {
    const packed = await fs.readText(packedFile, 512 * 1024);
    for (const line of packed.split("\n")) {
      const match = /^([0-9a-f]{40,64}) refs\/heads\/(.+)$/.exec(line);
      if (!match) continue;
      const refName = match[2] || "";
      names.push(refName);
      if (refName === branch) sha = match[1] || "";
    }
  }
  const refs = pick(entries, "refs");
  const heads = refs ? await findChild(refs, "heads") : undefined;
  if (heads) {
    const queue: { dir: FileRef; prefix: string }[] = [{ dir: heads, prefix: "" }];
    for (let visited = 0; visited < 10 && queue.length > 0; visited++) {
      const next = queue.shift();
      if (!next) break;
      const listed = await fs.list(next.dir, 128, "name");
      for (const entry of listed.entries) {
        const refName = next.prefix + entry.name;
        if (entry.kind === "folder") {
          queue.push({ dir: entry, prefix: refName + "/" });
          continue;
        }
        if (entry.kind !== "file") continue;
        if (names.indexOf(refName) < 0) names.push(refName);
        if (refName === branch) sha = (await fs.readText(entry, 256)).trim();
      }
    }
  }
  names.sort();

  let remotes: Remote[] = [];
  let upstream = "";
  const configFile = pick(entries, "config");
  if (configFile) {
    const config = parseConfig(await fs.readText(configFile, 128 * 1024));
    remotes = config.remotes;
    for (const item of config.upstreams) if (item.branch === branch) upstream = item.remote + "/" + branch;
  }

  let state = "";
  if (pick(entries, "MERGE_HEAD")) state = "merge in progress";
  else if (pick(entries, "rebase-merge") || pick(entries, "rebase-apply")) state = "rebase in progress";
  else if (pick(entries, "CHERRY_PICK_HEAD")) state = "cherry-pick in progress";
  else if (pick(entries, "REVERT_HEAD")) state = "revert in progress";
  else if (pick(entries, "BISECT_LOG")) state = "bisect in progress";

  return {
    folder: folder,
    linked: false,
    repo: { path: folder.path || "", branch: branch, detached: detached, sha: sha, branches: names, remotes: remotes, upstream: upstream, state: state },
  };
}

async function look(): Promise<Look> {
  const location = await locations.current();
  if (!location.folder) return { linked: false };
  try {
    return await readRepo(location.folder);
  } catch (error) {
    await log.write("warn", "could not read repository: " + String(error));
    return { folder: location.folder, linked: false };
  }
}

function shortPath(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const parts = trimmed.split("/");
  const tail = parts.slice(-2).join("/") + (path.endsWith("/") ? "/" : "");
  return parts.length > 2 ? "…/" + tail : tail;
}

function changeGroup(title: string, changes: Change[], into: UINode[]): void {
  if (changes.length === 0) return;
  into.push({ type: "text", text: title + " (" + changes.length + ")", style: "secondary", label: title + ", " + changes.length + " files" });
  const lines = changes.slice(0, 40).map(change => change.code + "  " + shortPath(change.path));
  if (changes.length > 40) lines.push("…and " + (changes.length - 40) + " more");
  into.push({ type: "text", text: lines.join("\n"), style: "monospaced", label: title + ": " + changes.map(change => change.path).slice(0, 40).join(", ") });
}

function statusNodes(status: Status): UINode[] {
  const nodes: UINode[] = [{ type: "divider" }];
  if (status.failure) {
    nodes.push({ type: "text", text: status.failure, style: "secondary", label: "Git status failed: " + status.failure });
    return nodes;
  }
  const total = status.staged.length + status.changed.length + status.untracked.length + status.conflicts.length;
  nodes.push({ type: "text", text: total === 0 ? "Working tree clean" : total + (total === 1 ? " change" : " changes"), style: "title", label: total === 0 ? "Working tree clean" : total + " changes" });
  if (status.sync) nodes.push({ type: "text", text: status.sync, style: "secondary", label: "Compared to upstream: " + status.sync });
  changeGroup("Conflicts", status.conflicts, nodes);
  changeGroup("Staged", status.staged, nodes);
  changeGroup("Changed", status.changed, nodes);
  changeGroup("Untracked", status.untracked, nodes);
  if (status.commits.length > 0) {
    nodes.push({ type: "text", text: "Recent commits", style: "secondary", label: "Recent commits" });
    nodes.push({ type: "text", text: status.commits.join("\n"), style: "monospaced", label: "Recent commits: " + status.commits.join(", ") });
  }
  return nodes;
}

function actionRow(): UINode {
  return { type: "hstack", children: [
    { type: "button", id: "status", text: "Status", icon: "list.bullet", label: "Run git status", command: "status" },
    { type: "button", id: "refresh", text: "Refresh", icon: "arrow.clockwise", label: "Refresh git info", command: "refresh" },
  ] };
}

function render(seen: Look): UINode {
  const repo = seen.repo;
  const folderPath = seen.folder ? seen.folder.path || "" : "";
  const status = lastStatus && lastStatus.path === folderPath ? lastStatus : undefined;
  const children: UINode[] = [];
  if (!repo) {
    if (!seen.folder) children.push({ type: "text", text: "Not a local folder", style: "secondary", label: "Git status" });
    else if (seen.linked) children.push({ type: "text", text: "Linked worktree or submodule. Its git data lives elsewhere.", style: "secondary", label: "Git status" });
    else children.push({ type: "text", text: "No .git folder here. Open a repository's top folder for branch info.", style: "secondary", label: "Git status" });
    if (seen.folder) {
      children.push({ type: "button", id: "status", text: "Git Status", icon: "list.bullet", label: "Run git status in this folder", command: "status" });
      if (status) for (const node of statusNodes(status)) children.push(node);
    }
    return { type: "vstack", children: children };
  }

  const title = repo.detached ? "detached at " + repo.sha.slice(0, 7) : repo.branch;
  const facts: string[] = [];
  if (!repo.detached && repo.sha) facts.push(repo.sha.slice(0, 7));
  if (!repo.detached && !repo.sha) facts.push("no commits yet");
  if (repo.upstream) facts.push("tracks " + repo.upstream);
  children.push({ type: "text", text: "⎇ " + title, style: "title", label: "Current branch " + title });
  if (facts.length > 0) children.push({ type: "text", text: facts.join(" · "), style: "secondary", label: "Commit " + facts.join(", ") });
  for (const remote of repo.remotes) {
    children.push({ type: "text", text: remote.name + "  " + shortUrl(remote.url), style: "secondary", label: "Remote " + remote.name });
  }
  if (repo.state) children.push({ type: "text", text: "⚠ " + repo.state, label: repo.state });
  if (lastError) children.push({ type: "text", text: "⚠ " + lastError, label: "Last git error: " + lastError });
  children.push({ type: "divider" });

  const shown = repo.branches.slice(0, MAX_BRANCHES);
  const items = shown.map(name => ({ id: name, title: name }));
  if (repo.detached) items.unshift({ id: "", title: "detached at " + repo.sha.slice(0, 7) });
  children.push({ type: "text", text: "Branch", style: "secondary", label: "Branch" });
  if (items.length > 0) {
    children.push({ type: "select", id: "branch", label: "Switch branch", command: "switch-select", selected: repo.detached ? "" : repo.branch, items: items });
  }
  if (repo.branches.length > shown.length) {
    children.push({ type: "text", text: "+" + (repo.branches.length - shown.length) + " more not listed", style: "secondary", label: "More branches" });
  }
  children.push({ type: "hstack", children: [
    { type: "textField", id: "new-branch", placeholder: "new branch name", label: "New branch name", command: "create-branch" },
    { type: "button", id: "create", text: "Create", icon: "plus", label: "Create and switch to the new branch", command: "create-branch" },
  ] });
  children.push({ type: "divider" });
  children.push(actionRow());
  if (status) for (const node of statusNodes(status)) children.push(node);
  return { type: "vstack", children: children };
}

function statusText(seen: Look): string {
  const repo = seen.repo;
  return repo ? "⎇ " + (repo.detached ? repo.sha.slice(0, 7) : repo.branch) : "";
}

async function show(): Promise<Look> {
  const seen = await look();
  await ui.setPanel(PANEL, render(seen));
  await ui.setStatusText(STATUS_ITEM, statusText(seen));
  return seen;
}

function argText(args: unknown, field: string): string {
  if (!args || typeof args !== "object") return "";
  const record = args as { id?: unknown; value?: unknown; fields?: unknown };
  if (record.id === field && typeof record.value === "string") return record.value.trim();
  if (record.fields && typeof record.fields === "object") {
    const value = (record.fields as { [key: string]: unknown })[field];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function validBranch(name: string): boolean {
  return name.length > 0 && name.length <= 200 && !name.startsWith("-") && !/[\s~^:?*\[\\]/.test(name) && name.indexOf("..") < 0;
}

async function runGit(args: string[]): Promise<{ ok: boolean; text: string }> {
  try {
    const result = await process.run(GIT, args);
    const text = (result.stderr.trim() || result.stdout.trim()).split("\n").slice(-1)[0] || "";
    return { ok: result.exitCode === 0, text: text };
  } catch (error) {
    return { ok: false, text: "Not allowed" };
  }
}

async function switchTo(name: string, create: boolean): Promise<CommandResult> {
  const seen = await look();
  const path = seen.folder ? seen.folder.path || "" : "";
  if (!path) return { message: "No folder to run git in" };
  if (!validBranch(name)) {
    await show();
    return { message: create ? "Type a valid branch name first" : "Pick a branch" };
  }
  if (!create && seen.repo && !seen.repo.detached && seen.repo.branch === name) return {};
  const args = create ? ["-C", path, "switch", "-c", name] : ["-C", path, "switch", name];
  const result = await runGit(args);
  lastError = result.ok ? "" : result.text || "git switch failed";
  if (result.ok) lastStatus = undefined;
  await show();
  if (!result.ok) return { message: lastError };
  return { message: (create ? "Created " : "Switched to ") + name };
}

function parseStatus(path: string, output: string): Status {
  const status: Status = { path: path, sync: "", staged: [], changed: [], untracked: [], conflicts: [], commits: [], failure: "" };
  const marker = output.indexOf("@@log");
  const head = marker < 0 ? output : output.slice(0, marker);
  const tail = marker < 0 ? "" : output.slice(marker + 5);
  for (const line of head.split("\n")) {
    if (line.startsWith("## ")) {
      const bracket = /\[(.+)\]\s*$/.exec(line);
      const tracking = /\.\.\.(\S+)/.exec(line);
      if (bracket) status.sync = bracket[1] || "";
      else if (tracking) status.sync = "up to date with " + (tracking[1] || "");
      continue;
    }
    if (line.length < 4) continue;
    const x = line.charAt(0);
    const y = line.charAt(1);
    const file = line.slice(3);
    if (x === "?" && y === "?") status.untracked.push({ code: "?", path: file });
    else if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) status.conflicts.push({ code: "U", path: file });
    else {
      if (x !== " ") status.staged.push({ code: x, path: file });
      if (y !== " ") status.changed.push({ code: y, path: file });
    }
  }
  for (const line of tail.split("\n")) if (line.trim().length > 0) status.commits.push(line.trim());
  return status;
}

async function status(): Promise<CommandResult> {
  const seen = await look();
  const path = seen.folder ? seen.folder.path || "" : "";
  if (!path) return { message: "No folder to run git in" };
  try {
    const result = await process.run(GIT, ["-C", path, "status", "--porcelain=v1", "-b"]);
    let output = result.stdout;
    if (result.exitCode === 0) {
      const history = await process.run(GIT, ["-C", path, "log", "-5", "--pretty=format:%h %s (%cr)"]);
      if (history.exitCode === 0) output += "\n@@log\n" + history.stdout;
    }
    lastStatus = parseStatus(path, output);
    if (result.exitCode !== 0) lastStatus.failure = result.stderr.trim().split("\n")[0] || "Not a git repository";
  } catch (error) {
    return { message: "Not allowed" };
  }
  await show();
  return {};
}

async function ignore(mode: "gitignore" | "exclude", selection: FileRef[]): Promise<CommandResult> {
  const paths: string[] = [];
  for (const item of selection) if (item.path) paths.push(item.path);
  if (paths.length === 0) return { message: "Select files or folders first" };
  const target = mode === "exclude" ? ".git/info/exclude" : ".gitignore";
  try {
    const result = await process.run("/bin/sh", ["-c", IGNORE_SCRIPT, "sh", mode].concat(paths));
    if (result.exitCode !== 0) return { message: result.stderr.trim().split("\n").slice(-1)[0] || "Not inside a git repository" };
    const added = result.stdout.split("\n").filter(line => line.length > 0);
    if (added.length === 0) return { message: "Already in " + target };
    return { message: "Added " + (added.length === 1 ? added[0] : added.length + " entries") + " to " + target };
  } catch (error) {
    return { message: "Not allowed" };
  }
}

export const activate: ActivateHandler = async (context, input) => {
  await show();
};

export const locationChanged: LocationChangedHandler = async (context, input) => {
  lastError = "";
  await show();
};

export const command: CommandRunHandler = async (context, input) => {
  const id = input.commandId;
  if (id === "refresh") {
    await show();
    return {};
  }
  if (id === "status") return await status();
  if (id === "switch-select") return await switchTo(argText(input.args, "branch"), false);
  if (id === "create-branch") return await switchTo(argText(input.args, "new-branch"), true);
  if (id === "add-gitignore") return await ignore("gitignore", input.selection);
  if (id === "add-exclude") return await ignore("exclude", input.selection);
  return {};
};
