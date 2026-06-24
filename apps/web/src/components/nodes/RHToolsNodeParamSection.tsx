import { RefreshCw } from 'lucide-react';
import MentionPromptInput from './MentionPromptInput';
import type { Material } from './useUpstreamMaterials';
import type { MediaMention } from './mediaMentions';
import {
  extractRhToolsDefaultValue,
  extractRhToolsFieldOptions,
  inferRhToolsValueType,
  rhToolsFieldDisplayLabel,
} from './rhToolsNodeHelpers';
import {
  findMaterialById,
  findRhTextMaterialForField,
  normalizeRhNodeId,
  rhParamKey,
  type RhParamValue,
} from '../../utils/rhTextBinding';

type RHToolsNodeParamSectionProps = {
  nodeInfoList: any[];
  paramValues: Record<string, RhParamValue>;
  orderedTexts: Material[];
  mentionMaterials: Material[];
  fieldKindIndex: Record<string, number>;
  accent: string;
  accentSoft: string;
  border: string;
  ringColor: string;
  surface: string;
  bg: string;
  text: string;
  subText: string;
  isDark: boolean;
  isPixel: boolean;
  findUpstreamUrl: (kind: 'image' | 'video' | 'audio', idx?: number) => string;
  getParamMentions: (key: string) => MediaMention[];
  setParam: (key: string, patch: Partial<RhParamValue>) => void;
  setTextParam: (key: string, value: string, mentions: MediaMention[]) => void;
};

const paramKey = rhParamKey;

