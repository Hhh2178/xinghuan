import { FileUp, X } from 'lucide-react';

import type { AdvancedProviderConfig } from '../types/canvas';
import { parseAdvancedProviderModelText } from '../utils/advancedProviders';
import {
  COMFY_FIELD_SOURCE_OPTIONS,
  analyzeComfyWorkflow,
  canonicalizeComfyFieldsByWorkflow,
  filterComfyFieldsByExcludeRules,
  parseComfyFieldExcludeRules,
  type ComfyFieldMapping,
} from '../utils/comfyuiWorkflow';
import { ADVANCED_PROVIDER_GUIDES, type AdvancedProviderComfyDraft } from './apiSettingsHelpers';
import ApiSettingsFormBlock from './ApiSettingsFormBlock';

interface AdvancedProviderTestStatus {
  loading?: boolean;
  ok?: boolean;
  message?: string;
}

interface ApiSettingsComfyWorkflowPanelProps {
  provider: AdvancedProviderConfig;
  isPixel: boolean;
  inputClassName: string;
  labelClassName: string;
  hintClassName: string;
  guideBoxClassName: string;
  draft?: AdvancedProviderComfyDraft;
  onUpdateProviderNested: (
    id: string,
    key: 'comfyuiConfig',
    patch: Record<string, any>,
  ) => void;
  onSetComfyDraft: (providerId: string, patch: AdvancedProviderComfyDraft) => void;
  onSetProviderTestStatus: (providerId: string, next: AdvancedProviderTestStatus) => void;
}

