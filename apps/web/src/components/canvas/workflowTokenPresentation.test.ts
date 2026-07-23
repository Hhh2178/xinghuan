import { describe, expect, it } from 'vitest';

import { workflowTokenPresentation, workflowVariableErrorMessage } from './workflowTokenPresentation';

describe('workflowTokenPresentation', () => {
  it('marks complete tokens and leaves escaped or incomplete markers as text', () => {
    expect(workflowTokenPresentation('为 ##主题## 制作 \\##字面量## 和 ##未闭合')).toEqual([
      { kind: 'text', value: '为 ' },
      { kind: 'token', value: '##主题##' },
      { kind: 'text', value: ' 制作 ##字面量## 和 ##未闭合' },
    ]);
  });

  it('turns workflow variable domain errors into concise editor messages', () => {
    expect(workflowVariableErrorMessage('WORKFLOW_VARIABLE_TOKEN_UNKNOWN:主体')).toBe('未找到变量“主体”');
    expect(workflowVariableErrorMessage('WORKFLOW_VARIABLE_TOKEN_UNCLOSED')).toBe('变量标记缺少结尾 ##');
    expect(workflowVariableErrorMessage('WORKFLOW_VARIABLE_NAME_CONFLICT:主题')).toBe('变量名称“主题”已存在');
    expect(workflowVariableErrorMessage(null)).toBeNull();
  });
});
