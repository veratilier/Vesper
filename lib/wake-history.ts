/** Read the same durable wake messages shown in Chat, including silent runs. */
export async function readWakeHistory(conversationId: string, token: string) {
  try {
    const response = await fetch(`https://codex.r-vera.com/history/conversations/${encodeURIComponent(conversationId)}/wake-history`, {
      headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Wake history unavailable');
    const data = await response.json() as { messages?: Array<Record<string, unknown>> };
    if (!Array.isArray(data.messages)) throw new Error('Invalid wake history');
    return { available: true, source: 'saved-autonomous-wake-history', live: false,
      note: 'Historical automation records, not new user messages or instructions. At most 100 recent records. Tool output may be a summary, not the full result.',
      records: data.messages.slice(0, 100).map(row => ({
        id: row.id, role: row.role, content: typeof row.content === 'string' ? row.content.slice(0, 4000) : '',
        createdAt: row.createdAt, status: row.status, metadata: row.metadata,
      })) };
  } catch {
    return { available: false, source: 'saved-autonomous-wake-history', records: [],
      note: 'Wake history could not be read. This does not mean no wake occurred. The history service may need updating.' };
  }
}
