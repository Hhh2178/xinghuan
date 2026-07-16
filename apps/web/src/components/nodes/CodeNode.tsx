import { memo, useMemo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, Code2, Loader2, Play, Save, Trash2 } from 'lucide-react';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { executeCodeNode } from '../../services/codeNodeApi';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { DEFAULT_CODE_NODE_SOURCE } from './codeNodeDefaults';

interface CodePreset {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
}

const COLOR = '#fb923c';
function safePresets(value: unknown): CodePreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.code === 'string')
    .map((item: any) => ({
      id: item.id,
      name: String(item.name || '未命名预设').slice(0, 60),
      code: item.code,
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
    }))
    .slice(0, 30);
}

const CodeNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const upstream = useUpstreamMaterials(id);
  const d = (data || {}) as any;
  const code = typeof d.code === 'string' ? d.code : DEFAULT_CODE_NODE_SOURCE;
  const presets = useMemo(() => safePresets(d.presets), [d.presets]);
  const activePresetId = typeof d.activePresetId === 'string' ? d.activePresetId : '';
  const status = String(d.status || 'idle');
  const [message, setMessage] = useState('');

  const inputData = useMemo(() => ({
    texts: upstream.texts.map((item) => item.url),
    images: upstream.images.map((item) => item.url),
    videos: upstream.videos.map((item) => item.url),
    audios: upstream.audios.map((item) => item.url),
    upstream: [...upstream.texts, ...upstream.images, ...upstream.videos, ...upstream.audios].map((item) => ({
      kind: item.kind,
      value: item.url,
      sourceNodeId: item.sourceNodeId,
    })),
  }), [upstream]);

  const run = async () => {
    update({ status: 'running', error: '' });
    const response = await executeCodeNode(code, inputData);
    if (!response.success) {
      update({ status: 'error', error: response.error || '代码执行失败' });
      throw new Error(response.error || '代码执行失败');
    }
    const result = response.data.result;
    const outputText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    const patch: Record<string, unknown> = {
      status: 'success',
      error: '',
      output: result,
      outputText,
      text: outputText,
      prompt: outputText,
      durationMs: response.data.durationMs,
    };
    if (Array.isArray(result) && result.every((item) => typeof item === 'string')) {
      patch.textSegments = result;
      patch.segments = result;
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      for (const key of ['imageUrl', 'imageUrls', 'videoUrl', 'videoUrls', 'audioUrl', 'audioUrls']) {
        if (key in (result as Record<string, unknown>)) patch[key] = (result as Record<string, unknown>)[key];
      }
    }
    update(patch);
  };

  useRunTrigger(id, run);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 1600);
  };

  const createPreset = () => {
    const name = window.prompt('预设名称', `代码预设 ${presets.length + 1}`)?.trim();
    if (!name) return;
    const now = Date.now();
    const preset: CodePreset = { id: `code-preset-${now}`, name: name.slice(0, 60), code, createdAt: now, updatedAt: now };
    update({ presets: [preset, ...presets].slice(0, 30), activePresetId: preset.id });
    flash('预设已保存');
  };

  const overwritePreset = () => {
    if (!activePresetId) return createPreset();
    update({ presets: presets.map((item) => item.id === activePresetId ? { ...item, code, updatedAt: Date.now() } : item) });
    flash('预设已覆盖');
  };

  const deletePreset = () => {
    if (!activePresetId) return;
    update({ presets: presets.filter((item) => item.id !== activePresetId), activePresetId: '' });
    flash('预设已删除');
  };

  return (
    <div className={`t8-node relative w-[560px] overflow-hidden transition-all ${selected ? 'ring-2 ring-orange-300' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0 }} />
      <div className="t8-node-header flex items-center gap-2 rounded-t-[inherit] px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-orange-400/40 bg-orange-500/15 text-orange-200">
          <Code2 size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">代码</div>
          <div className="text-[10px] opacity-55">Python · {status === 'running' ? '运行中' : status === 'success' ? `${Number(d.durationMs || 0)} ms` : '就绪'}</div>
        </div>
        <button type="button" className="nodrag nopan t8-mini-icon-button" onClick={() => void run().catch(() => undefined)} disabled={status === 'running'} title="运行代码">
          {status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>

      <div className="nodrag nopan space-y-2 p-3" onMouseDown={(event) => event.stopPropagation()}>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5">
          <select
            value={activePresetId}
            onChange={(event) => {
              const preset = presets.find((item) => item.id === event.target.value);
              update({ activePresetId: event.target.value, ...(preset ? { code: preset.code } : {}) });
            }}
            className="h-8 min-w-0 rounded-md border border-white/10 bg-white/5 px-2 text-xs outline-none"
          >
            <option value="">当前草稿</option>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
          <button type="button" className="t8-mini-icon-button" onClick={createPreset} title="保存为新预设"><Save size={13} /></button>
          <button type="button" className="t8-mini-icon-button" onClick={overwritePreset} title="覆盖当前预设"><Save size={13} fill="currentColor" /></button>
          <button type="button" className="t8-mini-icon-button" onClick={deletePreset} disabled={!activePresetId} title="删除当前预设"><Trash2 size={13} /></button>
        </div>
        <textarea
          value={code}
          onChange={(event) => update({ code: event.target.value })}
          spellCheck={false}
          className="h-64 w-full resize-y rounded-md border border-white/10 bg-black/35 p-3 font-mono text-[12px] leading-5 text-zinc-100 outline-none focus:border-orange-400/50"
        />
        {(d.error || message) && (
          <div className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] ${d.error ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-orange-400/20 bg-orange-400/10 text-orange-100'}`}>
            {d.error ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : null}
            <span className="break-all">{d.error || message}</span>
          </div>
        )}
        {d.output !== undefined && status === 'success' ? (
          <pre className="max-h-32 overflow-auto rounded-md border border-white/10 bg-white/[0.03] p-2 text-[10px] leading-4 text-white/65">{typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
};

export default memo(CodeNode);
