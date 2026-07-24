export interface CanvasRunErrorMessage {
  title: string;
  message: string;
  action: string;
  technicalCode: string;
}

export function describeCanvasRunError(rawCode: string): CanvasRunErrorMessage {
  const technicalCode = rawCode || 'CANVAS_RUN_UNKNOWN_ERROR';
  if (technicalCode.startsWith('CANVAS_RUN_LEGACY_NODE_UNSUPPORTED')) {
    return error(technicalCode, '存在不能托管的节点', '当前工作流包含历史或浏览器运行节点。', '将该节点替换为支持 native-server 的节点，再重新生成运行计划。');
  }
  if (technicalCode.startsWith('WORKFLOW_BOUNDARY_VALUE_MISSING')) {
    return error(technicalCode, '工作流输入缺少值', '某个工作流输入变量在运行快照中为空。', '在对应工作流输入节点的变量面板中填写值，然后重新生成运行计划。');
  }
  if (technicalCode.startsWith('WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH')) {
    return error(technicalCode, '工作流输入类型不匹配', '工作流输入节点的数据类型与所选变量类型不同。', '将输入节点的数据类型改为与变量相同，再重新生成运行计划。');
  }
  if (technicalCode === 'CANVAS_RUN_PLAN_EMPTY') {
    return error(technicalCode, '运行计划为空', '工作流区域没有可编译的执行节点。', '将支持托管的节点加入工作流区域，并确认没有全部被跳过。');
  }
  if (technicalCode === 'CANVAS_RUN_DISABLED' || technicalCode === 'CANVAS_RUN_POSTGRES_REQUIRED' || technicalCode.includes('AGENT_RUNTIME_CAPABILITY_DISABLED')) {
    return error(technicalCode, 'AI 托管运行环境不可用', '当前环境未启用 AI 托管，或运行存储尚未就绪。', '联系管理员检查灰度环境的 Canvas Run 开关、PostgreSQL 与 Worker 状态。');
  }
  if (technicalCode.startsWith('CANVAS_RUN_MODEL_RECORD_REPAIR_REQUIRED')) {
    return error(technicalCode, '模型配置需要修复', '运行节点引用的模型记录不完整或不可用。', '在后台发布或修复该节点的模型配置后，重新生成运行计划。');
  }
  return error(technicalCode, '无法创建或控制运行', '服务端返回了未分类的运行错误。', '刷新运行状态；如问题持续，请将技术详情提供给管理员。');
}

function error(technicalCode: string, title: string, message: string, action: string): CanvasRunErrorMessage {
  return { technicalCode, title, message, action };
}
