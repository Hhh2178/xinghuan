import { memo, useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import { ImageOpFrame } from './ImageOpFrame';
import { useUpdateNodeData } from './useUpdateNodeData';
import { opResize } from '../../services/imageOps';

const ResizeNode = (p: NodeProps) => {
  const update = useUpdateNodeData(p.id);
  const d = p.data as any;
  const width = Number.isFinite(d?.width) && d.width > 0 ? d.width : 1024;
  const height = Number.isFinite(d?.height) && d.height > 0 ? d.height : 1024;
  const [widthInput, setWidthInput] = useState(String(width));
  const [heightInput, setHeightInput] = useState(String(height));
  // 默认 fit=cover：裁剪銘满到精确目标尺寸，符合“尺寸调整”的直觉语义。
  // 老存档中 d?.fit==='inside' 仍会保留以避免破坏序列化，用户可手动改。
  const fit = d?.fit || 'cover';
  // fit 选项中文说明（sharp 语义）：
  //   cover   覆盖：裁剪銘满 · 保比例（推荐，输出严格 W×H）
  //   contain 包含：留白銘填 · 保比例（输出严格 W×H）
  //   inside  限制内：不超 W×H · 保比例（输出不一定 W×H，是“不裁剪”模式）
  //   fill    填充：拉伸到 W×H · 可能变形
  const FIT_OPTIONS: Array<{ v: string; label: string }> = [
    { v: 'cover', label: 'cover · 裁剪銘满（保比例）' },
    { v: 'contain', label: 'contain · 包含留白（保比例）' },
    { v: 'inside', label: 'inside · 不超尺寸（不裁剪）' },
    { v: 'fill', label: 'fill · 拉伸填充（可变形）' },
  ];

  useEffect(() => {
    setWidthInput(String(width));
  }, [width]);

  useEffect(() => {
    setHeightInput(String(height));
  }, [height]);

  const commitDimension = (field: 'width' | 'height', rawValue: string) => {
    const trimmed = rawValue.trim();
    const fallback = field === 'width' ? width : height;
    if (!trimmed) {
      if (field === 'width') setWidthInput(String(fallback));
      else setHeightInput(String(fallback));
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      if (field === 'width') setWidthInput(String(fallback));
      else setHeightInput(String(fallback));
      return;
    }
    update({ [field]: parsed });
    if (field === 'width') setWidthInput(String(parsed));
    else setHeightInput(String(parsed));
  };

  return (
    <ImageOpFrame
      id={p.id}
      data={p.data}
      selected={p.selected}
      title="图像尺寸调整"
      subtitle={`${width}×${height} · ${fit}`}
      icon={<Maximize2 size={13} />}
      colorHex="#fb923c"
      bgRgba="rgba(251,146,60,.2)"
      shadowRgba="rgba(251,146,60,.2)"
      textHex="#fed7aa"
      buttonClasses="bg-orange-500/20 hover:bg-orange-500/30 text-orange-200"
      renderSettings={() => (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/50 block mb-1">宽</label>
            <input
              type="number"
              value={widthInput}
              onChange={(e) => setWidthInput(e.target.value)}
              onBlur={() => commitDimension('width', widthInput)}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-1">高</label>
            <input
              type="number"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={() => commitDimension('height', heightInput)}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-white/50 block mb-1">Fit</label>
            <select
              value={fit}
              onChange={(e) => update({ fit: e.target.value })}
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            >
              {FIT_OPTIONS.map((x) => (
                <option key={x.v} value={x.v} className="bg-zinc-900">
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      runOp={async (img) => opResize(img as string, width, height, fit)}
    />
  );
};

export default memo(ResizeNode);
