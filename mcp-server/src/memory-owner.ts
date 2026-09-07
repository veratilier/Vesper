/** Deployment-only owner mapping; never take a memory owner from tool input. */
export function pinnedMemoryOwner(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const owner = value.trim();
  if (!/^usr_[a-f0-9]{32}$/.test(owner)) {
    throw new Error("VESPER_MEMORY_USER_ID 格式无效，已停止访问记忆库。");
  }
  return owner;
}
