import { RefreshCw } from 'lucide-react';

import { extractDefaultValue, extractFieldOptions, fieldDisplayLabel, inferValueType } from './runninghubNodeHelpers';
import MentionPromptInput from './MentionPromptInput';
import type { MediaMention } from './mediaMentions';
import type { Material } from './useUpstreamMaterials';
import {
  findMaterialById,
  findRhTextMaterialForField,
  normalizeRhNodeId,
  rhParamKey,
  type RhParamValue,
} from '../../utils/rhTextBinding';

interface RunningHubNodeParamSectionProps {
  nodeInfoList: any[];
  accent: Record<string, string>;
  paramValues: Record<string, RhParamValue>;
  orderedTexts: Material[];
  mentionMaterials: Material[];
  fieldKindIndex: Record<string, number>;
  isDark: boolean;
  isPixel: boolean;
  findUpstreamUrl: (kind: 'image' | 'video' | 'audio', index?: number) => string;
  setParam: (key: string, patch: Partial<RhParamValue>) => void;
  getParamMentions: (key: string) => MediaMention[];
  setTextParam: (key: string, value: string, mentions: MediaMention[]) => void;
}

export default function RunningHubNodeParamSection({
  nodeInfoList,
  accent,
  paramValues,
  orderedTexts,
  mentionMaterials,
  fieldKindIndex,
  isDark,
  isPixel,
  findUpstreamUrl,
  setParam,
  getParamMentions,
  setTextParam,
}: RunningHubNodeParamSectionProps) {
  if (!nodeInfoList.length) return null;

  return (
    <div
      className={`nowheel nodrag rounded border ${accent.subBg} p-2 space-y-2 max-h-[420px] overflow-auto overscroll-contain`}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className={`text-[10px] ${accent.sub} flex items-center justify-between`}>
        <span>参数 ({nodeInfoList.length})</span>
        <span className="text-white/30">点击字段可编辑</span>
      </div>
      {nodeInfoList.map((item: any, index: number) => {
        const valueType = inferValueType(item?.fieldType);
        const paramNodeKey = rhParamKey(item.nodeId, item.fieldName);
        const currentValue = paramValues[paramNodeKey] || { value: extractDefaultValue(item) };
        const isMedia = valueType === 'image' || valueType === 'video' || valueType === 'audio';
        const fieldDataOptions = extractFieldOptions(item);
        const currentFieldDisplayLabel = fieldDisplayLabel(item);

        return (
          <div key={index} className="space-y-1 pb-2 border-b border-white/5 last:border-0 last:pb-0">
            <div className="flex items-center gap-1 text-[10px] leading-tight">
              <span className="text-white/80 font-medium truncate">{currentFieldDisplayLabel || item.fieldName}</span>
              <span className="text-white/20">|</span>
              <span className="text-cyan-300/60 px-1 rounded bg-cyan-500/10">
                {fieldDataOptions ? `select(${fieldDataOptions.length})` : valueType}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/30">#{item.nodeId}</span>
            </div>

            {isMedia ? (
              <>
                <div className="flex items-center justify-between text-[10px]">
                  <label className="flex items-center gap-1 text-cyan-200/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!currentValue.sourceFromUpstream}
                      onChange={(event) => setParam(paramNodeKey, { sourceFromUpstream: event.target.checked })}
                      className="accent-cyan-400"
                    />
                    从上游自动获取
                  </label>
                  {currentValue.sourceFromUpstream && (
                    <button
                      onClick={() => {
                        const nextUrl = findUpstreamUrl(valueType, fieldKindIndex[paramNodeKey] ?? 0);
                        if (nextUrl) setParam(paramNodeKey, { value: nextUrl });
                      }}
                      className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100"
                      title="重新同步上游 url"
                    >
                      <RefreshCw size={9} /> 同步
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={currentValue.value}
                  onChange={(event) => setParam(paramNodeKey, { value: event.target.value })}
                  placeholder={currentValue.sourceFromUpstream ? '(从上游自动填入)' : `${valueType} url 或 fileName`}
                  readOnly={!!currentValue.sourceFromUpstream}
                  className={`w-full rounded border px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/30 ${
                    currentValue.sourceFromUpstream
                      ? 'bg-cyan-500/10 border-cyan-500/30 cursor-not-allowed'
                      : 'bg-white/5 border-white/10 focus:border-white/30'
                  }`}
                />
              </>
            ) : fieldDataOptions ? (
              <select
                value={currentValue.value}
                onChange={(event) => setParam(paramNodeKey, { value: event.target.value })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30"
              >
                {currentValue.value && !fieldDataOptions.some((option) => String(option) === String(currentValue.value)) && (
                  <option value={String(currentValue.value)}>(当前) {String(currentValue.value)}</option>
                )}
                {!currentValue.value && <option value="">(选择)</option>}
                {fieldDataOptions.map((option, optionIndex) => (
                  <option key={optionIndex} value={String(option)}>{String(option)}</option>
                ))}
              </select>
            ) : valueType === 'number' ? (
              <input
                type="number"
                value={currentValue.value}
                onChange={(event) => setParam(paramNodeKey, { value: event.target.value })}
                placeholder={extractDefaultValue(item)}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
              />
            ) : (
              (() => {
                const selectedTextMaterial = findMaterialById(orderedTexts, currentValue.sourceMaterialId);
                const autoTextMatch = findRhTextMaterialForField(item, orderedTexts);
                const linkedTextMaterial = selectedTextMaterial || (autoTextMatch.status === 'matched' ? autoTextMatch.material || null : null);
                const isLinked = !!currentValue.sourceFromUpstream && !!linkedTextMaterial;
                const bindHint =
                  autoTextMatch.status === 'conflict'
                    ? `多个上游文本都填写了 RH#${normalizeRhNodeId(item.nodeId)}，请改成唯一 RH# 或手动选择。`
                    : autoTextMatch.status === 'no-match'
                      ? `给文本节点填写 RH#${normalizeRhNodeId(item.nodeId)} 后可自动绑定。`
                      : isLinked
                        ? `已绑定 ${linkedTextMaterial?.rhNodeId ? `RH#${linkedTextMaterial.rhNodeId}` : '手动选择的文本'}`
                        : '可按文本节点 RH# 自动绑定，也可手动选择上游文本。';

                return (
                  <>
                    {orderedTexts.length > 0 && (
                      <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <label className="flex items-center gap-1 text-cyan-200/80 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!currentValue.sourceFromUpstream}
                              onChange={(event) => {
                                if (!event.target.checked) {
                                  setParam(paramNodeKey, { sourceFromUpstream: false, sourceMaterialId: '', sourceRhNodeId: '' });
                                  return;
                                }
                                const fallback = linkedTextMaterial || (orderedTexts.length === 1 ? orderedTexts[0] : null);
                                if (fallback) {
                                  setParam(paramNodeKey, {
                                    value: fallback.url,
                                    sourceFromUpstream: true,
                                    sourceMaterialId: fallback.id,
                                    sourceRhNodeId: normalizeRhNodeId(fallback.rhNodeId),
                                  });
                                } else {
                                  setParam(paramNodeKey, { sourceFromUpstream: true });
                                }
                              }}
                              className="accent-cyan-400"
                            />
                            从上游文本获取
                          </label>
                          {linkedTextMaterial && (
                            <button
                              onClick={() => setParam(paramNodeKey, {
                                value: linkedTextMaterial.url,
                                sourceFromUpstream: true,
                                sourceMaterialId: linkedTextMaterial.id,
                                sourceRhNodeId: normalizeRhNodeId(linkedTextMaterial.rhNodeId),
                              })}
                              className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100"
                              title="重新同步上游文本"
                            >
                              <RefreshCw size={9} /> 同步
                            </button>
                          )}
                        </div>
                        <select
                          value={currentValue.sourceMaterialId || ''}
                          onChange={(event) => {
                            const material = findMaterialById(orderedTexts, event.target.value);
                            if (!material) {
                              setParam(paramNodeKey, { sourceMaterialId: '', sourceRhNodeId: '', sourceFromUpstream: true });
                              return;
                            }
                            setParam(paramNodeKey, {
                              value: material.url,
                              sourceFromUpstream: true,
                              sourceMaterialId: material.id,
                              sourceRhNodeId: normalizeRhNodeId(material.rhNodeId),
                            });
                          }}
                          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white outline-none focus:border-white/30"
                        >
                          <option value="">按 RH# 自动匹配</option>
                          {orderedTexts.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.rhNodeId ? `RH#${material.rhNodeId}` : '未填 RH#'} · {material.label || material.url.slice(0, 24)}
                            </option>
                          ))}
                        </select>
                        <div className="text-[9px] text-white/35 leading-tight">{bindHint}</div>
                      </div>
                    )}
                    {isLinked ? (
                      <textarea
                        value={currentValue.value}
                        readOnly
                        className="w-full min-h-14 resize-none rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-[11px] text-white outline-none cursor-not-allowed"
                        title="已从上游文本同步；取消勾选后可手动编辑"
                      />
                    ) : (
                      <MentionPromptInput
                        value={currentValue.value}
                        mentions={getParamMentions(paramNodeKey)}
                        materials={mentionMaterials}
                        onChange={(value, mentions) => setTextParam(paramNodeKey, value, mentions)}
                        placeholder={extractDefaultValue(item)}
                        isDark={isDark}
                        isPixel={isPixel}
                        className="w-full min-h-14 resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                      />
                    )}
                  </>
                );
              })()
            )}
          </div>
        );
      })}
    </div>
  );
}
