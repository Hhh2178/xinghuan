import type { WorkflowDocument, WorkflowSupervisionSettings } from '@xinghuan/shared';
import type { Node } from '@xyflow/react';
import { RotateCcw, Save, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  readWorkflowSupervisionSettings,
  resetWorkflowSupervisionSettings,
  saveWorkflowSupervisionSettings,
  type WorkflowSupervisionSettingsProjection,
} from './canvas-run-api';

const GENERATION_NODE_TYPES = new Set(['image', 'video', 'audio', 'runninghub', 'comfyui', 'comfyui-app']);

export function WorkflowSupervisionSettingsDrawer(props: {
  canvasId: string | null;
  workflow: WorkflowDocument;
  nodes: Node[];
  activeRun: boolean;
  onClose: () => void;
  onApplyOnce: (settings: WorkflowSupervisionSettings) => void;
  onRemembered: () => void;
}) {
  const [projection, setProjection] = useState<WorkflowSupervisionSettingsProjection | null>(null);
  const [draft, setDraft] = useState<WorkflowSupervisionSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generationNodes = useMemo(() => {
    const members = new Set(props.workflow.memberNodeIds);
    return props.nodes.filter((node) => members.has(node.id) && GENERATION_NODE_TYPES.has(String(node.type || '')));
  }, [props.nodes, props.workflow.memberNodeIds]);

  useEffect(() => {
    if (!props.canvasId) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void readWorkflowSupervisionSettings(props.canvasId, props.workflow.id)
      .then((next) => {
        if (cancelled) return;
        setProjection(next);
        setDraft(next.settings);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [props.canvasId, props.workflow.id]);

  const update = <K extends keyof WorkflowSupervisionSettings>(key: K, value: WorkflowSupervisionSettings[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };
  const save = async () => {
    if (!props.canvasId || !draft) return;
    setBusy(true);
    setError('');
    try {
      const next = await saveWorkflowSupervisionSettings(props.canvasId, props.workflow.id, draft);
      setProjection(next);
      setDraft(next.settings);
      props.onRemembered();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (!props.canvasId) return;
    setBusy(true);
    setError('');
    try {
      const next = await resetWorkflowSupervisionSettings(props.canvasId, props.workflow.id);
      setProjection(next);
      setDraft(next.settings);
      props.onRemembered();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="workflow-supervision-settings" aria-label="AI 托管设置">
      <header>
        <div><span><SlidersHorizontal size={15} /></span><div><strong>运行设置</strong><small>{props.workflow.name} · r{props.workflow.revision}</small></div></div>
        <button type="button" title="关闭设置" onClick={props.onClose}><X size={16} /></button>
      </header>
      <div className="workflow-supervision-settings__source">
        <span>{projection?.hasRemembered ? `个人记忆 r${projection.rememberedRevision}` : '工作流默认'}</span>
        <strong>应用到下一次 Run</strong>
        {props.activeRun ? <em>当前 Run 已锁定</em> : null}
      </div>
      {error ? <div className="workflow-supervision-settings__error">{error}</div> : null}
      {!draft ? <div className="workflow-supervision-settings__loading">{busy ? '读取设置中' : '设置不可用'}</div> : (
        <div className="workflow-supervision-settings__body">
          <fieldset disabled={busy}>
            <legend>基础设置</legend>
            <label><span>节点默认重试</span><input type="number" min={0} max={10} value={draft.defaultRetryCount} onChange={(event) => update('defaultRetryCount', numberValue(event.currentTarget.value, 0))} /></label>
            <label><span>重试耗尽</span><select value={draft.retryExhaustionPolicy} onChange={(event) => update('retryExhaustionPolicy', event.currentTarget.value as WorkflowSupervisionSettings['retryExhaustionPolicy'])}><option value="stop">终止工作流</option><option value="compatible_fallback">切换兼容模型</option></select></label>
            <label><span>最大回退</span><input type="number" min={0} max={100} value={draft.maxFallbackCount} onChange={(event) => update('maxFallbackCount', numberValue(event.currentTarget.value, 0))} /></label>
            <label><span>阶段并发</span><input type="number" min={1} max={64} value={draft.stageConcurrency} onChange={(event) => update('stageConcurrency', numberValue(event.currentTarget.value, 1))} /></label>
            <label><span>运行时限</span><span className="workflow-supervision-settings__number"><input type="number" min={60} max={604800} value={draft.maxDurationSeconds} onChange={(event) => update('maxDurationSeconds', numberValue(event.currentTarget.value, 60))} /><small>秒</small></span></label>
            <label><span>成本上限</span><span className="workflow-supervision-settings__number"><input inputMode="decimal" value={draft.maxCost} onChange={(event) => update('maxCost', event.currentTarget.value)} /><small>{draft.currency}</small></span></label>
          </fieldset>

          <fieldset disabled={busy}>
            <legend>候选选择</legend>
            <div className="workflow-supervision-settings__segmented" aria-label="候选选择模式">
              <button type="button" aria-pressed={draft.candidateSelectionMode === 'manual'} data-active={draft.candidateSelectionMode === 'manual'} onClick={() => update('candidateSelectionMode', 'manual')}>手动</button>
              <button type="button" aria-pressed={draft.candidateSelectionMode === 'ai'} data-active={draft.candidateSelectionMode === 'ai'} onClick={() => update('candidateSelectionMode', 'ai')}><Sparkles size={13} />AI</button>
            </div>
            <label><span>输出数量</span><input type="number" min={1} max={16} value={draft.candidateSelectionCount} onChange={(event) => update('candidateSelectionCount', numberValue(event.currentTarget.value, 1))} /></label>
            <label className="workflow-supervision-settings__range"><span>最低置信度</span><input type="range" min={0} max={100} value={draft.candidateMinimumConfidence} onChange={(event) => update('candidateMinimumConfidence', numberValue(event.currentTarget.value, 0))} /><output>{draft.candidateMinimumConfidence}%</output></label>
            <label className="workflow-supervision-settings__toggle"><input type="checkbox" checked={draft.lowConfidenceManualFallback} onChange={(event) => update('lowConfidenceManualFallback', event.currentTarget.checked)} /><span>低置信度转人工</span></label>
          </fieldset>

          <details>
            <summary>高级策略</summary>
            <fieldset disabled={busy}>
              <label className="workflow-supervision-settings__toggle"><input type="checkbox" checked={draft.promptReviewRewriteEnabled} onChange={(event) => update('promptReviewRewriteEnabled', event.currentTarget.checked)} /><span>提示词审核恢复</span></label>
              <label><span>改写重试</span><input type="number" min={0} max={10} disabled={!draft.promptReviewRewriteEnabled} value={draft.promptReviewMaxRetries} onChange={(event) => update('promptReviewMaxRetries', numberValue(event.currentTarget.value, 0))} /></label>
              {generationNodes.length ? <div className="workflow-supervision-settings__nodes"><strong>节点重试覆盖</strong>{generationNodes.map((node, index) => {
                const current = draft.nodeRetryOverrides[node.id];
                return <label key={node.id}><span><b>{String(index + 1).padStart(2, '0')}</b>{nodeLabel(node)}</span><input aria-label={`${nodeLabel(node)} 重试次数`} type="number" min={0} max={10} placeholder={String(draft.defaultRetryCount)} value={current ?? ''} onChange={(event) => {
                  const next = { ...draft.nodeRetryOverrides };
                  if (event.currentTarget.value === '') delete next[node.id];
                  else next[node.id] = numberValue(event.currentTarget.value, 0);
                  update('nodeRetryOverrides', next);
                }} /></label>;
              })}</div> : null}
            </fieldset>
          </details>
        </div>
      )}
      <footer>
        <button type="button" disabled={busy || !draft} onClick={() => void restore()}><RotateCcw size={14} />恢复默认</button>
        <button type="button" disabled={busy || !draft} onClick={() => { if (draft) props.onApplyOnce(draft); }}><Sparkles size={14} />仅本次</button>
        <button type="button" className="is-primary" disabled={busy || !draft} onClick={() => void save()}><Save size={14} />记住设置</button>
      </footer>
    </section>
  );
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeLabel(node: Node) {
  const data = node.data as Record<string, unknown> | undefined;
  const label = [data?.label, data?.name, data?.title].find((value) => typeof value === 'string' && value.trim());
  return typeof label === 'string' ? label.trim() : String(node.type || '生成节点');
}
