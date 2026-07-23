import type { WorkflowFieldBinding } from '@xinghuan/shared';

export type WorkflowTokenPresentationSegment = {
  kind: 'text' | 'token';
  value: string;
};

export function workflowTokenPresentation(source: string): WorkflowTokenPresentationSegment[] {
  const segments: WorkflowTokenPresentationSegment[] = [];
  let text = '';
  let index = 0;
  const flush = () => {
    if (!text) return;
    segments.push({ kind: 'text', value: text });
    text = '';
  };
  while (index < source.length) {
    if (source.startsWith('\\##', index)) {
      const literalClosing = source.indexOf('##', index + 3);
      if (literalClosing >= 0) {
        text += source.slice(index + 1, literalClosing + 2);
        index = literalClosing + 2;
      } else {
        text += '##';
        index += 3;
      }
      continue;
    }
    if (!source.startsWith('##', index)) {
      text += source[index];
      index += 1;
      continue;
    }
    const closing = source.indexOf('##', index + 2);
    if (closing < 0) {
      text += source.slice(index);
      break;
    }
    flush();
    segments.push({ kind: 'token', value: source.slice(index, closing + 2) });
    index = closing + 2;
  }
  flush();
  return segments;
}

export function workflowVariableErrorMessage(error: string | null) {
  if (!error) return null;
  const [code, detail] = error.split(':');
  if (code === 'WORKFLOW_VARIABLE_TOKEN_UNKNOWN') return `未找到变量“${detail || ''}”`;
  if (code === 'WORKFLOW_VARIABLE_TOKEN_UNCLOSED') return '变量标记缺少结尾 ##';
  if (code === 'WORKFLOW_VARIABLE_TOKEN_EMPTY') return '变量名称不能为空';
  if (code === 'WORKFLOW_VARIABLE_TEMPLATE_TYPE_MISMATCH') return `变量“${detail || ''}”不是文本类型`;
  if (code === 'WORKFLOW_VARIABLE_NAME_CONFLICT') return `变量名称“${detail || ''}”已存在`;
  if (code === 'WORKFLOW_VARIABLE_KEY_RESERVED') return `变量名称“${detail || ''}”不可使用`;
  if (code === 'WORKFLOW_VARIABLE_KEY_REQUIRED') return '变量名称不能为空';
  return '变量配置无效，请检查名称、类型和约束';
}

export function initialTextVariableBinding(
  mode: 'variable' | 'template',
  text: string,
  variableId: string,
  variableKey: string,
): { source: string; binding: WorkflowFieldBinding } | null {
  if (mode === 'variable') {
    return {
      source: `##${variableKey}##`,
      binding: { mode: 'variable', variableId },
    };
  }
  if (text.includes('##')) return null;
  const prefix = text ? `${text} ` : '';
  return {
    source: `${prefix}##${variableKey}##`,
    binding: {
      mode: 'template',
      segments: [
        ...(prefix ? [{ kind: 'text' as const, value: prefix }] : []),
        { kind: 'variable', variableId, key: variableKey },
      ],
    },
  };
}
