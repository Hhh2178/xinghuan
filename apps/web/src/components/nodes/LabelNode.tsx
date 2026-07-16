import { memo, useEffect, useState } from 'react';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import { Lock, Tag, Unlock } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import ResizableCorners from './ResizableCorners';
import { useSyncNodeInternalsOnResize } from './useSyncNodeInternalsOnResize';

const COLOR = '#94a3b8';

const LabelNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { rootRef, syncNodeInternals } = useSyncNodeInternalsOnResize(id);
  const { setNodes } = useReactFlow();
  const d = (data || {}) as any;
  const locked = d.locked === true;
  const fontSize = Math.max(12, Math.min(96, Number(d.fontSize) || 28));
  const textColor = typeof d.textColor === 'string' ? d.textColor : '#e2e8f0';
  const backgroundColor = typeof d.backgroundColor === 'string' ? d.backgroundColor : '#1f2937';
  const [size, setSize] = useState({
    width: Math.max(240, Number(d.width) || 360),
    height: Math.max(140, Number(d.height) || 180),
  });

  useEffect(() => {
    setNodes((nodes) => nodes.map((node) => node.id === id && node.draggable !== !locked ? { ...node, draggable: !locked } : node));
  }, [id, locked, setNodes]);

  return (
    <div
      ref={rootRef}
      className="relative transition-all"
      style={{ width: size.width, height: size.height, minWidth: 240, minHeight: 140 }}
    >
      <ResizableCorners
        selected={selected && !locked}
        minWidth={240}
        minHeight={140}
        maxWidth={1200}
        maxHeight={900}
        accent={COLOR}
        keepAspectRatio={false}
        onResize={(_event, p) => {
          setSize({ width: p.width, height: p.height });
          syncNodeInternals();
        }}
        onResizeEnd={(_event, p) => {
          setSize({ width: p.width, height: p.height });
          update({ width: p.width, height: p.height });
          syncNodeInternals();
        }}
      />
      <div
        className={`t8-node flex h-full min-h-0 flex-col overflow-hidden ${selected ? 'ring-2 ring-slate-300' : ''}`}
        style={{ background: backgroundColor, borderColor: selected ? COLOR : undefined }}
      >
        <div className="t8-node-header flex shrink-0 items-center gap-2 rounded-t-[inherit] px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-400/40 bg-slate-500/15 text-slate-200"><Tag size={14} /></div>
          <div className="flex-1 text-sm font-semibold">标签</div>
          <button
            type="button"
            className="nodrag nopan t8-mini-icon-button"
            onClick={() => update({ locked: !locked })}
            title={locked ? '解除固定' : '固定在画布'}
            aria-pressed={locked}
          >
            {locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
        </div>
        <div className="nodrag nopan flex min-h-0 flex-1 flex-col gap-3 p-3" onMouseDown={(event) => event.stopPropagation()}>
          <textarea
            value={typeof d.text === 'string' ? d.text : ''}
            onChange={(event) => update({ text: event.target.value })}
            rows={1}
            placeholder="标签文字"
            className="min-h-[44px] w-full flex-1 resize-none border-0 bg-transparent p-0 font-semibold leading-snug outline-none placeholder:text-white/25"
            style={{ color: textColor, fontSize }}
          />
          <div className="grid shrink-0 grid-cols-[1fr_auto_auto] items-end gap-2 border-t border-white/10 pt-2">
            <label className="text-[10px] text-white/55">
              字号
              <input type="number" min={12} max={96} value={fontSize} onChange={(event) => update({ fontSize: Math.max(12, Math.min(96, Number(event.target.value) || 12)) })} className="mt-1 h-8 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs outline-none" />
            </label>
            <label className="text-[10px] text-white/55">文字<input type="color" value={textColor} onChange={(event) => update({ textColor: event.target.value })} className="mt-1 block h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0.5" /></label>
            <label className="text-[10px] text-white/55">底色<input type="color" value={backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} className="mt-1 block h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0.5" /></label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LabelNode);
