import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LogIn, LogOut } from 'lucide-react';
import type { WorkflowBoundaryPortType } from '@xinghuan/shared';

import { PORT_COLOR, PORT_LABEL } from '../../config/portTypes';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useCanvasWorkflows } from '../canvas/CanvasWorkflowContext';
import { WorkflowMembershipControl } from '../canvas/WorkflowVariableControls';

interface WorkflowBoundaryNodeData {
  label?: string;
  portType?: WorkflowBoundaryPortType;
  variableId?: string;
}

const PORT_TYPES: WorkflowBoundaryPortType[] = ['text', 'image', 'video', 'audio'];

export function WorkflowInputNode(props: NodeProps) {
  return <WorkflowBoundaryNode {...props} kind="input" />;
}

export function WorkflowOutputNode(props: NodeProps) {
  return <WorkflowBoundaryNode {...props} kind="output" />;
}

function WorkflowBoundaryNode({ id, data, selected, kind }: NodeProps & { kind: 'input' | 'output' }) {
  const value = data as WorkflowBoundaryNodeData;
  const portType = PORT_TYPES.includes(value.portType as WorkflowBoundaryPortType) ? value.portType as WorkflowBoundaryPortType : 'text';
  const updateData = useUpdateNodeData(id);
  const { workflowForNode } = useCanvasWorkflows();
  const workflow = workflowForNode(id);
  const Icon = kind === 'input' ? LogIn : LogOut;
  const title = kind === 'input' ? '工作流输入' : '工作流输出';
  return (
    <div
      style={{
        width: 220,
        minHeight: 112,
        border: `2px solid ${selected ? '#FFFFFF' : PORT_COLOR[portType]}`,
        borderRadius: 6,
        background: '#18211F',
        color: '#F8FAFC',
        boxShadow: selected ? `0 0 0 2px ${PORT_COLOR[portType]}` : '0 8px 20px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: PORT_COLOR[portType], borderColor: '#FFFFFF' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <Icon size={16} />
        <strong style={{ fontSize: 13, letterSpacing: 0 }}>{title}</strong>
      </div>
      <label style={{ display: 'grid', gap: 5, padding: '10px 12px', fontSize: 11, color: '#CBD5E1' }}>
        数据类型
        <select
          className="nodrag nopan"
          value={portType}
          onChange={(event) => updateData({ portType: event.target.value, variableId: '' })}
          style={{ height: 30, borderRadius: 4, border: '1px solid rgba(255,255,255,0.18)', background: '#0F1615', color: '#F8FAFC', padding: '0 8px' }}
        >
          {PORT_TYPES.map((type) => <option key={type} value={type}>{PORT_LABEL[type]}</option>)}
        </select>
      </label>
      {kind === 'input' && workflow && (
        <label style={{ display: 'grid', gap: 5, padding: '0 12px 10px', fontSize: 11, color: '#CBD5E1' }}>
          输入变量
          <select
            className="nodrag nopan"
            value={value.variableId || ''}
            onChange={(event) => updateData({ variableId: event.target.value })}
            style={{ height: 30, borderRadius: 4, border: '1px solid rgba(255,255,255,0.18)', background: '#0F1615', color: '#F8FAFC', padding: '0 8px' }}
          >
            <option value="">选择同类型变量</option>
            {workflow.variables.filter((variable) => variable.type === portType).map((variable) => (
              <option key={variable.id} value={variable.id}>{variable.label}</option>
            ))}
          </select>
        </label>
      )}
      <div style={{ padding: '0 12px 10px' }}>
        <WorkflowMembershipControl nodeId={id} workflow={workflow} />
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: PORT_COLOR[portType], borderColor: '#FFFFFF' }} />
    </div>
  );
}
