import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Image as ImageIcon, ListChecks, Video } from 'lucide-react';

import { PORT_COLOR } from '../../config/portTypes';
import { useUpdateNodeData } from './useUpdateNodeData';

function SmartCandidateSelectorNode(props: NodeProps) {
  const update = useUpdateNodeData(props.id);
  const data = (props.data || {}) as Record<string, unknown>;
  const mediaKind = data.selectorMediaKind === 'video' ? 'video' : 'image';
  const mode = data.selectorMode === 'ai' ? 'ai' : 'manual';
  const maximum = boundedInteger(data.selectorMaximum, 1, 8, 1);
  const minimumConfidence = boundedNumber(data.selectorMinimumConfidence, 0, 1, 0.7);
  const lowConfidencePolicy = data.selectorLowConfidencePolicy === 'stop' ? 'stop' : 'request_manual';
  const note = typeof data.selectorNote === 'string' ? data.selectorNote : '';
  const MediaIcon = mediaKind === 'video' ? Video : ImageIcon;
  const mediaColor = PORT_COLOR[mediaKind];

  return (
    <section className="smart-candidate-selector-node" data-selected={props.selected ? 'true' : 'false'}>
      <Handle id={`candidate-${mediaKind}`} type="target" position={Position.Left} style={{ top: 82, background: mediaColor }} />
      <Handle id="criteria-text" type="target" position={Position.Left} style={{ top: 122, background: PORT_COLOR.text }} />
      <Handle id={`selected-${mediaKind}`} type="source" position={Position.Right} style={{ top: 82, background: mediaColor }} />

      <header>
        <span><ListChecks size={16} /></span>
        <div><strong>智能候选选择器</strong><small>候选截断与治理门</small></div>
        <Bot size={15} />
      </header>

      <div className="smart-candidate-selector-node__body nodrag">
        <div className="smart-candidate-selector-node__ports">
          <span><MediaIcon size={13} />候选素材</span>
          <span>TXT 选择标准</span>
        </div>

        <div className="smart-candidate-selector-node__segmented" aria-label="素材类型">
          <button type="button" data-active={mediaKind === 'image'} onClick={() => update({ selectorMediaKind: 'image' })}><ImageIcon size={13} />图片</button>
          <button type="button" data-active={mediaKind === 'video'} onClick={() => update({ selectorMediaKind: 'video' })}><Video size={13} />视频</button>
        </div>
        <div className="smart-candidate-selector-node__segmented" aria-label="选择模式">
          <button type="button" data-active={mode === 'manual'} onClick={() => update({ selectorMode: 'manual' })}>人工</button>
          <button type="button" data-active={mode === 'ai'} onClick={() => update({ selectorMode: 'ai' })}><Bot size={13} />AI</button>
        </div>

        <label>
          <span>保留数量</span>
          <select value={maximum} onChange={(event) => update({ selectorMaximum: Number(event.target.value) })}>
            <option value={1}>Top 1</option>
            {[2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>Top {value}</option>)}
          </select>
        </label>

        {mode === 'ai' ? <>
          <label>
            <span>最低置信度 <b>{Math.round(minimumConfidence * 100)}%</b></span>
            <input type="range" min={0} max={1} step={0.05} value={minimumConfidence} onChange={(event) => update({ selectorMinimumConfidence: Number(event.target.value) })} />
          </label>
          <label>
            <span>低置信度</span>
            <select value={lowConfidencePolicy} onChange={(event) => update({ selectorLowConfidencePolicy: event.target.value })}>
              <option value="request_manual">转人工选择</option>
              <option value="stop">停止工作流</option>
            </select>
          </label>
        </> : null}

        <label>
          <span>选择备注</span>
          <textarea rows={3} maxLength={2000} value={note} placeholder="偏好、约束或需要重点比较的内容" onChange={(event) => update({ selectorNote: event.target.value })} />
        </label>
      </div>
    </section>
  );
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export default memo(SmartCandidateSelectorNode);