export default function ApiSettingsComfyWorkflowPanel({
  provider,
  isPixel,
  inputClassName,
  labelClassName,
  hintClassName,
  guideBoxClassName,
  draft,
  onUpdateProviderNested,
  onSetComfyDraft,
  onSetProviderTestStatus,
}: ApiSettingsComfyWorkflowPanelProps) {
  if (provider.protocol !== 'comfyui') return null;

  const guide = ADVANCED_PROVIDER_GUIDES[provider.protocol];
  const formBlockCls = isPixel
    ? 't8-api-settings-section border p-3 space-y-3'
    : 't8-api-settings-section rounded-lg border p-3 space-y-3';
  const fieldInputCls = `${inputClassName.replace('flex-1 ', '')} w-full min-w-0`;
  const textareaCls = `${fieldInputCls} min-h-[76px] resize-y font-mono text-xs leading-relaxed`;
  const comfyWorkflow = (provider.comfyuiConfig?.workflows?.[0] || { id: 'workflow-1', name: '默认工作流' }) as NonNullable<
    NonNullable<AdvancedProviderConfig['comfyuiConfig']>['workflows']
  >[number];
  const comfyWorkflowRaw = draft?.workflowJson ?? (comfyWorkflow.workflowJson ? JSON.stringify(comfyWorkflow.workflowJson, null, 2) : '');
  const comfyWorkflowObject = tryParseJsonObject(comfyWorkflowRaw);
  const comfyWorkflowSource = comfyWorkflowObject || comfyWorkflow.workflowJson || null;
  const comfyAnalysis = analyzeComfyWorkflow(comfyWorkflowSource);
  const comfyExcludeRulesRaw = draft?.excludeRules ?? parseComfyFieldExcludeRules((comfyWorkflow as any).excludeRules).join('\n');
  const comfyExcludeRules = parseComfyFieldExcludeRules(comfyExcludeRulesRaw);
  const comfyFilteredAnalysisFields = filterComfyFieldsByExcludeRules(comfyWorkflowSource, comfyAnalysis.fields, comfyExcludeRules);
  const comfyExcludedFieldCount = Math.max(0, comfyAnalysis.fields.length - comfyFilteredAnalysisFields.length);
  const comfyBaseMappedFields = (Array.isArray(comfyWorkflow.fields) && comfyWorkflow.fields.length
    ? comfyWorkflow.fields
    : comfyFilteredAnalysisFields) as ComfyFieldMapping[];
  const comfyMappedFields = canonicalizeComfyFieldsByWorkflow(
    comfyWorkflowSource,
    filterComfyFieldsByExcludeRules(comfyWorkflowSource, comfyBaseMappedFields, comfyExcludeRules),
  );

  const updateComfyWorkflow = (patch: Record<string, any>) => {
    onUpdateProviderNested(provider.id, 'comfyuiConfig', {
      workflows: [{ ...comfyWorkflow, ...patch }],
    });
  };

  const setProviderTestStatus = (next: AdvancedProviderTestStatus) => {
    onSetProviderTestStatus(provider.id, next);
  };

  const updateComfyWorkflowJson = (raw: string) => {
    onSetComfyDraft(provider.id, { workflowJson: raw });
    try {
      const workflowJson = JSON.parse(raw);
      const analysis = analyzeComfyWorkflow(workflowJson);
      const nextFields = canonicalizeComfyFieldsByWorkflow(
        workflowJson,
        filterComfyFieldsByExcludeRules(workflowJson, analysis.fields, comfyExcludeRules),
      );
      updateComfyWorkflow({
        workflowJson,
        ...(nextFields.length ? { fields: nextFields } : {}),
      });
      if (nextFields.length) onSetComfyDraft(provider.id, { fields: JSON.stringify(nextFields, null, 2) });
      setProviderTestStatus({
        ok: true,
        message: nextFields.length
          ? `工作流已解析，自动识别 ${nextFields.length} 个输入字段`
          : '工作流 JSON 已解析，但未自动识别到常用输入字段',
      });
    } catch {
      setProviderTestStatus({ ok: false, message: '工作流 JSON 格式不正确，修正后会自动保存' });
    }
  };

  const updateComfyExcludeRules = (raw: string) => {
    onSetComfyDraft(provider.id, { excludeRules: raw });
    const excludeRules = parseComfyFieldExcludeRules(raw);
    const currentFields = comfyAnalysis.fields.length
      ? comfyAnalysis.fields
      : (Array.isArray(comfyWorkflow.fields) ? comfyWorkflow.fields : []);
    const fields = canonicalizeComfyFieldsByWorkflow(
      comfyWorkflowSource,
      filterComfyFieldsByExcludeRules(comfyWorkflowSource, currentFields as ComfyFieldMapping[], excludeRules),
    );
    updateComfyWorkflow({ excludeRules, fields });
    onSetComfyDraft(provider.id, { fields: JSON.stringify(fields, null, 2) });
    setProviderTestStatus({
      ok: true,
      message: excludeRules.length
        ? `已设置 ${excludeRules.length} 条排除规则，当前映射保留 ${fields.length} 个字段`
        : `已清空排除规则，当前映射保留 ${fields.length} 个字段`,
    });
  };

  const appendComfyExcludeRules = (items: string[]) => {
    updateComfyExcludeRules([...parseComfyFieldExcludeRules(comfyExcludeRulesRaw), ...items].join('\n'));
  };

  const handleComfyWorkflowFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => updateComfyWorkflowJson(String(reader.result || ''));
    reader.onerror = () => setProviderTestStatus({ ok: false, message: '读取 workflow JSON 文件失败' });
    reader.readAsText(file, 'utf-8');
  };

  const updateComfyFields = (raw: string) => {
    onSetComfyDraft(provider.id, { fields: raw });
    try {
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) throw new Error('fields must be array');
      const fields = canonicalizeComfyFieldsByWorkflow(
        comfyWorkflowSource,
        filterComfyFieldsByExcludeRules(comfyWorkflowSource, parsed as ComfyFieldMapping[], comfyExcludeRules),
      );
      updateComfyWorkflow({ fields });
      setProviderTestStatus({ ok: true, message: '参数映射已解析' });
    } catch {
      setProviderTestStatus({ ok: false, message: '参数映射 JSON 需要是数组' });
    }
  };

  const applyComfyAutoMapping = () => {
    const analysis = analyzeComfyWorkflow(comfyWorkflowSource || null);
    const fields = canonicalizeComfyFieldsByWorkflow(
      comfyWorkflowSource || null,
      filterComfyFieldsByExcludeRules(comfyWorkflowSource || null, analysis.fields, comfyExcludeRules),
    );
    updateComfyWorkflow({ fields });
    onSetComfyDraft(provider.id, { fields: JSON.stringify(fields, null, 2) });
    setProviderTestStatus({
      ok: fields.length > 0,
      message: fields.length
        ? `已应用自动映射：${fields.length} 个字段${comfyExcludeRules.length ? `，已按规则排除 ${analysis.fields.length - fields.length} 个` : ''}`
        : '没有识别到可自动映射的字段',
    });
  };

  const updateComfyField = (index: number, patch: Partial<ComfyFieldMapping>) => {
    const nextFields = canonicalizeComfyFieldsByWorkflow(
      comfyWorkflowSource,
      filterComfyFieldsByExcludeRules(
        comfyWorkflowSource,
        comfyMappedFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
        comfyExcludeRules,
      ),
    );
    updateComfyWorkflow({ fields: nextFields });
    onSetComfyDraft(provider.id, { fields: JSON.stringify(nextFields, null, 2) });
  };

  const removeComfyField = (index: number) => {
    const nextFields = comfyMappedFields.filter((_, fieldIndex) => fieldIndex !== index);
    updateComfyWorkflow({ fields: nextFields });
    onSetComfyDraft(provider.id, { fields: JSON.stringify(nextFields, null, 2) });
  };

  return (
    <ApiSettingsFormBlock
      className={formBlockCls}
      labelClassName={labelClassName}
      hintClassName={hintClassName}
      title="2. ComfyUI 工作流"
      note={guide?.connectionHint}
    >
      <label className="space-y-1 block">
        <span className={`text-[11px] ${labelClassName}`}>实例地址列表（一行一个）</span>
        <textarea
          value={(provider.comfyuiConfig?.instances || [provider.baseUrl || '']).filter(Boolean).join('\n')}
          onChange={(event) => onUpdateProviderNested(provider.id, 'comfyuiConfig', {
            instances: parseAdvancedProviderModelText(event.target.value),
          })}
          className={textareaCls}
          placeholder={guide?.baseUrlPlaceholder || 'http://127.0.0.1:8188'}
        />
      </label>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={`text-[11px] ${labelClassName}`}>工作流 ID</span>
          <input
            value={comfyWorkflow.id || ''}
            onChange={(event) => updateComfyWorkflow({ id: event.target.value || 'workflow-1' })}
            className={fieldInputCls}
            placeholder="workflow-1"
          />
        </label>
        <label className="space-y-1">
          <span className={`text-[11px] ${labelClassName}`}>工作流名称</span>
          <input
            value={comfyWorkflow.name || ''}
            onChange={(event) => updateComfyWorkflow({ name: event.target.value || '默认工作流' })}
            className={fieldInputCls}
            placeholder="默认工作流"
          />
        </label>
      </div>
      <label className="space-y-1 block">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] ${labelClassName}`}>工作流 JSON（从 ComfyUI 导出的 API 格式）</span>
          <label
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0 cursor-pointer inline-flex items-center gap-1'
                : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 cursor-pointer inline-flex items-center gap-1'
            }
            title="上传 ComfyUI API Workflow JSON 并自动映射"
          >
            <FileUp size={12} /> 上传 JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleComfyWorkflowFile(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <textarea
          value={comfyWorkflowRaw}
          onChange={(event) => updateComfyWorkflowJson(event.target.value)}
          className={`${textareaCls} min-h-[140px]`}
          placeholder='粘贴 ComfyUI API workflow JSON，例如 {"1":{"class_type":"CLIPTextEncode","inputs":{"text":""}}}'
        />
        <p className={`text-[11px] ${hintClassName}`}>不是普通前端 workflow 文件，需要在 ComfyUI 开启 dev mode 后导出的 API workflow。</p>
      </label>
      <label className="space-y-1 block">
        <span className={`text-[11px] ${labelClassName}`}>自动映射排除规则（可选）</span>
        <textarea
          value={comfyExcludeRulesRaw}
          onChange={(event) => updateComfyExcludeRules(event.target.value)}
          className={`${textareaCls} min-h-[72px]`}
          placeholder="每行一个：seed、steps、class:KSampler、CLIPTextEncode.text、#86.batch_size"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => appendComfyExcludeRules(['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'])}
            className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
          >
            排除采样器参数
          </button>
          <button
            type="button"
            onClick={() => appendComfyExcludeRules(['model_name', 'ckpt_name', 'clip_name', 'vae_name', 'lora_name'])}
            className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
          >
            排除模型加载
          </button>
          <button
            type="button"
            onClick={() => appendComfyExcludeRules(['width', 'height', 'batch_size'])}
            className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
          >
            排除尺寸批量
          </button>
          <span className={`text-[10px] ${hintClassName}`}>
            当前 {comfyExcludeRules.length} 条规则，已排除 {comfyExcludedFieldCount} 个自动识别字段。
          </span>
        </div>
        <p className={`text-[11px] ${hintClassName}`}>
          支持 source/字段名/节点类名/节点编号，例如 source:cfg、field:width、class:KSampler、node:86、#86.width。
        </p>
      </label>
      <div className={guideBoxClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-xs font-black ${labelClassName}`}>自动识别结果</div>
            <p className={`mt-1 ${hintClassName}`}>
              已识别 {comfyAnalysis.fields.length} 个可映射字段，排除后保留 {comfyFilteredAnalysisFields.length} 个，图片输入 {comfyAnalysis.imageInputCount} 个，输出节点 {comfyAnalysis.outputCount} 个。
            </p>
            {comfyAnalysis.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {comfyAnalysis.warnings.slice(0, 3).map((warning, index) => (
                  <p key={`${provider.id}-comfy-warning-${index}`} className="text-[10px] text-amber-400">{warning}</p>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={applyComfyAutoMapping}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
                : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0'
            }
          >
            自动映射
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className={`text-xs font-black ${labelClassName}`}>参数映射</div>
        {comfyMappedFields.length > 0 ? (
          <div className="space-y-1.5">
            {comfyMappedFields.map((field, index) => {
              const detected = comfyAnalysis.fields.find((item) => item.nodeId === field.nodeId && item.fieldName === field.fieldName);
              const isFixed = String(field.source || '') === 'fixed';
              return (
                <div
                  key={`${field.nodeId}-${field.fieldName}-${index}`}
                  className={isPixel ? 't8-api-settings-section border p-2 space-y-2' : 't8-api-settings-section rounded border p-2 space-y-2'}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_32px] gap-2 items-end">
                    <div className="min-w-0">
                      <div className={`text-[11px] font-bold truncate ${labelClassName}`} title={detected?.label || `${field.nodeId}.${field.fieldName}`}>
                        {detected?.label || `节点 #${field.nodeId} · ${field.fieldName}`}
                      </div>
                      <div className={`text-[10px] truncate ${hintClassName}`}>
                        {detected?.classType || 'Custom'} / {field.nodeId}.{field.fieldName}
                      </div>
                    </div>
                    <label className="space-y-1">
                      <span className={`text-[10px] ${hintClassName}`}>来源</span>
                      <select
                        value={(field.source || field.fieldName || 'fixed') as string}
                        onChange={(event) => updateComfyField(index, { source: event.target.value })}
                        className={fieldInputCls}
                      >
                        {COMFY_FIELD_SOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeComfyField(index)}
                      className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
                      title="移除此映射"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {isFixed && (
                    <input
                      value={String(field.value ?? '')}
                      onChange={(event) => updateComfyField(index, { value: event.target.value })}
                      className={fieldInputCls}
                      placeholder="固定写入这个 ComfyUI 字段的值"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={`text-[11px] ${hintClassName}`}>粘贴 API Workflow 后会自动生成映射；也可以在下面高级 JSON 中手动填写。</p>
        )}
      </div>
      <details className="space-y-2">
        <summary className={`cursor-pointer text-[11px] font-bold ${labelClassName}`}>高级：直接编辑 fields JSON</summary>
        <textarea
          value={draft?.fields ?? JSON.stringify(comfyMappedFields, null, 2)}
          onChange={(event) => updateComfyFields(event.target.value)}
          className={textareaCls}
          placeholder='[{"nodeId":"1","fieldName":"text","source":"prompt"}]'
        />
        <p className={`text-[11px] ${hintClassName}`}>用于兼容复杂工作流。普通用户建议使用上方映射表。</p>
      </details>
    </ApiSettingsFormBlock>
  );
}

function tryParseJsonObject(value: string): Record<string, any> | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
