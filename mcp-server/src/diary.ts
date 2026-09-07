export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function mergeAgentDiary<T extends { user?: string; agent?: string }>(
  existing: T | undefined, content: string, mode: "append" | "replace", source: string, timestamp: string,
) {
  return {
    ...existing,
    user: existing?.user || "",
    agent: mode === "append" && existing?.agent ? `${existing.agent}\n\n${content}` : content,
    agentSource: source,
    updatedAt: timestamp,
  };
}
