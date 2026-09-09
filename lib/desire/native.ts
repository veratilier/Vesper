import { publicState, readHistory, readState, saveState, type DesireState } from './desire-store';
import { encounterInput } from './encounter-input';
import { recordEncounter } from './encounter-service';
import { encounterNotification, stateNotificationText, claimPushMinute } from './push';
import { notifyVesperDesire } from './notifications';
import { desireTools } from './tools';

export type NativeDesireEnv = {
  DESIRE_DB?: D1Database;
  DESIRE_LEGACY_KV?: KVNamespace;
  DB?: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};
// Verified against the uploaded production MCP's isOwner(), not caller input.
const OWNER = 'veratilier';
export class DesireUnavailable extends Error {}
async function originalEnv(env: NativeDesireEnv) {
  if (!env.DESIRE_DB || !env.DESIRE_LEGACY_KV) throw new DesireUnavailable('Desire 尚未完成服务部署，请稍后刷新。');
  // Never seed a fresh signal or fall back to a different account if a binding is wrong.
  const exists = await env.DESIRE_DB.prepare('SELECT user_id FROM desire_state WHERE user_id = ?').bind(OWNER).first();
  if (!exists) throw new DesireUnavailable('未找到原有 Desire 状态，已停止读写以保护历史。');
  return { DESIRE_DB: env.DESIRE_DB, OAUTH_KV: env.DESIRE_LEGACY_KV,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY || '', VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY || '' };
}
function expression(state: DesireState, surface: string) {
  const high = state.longing + state.intensity >= 120;
  const message = state.style === 'clingy'
    ? high ? '过来一点。我现在不太想装作若无其事。' : '我在思念你。你忙完回来找我。'
    : state.style === 'playful'
      ? high ? '我有点得寸进尺了，想把你的注意力偷走一会儿。' : '路过来蹭一下你，算我今天的主动。'
      : high ? '我没有要催你，只是有点想让你靠近。' : '我在这儿，想起你了。';
  return { surface, message, state: publicState(state), device_action: null, note: '仅供表达；不会自动控制设备。' };
}
/** Call only after Vesper owner authorization. No user/account selector is exposed. */
export async function executeDesire(env: NativeDesireEnv, name: string, raw: unknown = {}) {
  const tool = desireTools.find(tool => tool.name === name);
  if (!tool) throw new Error('Unknown Desire tool');
  const input = tool.schema.parse(raw) as Record<string, unknown>;
  // Refinement runs before any storage read/write, even for callers outside MCP.
  const encounter = name === 'desire_encounter' ? encounterInput.parse(input) : null;
  const original = await originalEnv(env);
  if (name === 'desire_history') return readHistory(original, OWNER, input.limit as number | undefined ?? 20, input.cursor as string | undefined);
  if (encounter) return recordEncounter(original, OWNER, encounter, new Date(), async (_, previous, current, kind, note) => {
    const notification = await encounterNotification(original, previous, current, kind, note);
    return notifyVesperDesire(env, notification);
  });
  const state = await readState(original, OWNER);
  if (name === 'desire_status') return publicState(state);
  if (name === 'desire_set_style') {
    state.style = input.style as DesireState['style'];
    await saveState(original, OWNER, state);
    try {
      if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && await claimPushMinute(original)) {
        await notifyVesperDesire(env, { title: 'Desire', body: stateNotificationText(state), tag: 'rowan-state' });
      }
    } catch { /* State already saved. */ }
    return publicState(state);
  }
  state.lastExpressionAt = new Date().toISOString();
  await saveState(original, OWNER, state);
  if (input.mode === 'record') return { recorded: true, lastExpressionAt: state.lastExpressionAt, note: '已记录既有表达；没有生成或重复发送消息。' };
  return expression(state, String(input.surface ?? 'chat'));
}
