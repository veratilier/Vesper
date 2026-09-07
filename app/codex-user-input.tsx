'use client';
import { useEffect, useRef, useState } from 'react';
import { userInputAnswer, type UserInputRequest } from '@/lib/codex-user-input';
import { elicitationContent, type ElicitationSchema } from '@/lib/codex-elicitation-form';
export type { UserInputRequest };
type Question = { id: string; header?: string; question: string; options?: { label: string; description?: string }[]; isSecret?: boolean; isOther?: boolean };
export function CodexUserInput({ request, onRespond }: { request: UserInputRequest; onRespond: (result: Record<string, unknown>) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const elicitation = request.method === 'mcpServer/elicitation/request';
  const schema = (request.params.requestedSchema || {}) as ElicitationSchema;
  const fields = Object.entries(schema.properties || {});
  const questions: Question[] = elicitation ? fields.map(([id, field]) => ({ id, question: field.title || id, header: field.description, options: (field.enum || (field.type === 'boolean' ? [true,false] : [] )).map(value => ({label: String(value), description: value === true ? '是' : value === false ? '否' : undefined})) })) : (Array.isArray(request.params.questions) ? request.params.questions : []) as Question[];
  const question = questions[Math.min(step, questions.length - 1)];
  const field = question && elicitation ? schema.properties?.[question.id] : undefined;
  const unsupported = elicitation && (schema.type !== 'object' || fields.some(([,f]) => !['string','number','integer','boolean'].includes(f.type || '')));
  const url = typeof request.params.url === 'string' && /^https:\/\//i.test(request.params.url) ? request.params.url : undefined;
  const cancel = () => onRespond(elicitation ? { action: 'cancel', content: null } : { answers: {} });
  const setAnswer = (value: string) => { setAnswers(current => ({...current, [question.id]: value})); setError(''); };
  const submit = () => {
    try {
      if (elicitation) {
        if (request.params.mode === 'url') { if (!url) throw Error('授权地址不可用，请取消后重试。'); onRespond({action:'accept',content:null}); }
        else { if (unsupported) throw Error('此请求暂不能用表单展示，请取消后让工具提供简化问题。'); onRespond({ action:'accept', content:elicitationContent(schema,answers) }); }
      } else onRespond(userInputAnswer(request,answers));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '请完成选择'); }
  };
  return <dialog ref={dialog} className="codex-input-dialog question-dialog" onCancel={event => {event.preventDefault();cancel();}} aria-label="回答问题">
    <header><span>{elicitation ? '工具确认' : '回答问题'}</span><button type="button" onClick={cancel} aria-label="取消并关闭">×</button></header>
    {questions.length > 1 && <nav aria-label="问题进度">{questions.map((q,i) => <button type="button" key={q.id} aria-current={step === i ? 'step' : undefined} aria-label={`第 ${i+1} 个问题`} onClick={() => {setStep(i);setError('');}}>{i+1}</button>)}</nav>}
    {elicitation && <p>{String(request.params.message || '请确认这次请求')}</p>}
    {request.params.mode === 'url' ? (url ? <a className="question-option" href={url} target="_blank" rel="noreferrer">打开授权页面 ↗</a> : <p role="alert">授权地址不可用</p>) : unsupported ? <p role="alert">此请求暂不能用表单展示，请取消后让工具提供简化问题。</p> : question && <fieldset key={question.id}><legend>{question.question}</legend>{question.header && <p className="question-hint">{question.header}</p>}
      <div className="question-options">{question.options?.map((option,i) => <label className="question-option" key={option.label} data-selected={!other[question.id] && answers[question.id] === option.label}><input type="radio" name={question.id} checked={!other[question.id] && answers[question.id] === option.label} onChange={() => {setOther(current => ({...current,[question.id]:false}));setAnswer(option.label);}}/><span className="question-number">{i+1}</span><span><b>{option.description && field?.type === 'boolean' ? option.description : option.label}</b>{option.description && field?.type !== 'boolean' && <small>{option.description}</small>}</span></label>)}</div>
      {question.isOther && <button type="button" className="question-other" aria-pressed={!!other[question.id]} onClick={() => {setOther(current => ({...current,[question.id]:true}));setAnswer('');}}>其他回答</button>}
      {(!question.options?.length || other[question.id]) && <label className="question-text-label">你的回答<input autoFocus type={question.isSecret ? 'password' : field?.type === 'number' || field?.type === 'integer' ? 'number' : 'text'} min={field?.minimum} max={field?.maximum} step={field?.type === 'integer' ? 1 : 'any'} maxLength={field?.maxLength} value={answers[question.id] || ''} placeholder="填写回答…" onChange={event => setAnswer(event.target.value)} /></label>}
    </fieldset>}
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={step > 0 ? () => {setStep(step-1);setError('');} : cancel}>{step > 0 ? '上一个' : '取消'}</button><small>{questions.length > 1 ? `${step+1} / ${questions.length}` : '仅提交本次回答'}</small>{step < questions.length-1 ? <button type="button" className="question-submit" onClick={() => {setStep(step+1);setError('');}}>下一个 →</button> : <button type="button" className="question-submit" disabled={unsupported && request.params.mode !== 'url'} onClick={submit}>提交 ↑</button>}</footer>
  </dialog>;
}