export default function RHToolsNodeParamSection({
  nodeInfoList,
  paramValues,
  orderedTexts,
  mentionMaterials,
  fieldKindIndex,
  accent,
  accentSoft,
  border,
  ringColor,
  surface,
  bg,
  text,
  subText,
  isDark,
  isPixel,
  findUpstreamUrl,
  getParamMentions,
  setParam,
  setTextParam,
}: RHToolsNodeParamSectionProps) {
  if (nodeInfoList.length <= 0) return null;

  return (
    <div
      className="rounded p-2 space-y-2"
      style={{
        background: isPixel ? 'var(--px-muted)' : accentSoft,
        border: `1px solid ${ringColor}`,
      }}
    >
      <div className="text-[10px] flex items-center justify-between" style={{ color: accent }}>
        <span>参数 ({nodeInfoList.length})</span>
        <span style={{ color: subText }}>点击字段可编辑</span>
      </div>
      {nodeInfoList.map((it: any, i: number) => {
        const vt = inferRhToolsValueType(it?.fieldType);
        const k = paramKey(it.nodeId, it.fieldName);
        const cur = paramValues[k] || { value: extractRhToolsDefaultValue(it) };
        const isMedia = vt === 'image' || vt === 'video' || vt === 'audio';
        const fieldDataOptions = extractRhToolsFieldOptions(it);
        const currentFieldDisplayLabel = rhToolsFieldDisplayLabel(it);

        return (
          <div key={i} className="space-y-1 pb-2 border-b last:border-0 last:pb-0" style={{ borderColor: border }}>
            <div className="flex items-center gap-1 text-[10px] leading-tight">
              <span className="font-medium truncate" style={{ color: text }}>{currentFieldDisplayLabel || it.fieldName}</span>
              <span style={{ color: subText, opacity: 0.4 }}>|</span>
              <span className="px-1 rounded" style={{ background: accentSoft, color: accent }}>
                {fieldDataOptions ? `select(${fieldDataOptions.length})` : vt}
              </span>
              <span style={{ color: subText, opacity: 0.4 }}>|</span>
              <span style={{ color: subText }}>#{it.nodeId}</span>
            </div>
            {isMedia ? (
              <>
                <div className="flex items-center justify-between text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer" style={{ color: accent }}>
                    <input
                      type="checkbox"
                      checked={!!cur.sourceFromUpstream}
                      onChange={(e) => setParam(k, { sourceFromUpstream: e.target.checked })}
                      style={{ accentColor: accent }}
                    />
                    从上游自动获取
                  </label>
                  {cur.sourceFromUpstream && (
                    <button
                      onClick={() => {
                        const url = findUpstreamUrl(vt as 'image' | 'video' | 'audio', fieldKindIndex[k] ?? 0);
                        if (url) setParam(k, { value: url });
                      }}
                      className="flex items-center gap-1"
                      style={{ color: accent }}
                      title="重新同步上游 url"
                    >
                      <RefreshCw size={9} /> 同步
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={cur.value}
                  onChange={(e) => setParam(k, { value: e.target.value })}
                  placeholder={cur.sourceFromUpstream ? '(从上游自动填入)' : `${vt} url 或 fileName`}
                  readOnly={!!cur.sourceFromUpstream}
                  className="w-full rounded px-2 py-1 text-[11px] outline-none"
                  style={{
                    background: cur.sourceFromUpstream ? accentSoft : surface,
                    color: text,
                    border: `1px solid ${cur.sourceFromUpstream ? ringColor : border}`,
                    cursor: cur.sourceFromUpstream ? 'not-allowed' : 'text',
                  }}
                />
              </>
            ) : fieldDataOptions ? (
              <select
                value={cur.value}
                onChange={(e) => setParam(k, { value: e.target.value })}
                className="w-full rounded px-2 py-1 text-[11px] outline-none"
                style={{ background: surface, color: text, border: `1px solid ${border}` }}
              >
                {cur.value && !fieldDataOptions.some((option) => String(option) === String(cur.value)) && (
                  <option value={String(cur.value)}>(当前) {String(cur.value)}</option>
                )}
                {!cur.value && <option value="">(选择)</option>}
                {fieldDataOptions.map((option, optionIndex) => (
                  <option key={optionIndex} value={String(option)}>{String(option)}</option>
                ))}
              </select>
            ) : vt === 'number' ? (
              <input
                type="number"
                value={cur.value}
                onChange={(e) => setParam(k, { value: e.target.value })}
                placeholder={extractRhToolsDefaultValue(it)}
                className="w-full rounded px-2 py-1 text-[11px] outline-none"
                style={{ background: surface, color: text, border: `1px solid ${border}` }}
              />
            ) : (
              (() => {
                const selectedTextMaterial = findMaterialById(orderedTexts, cur.sourceMaterialId);
                const autoTextMatch = findRhTextMaterialForField(it, orderedTexts);
                const linkedTextMaterial = selectedTextMaterial || (autoTextMatch.status === 'matched' ? autoTextMatch.material || null : null);
                const isLinked = !!cur.sourceFromUpstream && !!linkedTextMaterial;
                const bindHint =
                  autoTextMatch.status === 'conflict'
                    ? `多个上游文本都填写了 RH#${normalizeRhNodeId(it.nodeId)}，请改成唯一 RH# 或手动选择。`
                    : autoTextMatch.status === 'no-match'
                      ? `给文本节点填写 RH#${normalizeRhNodeId(it.nodeId)} 后可自动绑定。`
                      : isLinked
                        ? `已绑定 ${linkedTextMaterial?.rhNodeId ? `RH#${linkedTextMaterial.rhNodeId}` : '手动选择的文本'}`
                        : '可按文本节点 RH# 自动绑定，也可手动选择上游文本。';

                return (
                  <>
                    {orderedTexts.length > 0 && (
                      <div className="rounded px-2 py-1.5 space-y-1" style={{ background: surface, border: `1px solid ${border}` }}>
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <label className="flex items-center gap-1 cursor-pointer" style={{ color: accent }}>
                            <input
                              type="checkbox"
                              checked={!!cur.sourceFromUpstream}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  setParam(k, { sourceFromUpstream: false, sourceMaterialId: '', sourceRhNodeId: '' });
                                  return;
                                }
                                const fallback = linkedTextMaterial || (orderedTexts.length === 1 ? orderedTexts[0] : null);
                                if (fallback) {
                                  setParam(k, {
                                    value: fallback.url,
                                    sourceFromUpstream: true,
                                    sourceMaterialId: fallback.id,
                                    sourceRhNodeId: normalizeRhNodeId(fallback.rhNodeId),
                                  });
                                } else {
                                  setParam(k, { sourceFromUpstream: true });
                                }
                              }}
                              style={{ accentColor: accent }}
                            />
                            从上游文本获取
                          </label>
                          {linkedTextMaterial && (
                            <button
                              onClick={() => setParam(k, {
                                value: linkedTextMaterial.url,
                                sourceFromUpstream: true,
                                sourceMaterialId: linkedTextMaterial.id,
                                sourceRhNodeId: normalizeRhNodeId(linkedTextMaterial.rhNodeId),
                              })}
                              className="flex items-center gap-1"
                              style={{ color: accent }}
                              title="重新同步上游文本"
                            >
                              <RefreshCw size={9} /> 同步
                            </button>
                          )}
                        </div>
                        <select
                          value={cur.sourceMaterialId || ''}
                          onChange={(e) => {
                            const material = findMaterialById(orderedTexts, e.target.value);
                            if (!material) {
                              setParam(k, { sourceMaterialId: '', sourceRhNodeId: '', sourceFromUpstream: true });
                              return;
                            }
                            setParam(k, {
                              value: material.url,
                              sourceFromUpstream: true,
                              sourceMaterialId: material.id,
                              sourceRhNodeId: normalizeRhNodeId(material.rhNodeId),
                            });
                          }}
                          className="w-full rounded px-2 py-1 text-[10px] outline-none"
                          style={{ background: bg, color: text, border: `1px solid ${border}` }}
                        >
                          <option value="">按 RH# 自动匹配</option>
                          {orderedTexts.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.rhNodeId ? `RH#${material.rhNodeId}` : '未填 RH#'} · {material.label || material.url.slice(0, 24)}
                            </option>
                          ))}
                        </select>
                        <div className="text-[9px] leading-tight" style={{ color: subText }}>{bindHint}</div>
                      </div>
                    )}
                    {isLinked ? (
                      <textarea
                        value={cur.value}
                        readOnly
                        className="w-full min-h-14 resize-none rounded px-2 py-1 text-[11px] outline-none"
                        style={{ background: accentSoft, color: text, border: `1px solid ${ringColor}`, cursor: 'not-allowed' }}
                        title="已从上游文本同步；取消勾选后可手动编辑"
                      />
                    ) : (
                      <MentionPromptInput
                        value={cur.value}
                        mentions={getParamMentions(k)}
                        materials={mentionMaterials}
                        onChange={(value, mentions) => setTextParam(k, value, mentions)}
                        placeholder={extractRhToolsDefaultValue(it)}
                        isDark={isDark}
                        isPixel={isPixel}
                        className="w-full min-h-14 resize-none rounded px-2 py-1 text-[11px] outline-none"
                        style={{ background: surface, color: text, border: `1px solid ${border}` }}
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
