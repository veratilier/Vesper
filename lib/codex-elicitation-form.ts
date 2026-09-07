type Field = { type?: string; title?: string; description?: string; enum?: unknown[]; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; format?: string };
export type ElicitationSchema = { type?: string; properties?: Record<string, Field>; required?: string[] };
export function elicitationContent(schema: ElicitationSchema, values: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.properties || {})) {
    if (!['string', 'number', 'integer', 'boolean'].includes(field.type || '')) throw Error('此请求包含暂不支持的字段，请取消并让工具提供简化表单。');
    const raw = Object.hasOwn(values, key) ? values[key] : undefined;
    if (raw == null || raw === '') { if (schema.required?.includes(key)) throw Error(`请填写${field.title || key}`); continue; }
    let value: unknown = raw;
    if (field.type === 'boolean') { if (!['true','false'].includes(raw)) throw Error('请选择是或否'); value = raw === 'true'; }
    if (field.type === 'number' || field.type === 'integer') {
      value = Number(raw);
      if (!Number.isFinite(value) || (field.type === 'integer' && !Number.isInteger(value))) throw Error('请输入有效数字');
      if ((field.minimum != null && Number(value) < field.minimum) || (field.maximum != null && Number(value) > field.maximum)) throw Error('数字超出允许范围');
    }
    if (typeof value === 'string' && ((field.minLength != null && value.length < field.minLength) || (field.maxLength != null && value.length > field.maxLength))) throw Error('文字长度不符合要求');
    if (field.enum && !field.enum.includes(value)) throw Error('请选择提供的选项');
    Object.defineProperty(result, key, {value, enumerable:true});
  }
  if (schema.required?.some(key => !Object.hasOwn(result, key))) throw Error('请求缺少可填写的必填字段，请取消并重试。');
  return result;
}
