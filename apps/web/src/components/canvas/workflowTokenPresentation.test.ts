import { describe, expect, it } from 'vitest';

import {
  initialTextVariableBinding,
  workflowTokenPresentation,
  workflowVariableErrorMessage,
} from './workflowTokenPresentation';
import { nextWorkflowVariableName } from './workflowVariableNaming';

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

  it('builds the first text-variable binding without requiring a stale workflow reparse', () => {
    expect(initialTextVariableBinding('variable', '', 'var-1', '文本输入')).toEqual({
      source: '##文本输入##',
      binding: { mode: 'variable', variableId: 'var-1' },
    });
    expect(initialTextVariableBinding('template', '镜头', 'var-1', '文本输入')).toEqual({
      source: '镜头 ##文本输入##',
      binding: {
        mode: 'template',
        segments: [
          { kind: 'text', value: '镜头 ' },
          { kind: 'variable', variableId: 'var-1', key: '文本输入' },
        ],
      },
    });
    expect(initialTextVariableBinding('template', '##未知##', 'var-1', '文本输入')).toBeNull();
  });

  it('uses the same normalized unique name for a newly bound variable', () => {
    expect(nextWorkflowVariableName([{ key: '文本输入' }, { key: '文本输入 2' }], '文本输入')).toBe('文本输入 3');
  });
});
