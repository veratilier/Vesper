export const CODEX_APPROVAL_METHODS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
] as const;

export type CodexApprovalMethod = (typeof CODEX_APPROVAL_METHODS)[number];
export type CodexApprovalKind = "command" | "file" | "permissions";
export type RpcId = number | string;

export type PendingCodexApproval = {
  requestKey: string;
  rpcIds: RpcId[];
  method: CodexApprovalMethod;
  kind: CodexApprovalKind;
  threadId: string;
  turnId: string;
  itemId: string;
  title: string;
  summary: string;
  targetLabel: string;
  target: string;
  detailLabel: string;
  detail: string;
  permissions?: Record<string, unknown>;
};

export type CodexApprovalRequest = {
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

function describePermissions(permissions: Record<string, unknown>) {
  const lines: string[] = [];
  const fileSystem = record(permissions.fileSystem);
  const network = record(permissions.network);
  const read = Array.isArray(fileSystem.read) ? fileSystem.read.filter((item): item is string => typeof item === "string") : [];
  const write = Array.isArray(fileSystem.write) ? fileSystem.write.filter((item): item is string => typeof item === "string") : [];
  const entries = Array.isArray(fileSystem.entries) ? fileSystem.entries : [];
  if (read.length) lines.push(`读取文件：${read.join("、")}`);
  if (write.length) lines.push(`写入文件：${write.join("、")}`);
  for (const entry of entries) {
    const candidate = record(entry);
    const path = record(candidate.path);
    const location = text(path.path) || text(path.pattern) || text(record(path.value).path) || text(record(path.value).kind);
    if (location) lines.push(`${text(candidate.access) || "访问"}：${location}`);
  }
  if (network.enabled === true) lines.push("网络访问");
  return lines.length ? lines.join("\n") : "未提供可显示的权限范围";
}

function describeCommandActions(actions: unknown) {
  if (!Array.isArray(actions)) return "";
  return actions.flatMap((entry) => {
    const action = record(entry);
    const command = text(action.command);
    const type = text(action.type);
    const path = text(action.path);
    const query = text(action.query);
    if (!command && !type) return [];
    return [`${type || "command"}${path ? ` · ${path}` : ""}${query ? ` · ${query}` : ""}${command ? `\n${command}` : ""}`];
  }).join("\n\n");
}

export function createCodexApprovalRequest(request: CodexApprovalRequest): PendingCodexApproval | null {
  if ((typeof request.id !== "number" && typeof request.id !== "string") || !CODEX_APPROVAL_METHODS.includes(request.method as CodexApprovalMethod)) return null;

  const method = request.method as CodexApprovalMethod;
  const params = request.params || {};
  const threadId = text(params.threadId);
  const turnId = text(params.turnId);
  const itemId = text(params.itemId);
  const approvalId = text(params.approvalId);
  const keyId = approvalId || itemId || String(request.id);
  const requestKey = `${method}\u0000${threadId}\u0000${turnId}\u0000${keyId}`;
  const reason = text(params.reason);

  if (method === "item/commandExecution/requestApproval") {
    const command = text(params.command);
    const actionDetail = describeCommandActions(params.commandActions);
    const network = record(params.networkApprovalContext);
    const cwd = text(params.cwd);
    const networkTarget = text(network.host) ? `${text(network.protocol) || "https"}://${text(network.host)}` : "";
    const commandKind = text(params.kind) === "writeStdin" ? "向现有终端输入" : "执行命令";
    return {
      requestKey,
      rpcIds: [request.id],
      method,
      kind: "command",
      threadId,
      turnId,
      itemId,
      title: `允许${commandKind}？`,
      summary: reason || "Codex 请求在本机运行这项操作。",
      targetLabel: networkTarget ? "网络目标" : "工作目录",
      target: networkTarget || cwd || "未提供",
      detailLabel: commandKind,
      detail: command || actionDetail || "未提供命令内容",
    };
  }

  if (method === "item/fileChange/requestApproval") {
    const grantRoot = text(params.grantRoot);
    return {
      requestKey,
      rpcIds: [request.id],
      method,
      kind: "file",
      threadId,
      turnId,
      itemId,
      title: "允许修改文件？",
      summary: reason || "Codex 请求在本机修改文件。",
      targetLabel: "可写范围",
      target: grantRoot || "当前工作区（范围未提供）",
      detailLabel: "说明",
      detail: reason || "未提供更具体的文件变更说明",
    };
  }

  const permissions = record(params.permissions);
  return {
    requestKey,
    rpcIds: [request.id],
    method,
    kind: "permissions",
    threadId,
    turnId,
    itemId,
    title: "允许额外权限？",
    summary: reason || "Codex 请求在本轮临时获得额外权限。",
    targetLabel: "工作目录",
    target: text(params.cwd) || "未提供",
    detailLabel: "请求的权限",
    detail: describePermissions(permissions),
    permissions,
  };
}

export function queueCodexApproval(queue: PendingCodexApproval[], request: PendingCodexApproval) {
  const index = queue.findIndex((item) => item.requestKey === request.requestKey);
  if (index < 0) return [...queue, request];
  const current = queue[index];
  if (current.rpcIds.some((id) => id === request.rpcIds[0])) return queue;
  const next = [...queue];
  next[index] = { ...current, rpcIds: [...current.rpcIds, ...request.rpcIds] };
  return next;
}

export function removeCodexApproval(queue: PendingCodexApproval[], requestKey: string) {
  return queue.filter((item) => item.requestKey !== requestKey);
}

export function clearCodexApprovals(queue: PendingCodexApproval[], filter?: { threadId?: string; turnId?: string; itemId?: string }) {
  if (!filter) return [];
  return queue.filter((item) => {
    const threadMatches = !filter.threadId || item.threadId === filter.threadId;
    const turnMatches = !filter.turnId || item.turnId === filter.turnId;
    const itemMatches = !filter.itemId || item.itemId === filter.itemId;
    return !(threadMatches && turnMatches && itemMatches);
  });
}

export function approvalResultFor(request: PendingCodexApproval, action: "allow" | "deny"): Record<string, unknown> {
  if (request.kind === "permissions") {
    return {
      permissions: action === "allow" ? request.permissions || {} : {},
      // The app-server protocol calls this the `turn` scope. Vesper never asks
      // the user for a session-wide grant from this surface.
      scope: "turn",
    };
  }
  return { decision: action === "allow" ? "accept" : "decline" };
}

export function approvalWasResolved(request: PendingCodexApproval, params: Record<string, unknown>) {
  const requestId = params.requestId;
  return text(params.threadId) === request.threadId && request.rpcIds.some((id) => id === requestId);
}
