import { Loader2, RefreshCw } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { ComfyuiMachineOption } from './comfyuiNodeHelpers';

export interface ComfyuiWorkflowOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface ComfyUINodeSelectorSectionProps {
  workflowId: string;
  machineId: string;
  workflowOptions: ComfyuiWorkflowOption[];
  machineOptions: ComfyuiMachineOption[];
  inputClassName: string;
  buttonClassName: string;
  inputStyle: CSSProperties;
  disabled?: boolean;
  loading?: boolean;
  onSelectWorkflow: (workflowId: string) => void;
  onSelectMachine: (machineId: string) => void;
  onRefresh: () => void;
}

export default function ComfyUINodeSelectorSection({
  workflowId,
  machineId,
  workflowOptions,
  machineOptions,
  inputClassName,
  buttonClassName,
  inputStyle,
  disabled,
  loading,
  onSelectWorkflow,
  onSelectMachine,
  onRefresh,
}: ComfyUINodeSelectorSectionProps) {
  return (
    <section className="space-y-3 rounded border p-3" style={{ borderColor: inputStyle.borderColor, background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black">执行选择</div>
        <button type="button" className={buttonClassName} style={inputStyle} onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          刷新
        </button>
      </div>
      <div className="text-[11px] font-black">机器</div>
      <select
        value={machineId}
        onChange={(event) => onSelectMachine(event.target.value)}
        className={inputClassName}
        style={inputStyle}
        disabled={disabled}
      >
        <option value="">请选择执行机器</option>
        {machineOptions.map((item) => (
          <option key={item.id} value={item.id} disabled={item.disabled}>{item.label}</option>
        ))}
      </select>
      <div className="text-[11px] font-black">工作流</div>
      <select
        value={workflowId}
        onChange={(event) => onSelectWorkflow(event.target.value)}
        className={inputClassName}
        style={inputStyle}
        disabled={!machineId || disabled}
      >
        <option value="">{machineId ? '请选择共享工作流' : '请先选择机器'}</option>
        {workflowOptions.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
    </section>
  );
}
