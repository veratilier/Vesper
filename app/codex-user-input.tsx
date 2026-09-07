'use client';
import { useEffect, useRef, useState } from 'react';
import { userInputAnswer, type UserInputRequest } from "@/lib/codex-user-input";
export type { UserInputRequest };
type Question = { id: string; question: string; options?: { label: string; description?: string }[]; isSecret?: boolean };
export function CodexUserInput({ request, onRespond }: { request: UserInputRequest; onRespond: (result: Record<string, unknown>) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [content, setContent] = useState('{}');
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const elicitation = request.method === 'mcpServer/elicitation/request';
  const questions = (Array.isArray(request.params.questions) ? request.params.questions : []) as Question[];
  const schema = request.params.requestedSchema as { required?: string[]; properties?: Record<string, unknown> } | undefined;
  const cancel = () => onRespond(elicitation ? { action: 'cancel', content: null } : { answers: {} });
  const submit = () => {
    if (!elicitation) {
      try { onRespond(userInputAnswer(request, answers)); } catch (reason) { setError(reason instanceof Error ? reason.message : '请完成选择'); }
    } else {
      try {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('请输入 JSON 对象。');
        if (schema?.required?.some(key => !(key in parsed))) throw Error('请填写要求的字段。');
        onRespond({ action: 'accept', content: request.params.mode === 'url' ? null : parsed });
      } catch (reason) { setError(reason instanceof Error ? reason.message : '内容格式错误'); }
    }
  };
  const url = typeof request.params.url === 'string' && /^https:\/\//i.test(request.params.url) ? request.params.url : undefined;
  return <dialog ref={dialog} className="codex-input-dialog" onCancel={event => { event.preventDefault(); cancel(); }} aria-label="工具请求确认">
    <h2>工具请求确认</h2>
    {elicitation ? <><p>{String(request.params.message || '请确认这次请求')}</p>{url ? <a href={url} target="_blank" rel="noreferrer">打开授权页面</a> : <><pre>{JSON.stringify(schema || {}, null, 2)}</pre><label>填写请求内容（JSON）<textarea value={content} onChange={event => setContent(event.target.value)} /></label></>}</> : questions.map(question => <fieldset key={question.id}><legend>{question.question}</legend>{question.options?.map(option => <label key={option.label}><input type="radio" name={question.id} checked={answers[question.id] === option.label} onChange={() => setAnswers(current => ({ ...current, [question.id]: option.label }))} />{option.label}{option.description && <small>{option.description}</small>}</label>)}{!question.options?.length && <input type={question.isSecret ? 'password' : 'text'} value={answers[question.id] || ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} />}</fieldset>)}
    {error && <p role="alert">{error}</p>}<footer><button type="button" onClick={cancel}>取消</button><button type="button" onClick={submit}>提交本次选择</button></footer>
  </dialog>;
}
