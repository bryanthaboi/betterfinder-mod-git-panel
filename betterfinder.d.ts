declare module "betterfinder" {
  export interface ModContext { readonly modID: string; readonly generation: number; }
  export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
  /** Decimal-string encoding of a 64-bit integer (sizes, offsets). */
  export type Int64String = string;
  /** Kind of a file system item. */
  export type FileKind = "file" | "folder" | "symlink" | "other";
  /** Effective window appearance. */
  export type Appearance = "light" | "dark";
  /** Why activate runs. */
  export type ActivateReason = "startup" | "enable" | "reload" | "update";
  /** Why deactivate runs. */
  export type DeactivateReason = "disable" | "uninstall" | "reload" | "update" | "shutdown";
  /** Log severity. */
  export type LogLevel = "debug" | "info" | "warn" | "error";
  /** Notification severity. */
  export type NotifyLevel = "info" | "warning" | "error";
  /** What initiated a file operation. */
  export type FileOpOrigin = "user" | "undo" | "retry" | "mod" | "automation";
  /** Committed per-item outcome. */
  export type FileOpStatus = "succeeded" | "failed" | "skipped" | "cancelled";
  /** A guarded file operation. */
  export type FileOperation = "copy" | "move" | "trash" | "rename";
  /** Before-hook verdict. */
  export type Decision = "allow" | "deny";
  /** Directory listing order. */
  export type SortOrder = "name" | "modifiedDescending" | "sizeDescending";
  /** Name conflict resolution. */
  export type ConflictPolicy = "fail" | "rename" | "skip";
  /** Archive container format. */
  export type ArchiveFormat = "zip" | "tarGz";
  /** Queued operation state. */
  export type OperationState = "queued" | "running" | "done" | "failed" | "cancelled";
  /** Native control a UINode maps to. */
  export type UINodeType = "vstack" | "hstack" | "text" | "markdown" | "button" | "list" | "progress" | "divider" | "textField" | "select";
  /** Look of a text node. */
  export type UITextStyle = "body" | "title" | "secondary" | "monospaced";
  /** Git working tree state of a path. */
  export type GitState = "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted";
  /** HTTP method. */
  export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** First argument of every hook. */
  export interface HookContext {
    modId: string;
    /** Registration generation; late replies are rejected. */
    generation: number;
    locale: string;
    appearance: Appearance;
    /** Remaining time budget. */
    deadlineMs: number;
  }
  /** Reference to a file. Optional fields are populated only when granted. */
  export interface FileRef {
    /** Opaque mod-scoped handle; valid only for the invocation or grant that produced it. */
    handle: string;
    name: string;
    kind: FileKind;
    /** Requires ui.selection level paths or a root grant. */
    path?: string;
    /** Requires metadata access. */
    size?: Int64String;
    /** ISO-8601; requires metadata access. */
    modified?: string;
  }
  /** One page of directory entries. */
  export interface DirectoryPage {
    entries: FileRef[];
    cursor?: string;
  }
  /** A ranged read. */
  export interface BytesChunk {
    base64: string;
    eof: boolean;
  }
  /** One cell value, keyed by item handle. */
  export interface ColumnValue {
    handle: string;
    text?: string;
    number?: number;
    sortKey?: string;
    label?: string;
  }
  /** Image header facts. */
  export interface ImageInfo {
    handle: string;
    width: number;
    height: number;
    format?: string;
  }
  /** A browsable location. */
  export interface LocationRef {
    id: string;
    title: string;
    provider?: string;
    /** The folder shown, from locations.current only. Its access follows the mod's grants: fs.write destination during a user gesture, otherwise fs.read/fs.write selection; with neither it is a reference only. */
    folder?: FileRef;
  }
  /** Row of a list node. */
  export interface UIListItem {
    id: string;
    title: string;
    subtitle?: string;
  }
  /** Data-only description of a native control tree. */
  export interface UINode {
    type: UINodeType;
    id?: string;
    text?: string;
    /** Accessibility label. */
    label?: string;
    /** Command run on press; for a textField, run on Return with args {id, value, fields}; for a select, run on change with the chosen item id as value; for a list, run on double-click with the row id as value. Buttons receive args {fields} with the panel's current text field and select values. */
    command?: string;
    /** Look of a text node; body when omitted. */
    style?: UITextStyle;
    /** SF Symbol name drawn on a button. */
    icon?: string;
    /** Item id a select shows as chosen; the first item when omitted. */
    selected?: string;
    /** Placeholder of a textField; text is its initial value. */
    placeholder?: string;
    value?: number;
    children?: UINode[];
    items?: UIListItem[];
  }
  /** activate input. */
  export interface ActivateInput {
    reason: ActivateReason;
    previousVersion?: string;
  }
  /** deactivate input. */
  export interface DeactivateInput {
    reason: DeactivateReason;
  }
  /** selection.changed input. */
  export interface SelectionChangedInput {
    revision: number;
    count: number;
    items: FileRef[];
  }
  /** location.changed input. */
  export interface LocationChangedInput {
    revision: number;
    location: LocationRef;
  }
  /** theme.changed input. */
  export interface ThemeChangedInput {
    name: string;
    appearance: Appearance;
  }
  /** settings.changed input. */
  export interface SettingsChangedInput {
    changed: string[];
    values: JSONValue;
  }
  /** command.run input. */
  export interface CommandRunInput {
    commandId: string;
    selection: FileRef[];
    args?: JSONValue;
  }
  /** command.run result; message is shown as a toast. */
  export interface CommandResult {
    message?: string;
    operationId?: string;
  }
  /** column.values input; at most 128 items per call. */
  export interface ColumnValuesInput {
    column: string;
    items: FileRef[];
    revision: number;
  }
  /** search.query input. */
  export interface SearchQueryInput {
    provider: string;
    query: string;
    limit: number;
    cursor?: string;
    scope?: FileRef;
  }
  /** One search hit. */
  export interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    handle?: string;
  }
  /** A page of search results. */
  export interface SearchBatch {
    results: SearchResult[];
    done: boolean;
    cursor?: string;
  }
  /** preview.render input. */
  export interface PreviewRenderInput {
    provider: string;
    item: FileRef;
    maxBytes: number;
    appearance: Appearance;
  }
  /** preview.render result. */
  export interface PreviewResult {
    title?: string;
    node: UINode;
  }
  /** location.list input. */
  export interface LocationListInput {
    location: string;
    /** Virtual path; empty for the root. */
    path: string;
    limit: number;
    cursor?: string;
  }
  /** Entry of a provided location. */
  export interface ResourceEntry {
    id: string;
    name: string;
    kind: FileKind;
    size?: Int64String;
    modified?: string;
  }
  /** location.list result. */
  export interface LocationPage {
    items: ResourceEntry[];
    cursor?: string;
  }
  /** One item of an operation. */
  export interface FileOpItem {
    itemId: string;
    source: FileRef;
    destinationName?: string;
  }
  /** fileop.before.* input. */
  export interface FileOpBeforeInput {
    operationId: string;
    attemptId: string;
    origin: FileOpOrigin;
    operation: FileOperation;
    items: FileOpItem[];
  }
  /** fileop.before.* result. */
  export interface OperationDecision {
    decision: Decision;
    reason?: string;
  }
  /** Committed outcome for one item. */
  export interface FileOpOutcome {
    itemId: string;
    source: FileRef;
    status: FileOpStatus;
    error?: string;
  }
  /** fileop.after.* input. */
  export interface FileOpAfterInput {
    operationId: string;
    attemptId: string;
    origin: FileOpOrigin;
    operation: FileOperation;
    partial: boolean;
    outcomes: FileOpOutcome[];
  }
  /** Queued operation identity. */
  export interface OperationTicket {
    operationId: string;
  }
  /** Progress of a queued operation. */
  export interface OperationStatus {
    operationId: string;
    state: OperationState;
    completed: number;
    total: number;
  }
  /** One HTTP header. */
  export interface HttpHeader {
    name: string;
    value: string;
  }
  /** Outgoing request; must match a granted endpoint. */
  export interface NetRequest {
    url: string;
    method: HttpMethod;
    headers?: HttpHeader[];
    body?: string;
    timeoutMs?: number;
    /** Credential handle from credentials.request. */
    credential?: string;
  }
  /** Incoming response; bodies are capped by the grant. */
  export interface NetResponse {
    status: number;
    headers: HttpHeader[];
    body: string;
  }
  /** Opaque destination-bound Keychain credential. */
  export interface CredentialHandle {
    handle: string;
    destination: string;
  }
  /** Credential metadata without secret material. */
  export interface CredentialInfo {
    name: string;
    destination: string;
  }
  /** One changed path. */
  export interface GitStatusEntry {
    path: string;
    state: GitState;
  }
  /** Curated git status result. */
  export interface GitStatus {
    branch?: string;
    entries: GitStatusEntry[];
  }
  /** Result of an unrestricted process. */
  export interface ProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
  }
  export namespace commands {
    function run(commandId: string, args?: JSONValue): Promise<CommandResult | null>;
    function setEnabled(commandId: string, enabled: boolean): Promise<void>;
  }
  export namespace credentials {
    function list(): Promise<CredentialInfo[]>;
    function request(name: string, destination: string): Promise<CredentialHandle | null>;
  }
  export namespace events {
    function delay(ms: number): Promise<void>;
    function supports(name: string, version: number): Promise<boolean>;
  }
  export namespace fs {
    function list(directory: FileRef, limit: number, order: SortOrder, cursor?: string): Promise<DirectoryPage>;
    function mkdir(directory: FileRef, name: string): Promise<FileRef>;
    function readBytes(item: FileRef, offset: Int64String, length: number): Promise<BytesChunk>;
    function readText(item: FileRef, maxBytes: number): Promise<string>;
    function root(rootId: string): Promise<FileRef | null>;
    function stat(item: FileRef): Promise<FileRef>;
    function walk(directory: FileRef, maxDepth: number, limit: number, cursor?: string): Promise<DirectoryPage>;
    function writeText(directory: FileRef, name: string, text: string, conflict: ConflictPolicy): Promise<FileRef>;
  }
  export namespace locations {
    function current(): Promise<LocationRef>;
    function open(location: string, path: string): Promise<void>;
    function refresh(location: string): Promise<void>;
  }
  export namespace log {
    function write(level: LogLevel, message: string, fields?: JSONValue): Promise<void>;
  }
  export namespace media {
    function imageDimensions(items: FileRef[]): Promise<ColumnValue[]>;
    function imageInfo(items: FileRef[]): Promise<ImageInfo[]>;
  }
  export namespace net {
    function fetch(request: NetRequest): Promise<NetResponse>;
  }
  export namespace operations {
    function cancel(operationId: string): Promise<boolean>;
    function copy(items: FileRef[], destination: FileRef, conflict: ConflictPolicy): Promise<OperationTicket>;
    function move(items: FileRef[], destination: FileRef, conflict: ConflictPolicy): Promise<OperationTicket>;
    function rename(item: FileRef, newName: string): Promise<OperationTicket>;
    function status(operationId: string): Promise<OperationStatus>;
    function trash(items: FileRef[]): Promise<OperationTicket>;
  }
  export namespace preview {
    function invalidate(provider: string): Promise<void>;
    function refresh(provider: string, item: FileRef): Promise<void>;
  }
  export namespace process {
    function run(executable: string, args: string[], cwd?: FileRef): Promise<ProcessResult>;
  }
  export namespace process.archive {
    function create(items: FileRef[], destination: FileRef, name: string, format: ArchiveFormat): Promise<OperationTicket>;
  }
  export namespace process.git {
    function status(root: FileRef): Promise<GitStatus>;
  }
  export namespace search {
    function files(query: string, root: FileRef, limit: number, cursor?: string): Promise<SearchBatch>;
  }
  export namespace settings {
    function get(key: string): Promise<JSONValue>;
    function getAll(): Promise<JSONValue>;
    function set(key: string, value: JSONValue): Promise<void>;
  }
  export namespace storage {
    function remove(key: string): Promise<void>;
    function get(key: string): Promise<JSONValue>;
    function keys(): Promise<string[]>;
    function set(key: string, value: JSONValue): Promise<void>;
  }
  export namespace ui {
    function notify(message: string, level: NotifyLevel): Promise<void>;
    function pickDestination(prompt: string): Promise<FileRef | null>;
    function setPanel(panelId: string, node: UINode): Promise<void>;
    function setStatusText(itemId: string, text: string): Promise<void>;
    function setToolbarItemState(itemId: string, enabled: boolean, title?: string): Promise<void>;
  }
  export type ActivateHandler = (context: HookContext, input: ActivateInput) => Promise<void>;
  export type ColumnValuesHandler = (context: HookContext, input: ColumnValuesInput) => Promise<ColumnValue[]>;
  export type CommandRunHandler = (context: HookContext, input: CommandRunInput) => Promise<CommandResult>;
  export type DeactivateHandler = (context: HookContext, input: DeactivateInput) => Promise<void>;
  export type FileopAfterCopyHandler = (context: HookContext, input: FileOpAfterInput) => Promise<void>;
  export type FileopAfterMoveHandler = (context: HookContext, input: FileOpAfterInput) => Promise<void>;
  export type FileopAfterRenameHandler = (context: HookContext, input: FileOpAfterInput) => Promise<void>;
  export type FileopAfterTrashHandler = (context: HookContext, input: FileOpAfterInput) => Promise<void>;
  export type FileopBeforeCopyHandler = (context: HookContext, input: FileOpBeforeInput) => Promise<OperationDecision>;
  export type FileopBeforeMoveHandler = (context: HookContext, input: FileOpBeforeInput) => Promise<OperationDecision>;
  export type FileopBeforeRenameHandler = (context: HookContext, input: FileOpBeforeInput) => Promise<OperationDecision>;
  export type FileopBeforeTrashHandler = (context: HookContext, input: FileOpBeforeInput) => Promise<OperationDecision>;
  export type LocationChangedHandler = (context: HookContext, input: LocationChangedInput) => Promise<void>;
  export type LocationListHandler = (context: HookContext, input: LocationListInput) => Promise<LocationPage>;
  export type PreviewRenderHandler = (context: HookContext, input: PreviewRenderInput) => Promise<PreviewResult>;
  export type SearchQueryHandler = (context: HookContext, input: SearchQueryInput) => Promise<SearchBatch>;
  export type SelectionChangedHandler = (context: HookContext, input: SelectionChangedInput) => Promise<void>;
  export type SettingsChangedHandler = (context: HookContext, input: SettingsChangedInput) => Promise<void>;
  export type ThemeChangedHandler = (context: HookContext, input: ThemeChangedInput) => Promise<void>;
}
