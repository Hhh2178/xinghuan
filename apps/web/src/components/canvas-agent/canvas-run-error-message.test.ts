import { describe, expect, it } from 'vitest';

import { describeCanvasRunError } from './canvas-run-error-message.js';

describe('describeCanvasRunError', () => {
  it.each([
    ['CANVAS_RUN_LEGACY_NODE_UNSUPPORTED:resize', '存在不能托管的节点'],
    ['WORKFLOW_BOUNDARY_VALUE_MISSING:input-1', '工作流输入缺少值'],
    ['WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH:input-1', '工作流输入类型不匹配'],
    ['CANVAS_RUN_PLAN_EMPTY', '运行计划为空'],
    ['CANVAS_RUN_DISABLED', 'AI 托管运行环境不可用'],
  ])('maps %s to a repair-oriented explanation', (code, title) => {
    expect(describeCanvasRunError(code)).toMatchObject({ title, technicalCode: code });
  });

  it('keeps an unknown server code visible in technical details', () => {
    expect(describeCanvasRunError('SOMETHING_NEW')).toMatchObject({ title: '无法创建或控制运行', technicalCode: 'SOMETHING_NEW' });
  });
});
