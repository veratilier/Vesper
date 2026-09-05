"use client";
import { useEffect, useRef, useState } from "react";
import { chooseCodexModel, effortLabel, type CodexModel, type CodexModelSelection } from "@/lib/codex-models";

export function CodexModelPicker({ models, current, loading, error, online, onRefresh, onClose, onSelect }: {
  models: CodexModel[]; current: CodexModelSelection | null; loading: boolean; error: string; online: boolean;
  onRefresh: () => void; onClose: () => void; onSelect: (selection: CodexModelSelection) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(current);
  const selected = models.find((model) => model.model === draft?.model);
  const valid = selected && (draft?.effort === null || selected.supportedReasoningEfforts.some((option) => option.reasoningEffort === draft?.effort));
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className="codex-model-dialog" aria-labelledby="codex-model-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="codex-model-panel">
      <header><h2 id="codex-model-title">模型与使用强度</h2><button type="button" onClick={onClose} aria-label="关闭模型选择">×</button></header>
      <p className="codex-model-help">来自当前登录账号的 Codex 模型。更改从下一条消息生效。</p>
      <label>模型<select autoFocus value={draft?.model || ""} disabled={loading || !online} onChange={(event) => {
        const model = models.find((item) => item.model === event.target.value);
        if (model) setDraft(chooseCodexModel(model, draft?.effort));
      }}>
        <option value="" disabled>请选择模型</option>
        {draft?.model && !selected && <option value={draft.model} disabled>{draft.model}（当前配置）</option>}
        {models.map((model) => <option key={model.model} value={model.model}>{model.displayName}</option>)}
      </select></label>
      <label>使用强度<select value={draft?.effort ?? ""} disabled={loading || !online || !selected?.supportedReasoningEfforts.length} onChange={(event) => { if (selected) setDraft({ model: selected.model, effort: event.target.value || null }); }}>
        {(!selected?.supportedReasoningEfforts.length || draft?.effort === null) && <option value="">默认</option>}
        {selected?.supportedReasoningEfforts.map((option) => <option key={option.reasoningEffort} value={option.reasoningEffort}>{effortLabel(option.reasoningEffort)} · {option.reasoningEffort}</option>)}
      </select></label>
      <p className="codex-model-help">更高强度通常需要更长时间，并消耗更多额度。</p>
      {loading && <p role="status">正在同步可用模型…</p>}
      {!online && <p role="status">连接已断开，请重连后选择。</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !models.length && <p role="status">账号暂未返回可用模型。</p>}
      <footer><button type="button" disabled={loading || !online} onClick={onRefresh}>刷新列表</button><button type="button" className="codex-model-confirm" disabled={!valid || loading || !online || !!error} onClick={() => { if (draft && valid) onSelect(draft); }}>使用此设置</button></footer>
    </section>
  </dialog>;
}
