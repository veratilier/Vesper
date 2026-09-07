export type UserInputRequest = { id: string | number; method: string; params: Record<string, unknown> };
export function userInputAnswer(request: UserInputRequest, answers: Record<string, string>) {
  const questions = request.params.questions;
  if (!Array.isArray(questions) || !questions.length) throw Error('没有可回答的问题。');
  const result: Record<string, { answers: string[] }> = {};
  for (const question of questions) {
    if (!question || typeof question.id !== 'string' || !answers[question.id]?.trim()) throw Error('请回答每个问题。');
    if (Array.isArray(question.options) && question.options.length && !question.options.some((option: { label?: string }) => option.label === answers[question.id])) throw Error('请选择请求中提供的选项。');
    Object.defineProperty(result, question.id, { value: { answers: [answers[question.id]] }, enumerable: true });
  }
  return { answers: result };
}
