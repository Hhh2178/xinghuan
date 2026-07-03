import type { CSSProperties } from 'react';

import type { ComfyuiCatalogWorkflow, ComfyuiRunOutput } from '../../types/canvas';
import { resolvePrimaryComfyuiOutput } from './comfyuiNodeHelpers';

interface ComfyUINodeOutputSummarySectionProps {
  workflow: ComfyuiCatalogWorkflow | null;
  outputs: ComfyuiRunOutput[];
  status: string;
  borderColor: string;
  subColor: string;
  textColor: string;
  style?: CSSProperties;
}

export default function ComfyUINodeOutputSummarySection({
  workflow,
  outputs,
  status,
  borderColor,
  subColor,
  textColor,
  style,
}: ComfyUINodeOutputSummarySectionProps) {
  const primary = resolvePrimaryComfyuiOutput(outputs, workflow);
  return (
    <section className="rounded border p-2" style={{ borderColor, background: 'rgba(255,255,255,0.03)', ...style }}>
      <div className="text-xs font-black" style={{ color: textColor }}>输出摘要</div>
      <div className="mt-1 text-[10px]" style={{ color: subColor }}>
        {primary ? `主输出：${primary.label || primary.key} · ${primary.kind}` : '尚未生成结果'}
      </div>
      <div className="mt-1 text-[10px]" style={{ color: subColor }}>
        状态：{status} · 已返回 {outputs.length} 项结构化输出
      </div>
    </section>
  );
}

