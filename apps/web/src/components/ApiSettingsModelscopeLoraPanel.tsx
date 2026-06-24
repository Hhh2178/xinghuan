import { ExternalLink, Plus, Trash2 } from 'lucide-react';

import type { AdvancedProviderConfig } from '../types/canvas';
import { normalizeModelscopeLoraStrength, normalizeModelscopeLoras } from '../utils/advancedProviders';
import ApiSettingsFormBlock from './ApiSettingsFormBlock';

interface ApiSettingsModelscopeLoraPanelProps {
  provider: AdvancedProviderConfig;
  isPixel: boolean;
  inputClassName: string;
  labelClassName: string;
  hintClassName: string;
  linkButtonClassName: string;
  linkAltButtonClassName: string;
  onUpdateProviderNested: (
    id: string,
    key: 'modelscopeConfig',
    patch: Record<string, any>,
  ) => void;
  onOpenExternal: (url: string) => void;
}

export default function ApiSettingsModelscopeLoraPanel({
  provider,
  isPixel,
  inputClassName,
  labelClassName,
  hintClassName,
  linkButtonClassName,
  linkAltButtonClassName,
  onUpdateProviderNested,
  onOpenExternal,
}: ApiSettingsModelscopeLoraPanelProps) {
  if (provider.protocol !== 'modelscope') return null;

  const formBlockCls = isPixel
    ? 't8-api-settings-section border p-3 space-y-3'
    : 't8-api-settings-section rounded-lg border p-3 space-y-3';
  const fieldInputCls = `${inputClassName.replace('flex-1 ', '')} w-full min-w-0`;
  const modelscopeLoras = Array.isArray(provider.modelscopeConfig?.loras) ? provider.modelscopeConfig.loras : [];
  const enabledModelscopeLoraCount = normalizeModelscopeLoras(modelscopeLoras).filter((lora) => lora.enabled !== false).length;

  const setModelscopeLoras = (loras: any[]) => {
    onUpdateProviderNested(provider.id, 'modelscopeConfig', {
      defaultsVersion: provider.modelscopeConfig?.defaultsVersion,
      loras,
    });
  };

  const modelscopeTargetOptions = (selected?: string) => {
    const out: string[] = [];
    for (const value of [
      selected,
      ...(Array.isArray(provider.imageModels) ? provider.imageModels : []),
      'Tongyi-MAI/Z-Image-Turbo',
      'Qwen/Qwen-Image-2512',
      'Qwen/Qwen-Image-Edit-2511',
      'black-forest-labs/FLUX.2-klein-9B',
    ]) {
      const item = String(value || '').trim();
      if (item && !out.includes(item)) out.push(item);
    }
    return out;
  };

  const addModelscopeLora = () => {
    setModelscopeLoras([
      ...modelscopeLoras,
      {
        id: '',
        name: '',
        targetModel: modelscopeTargetOptions()[0] || 'Tongyi-MAI/Z-Image-Turbo',
        strength: 0.8,
        enabled: true,
        note: '',
      },
    ]);
  };

  const updateModelscopeLora = (index: number, patch: Record<string, any>) => {
    setModelscopeLoras(modelscopeLoras.map((lora, loraIndex) => (
      loraIndex === index
        ? {
          ...lora,
          ...patch,
          ...(Object.prototype.hasOwnProperty.call(patch, 'strength')
            ? { strength: normalizeModelscopeLoraStrength(patch.strength, 0.8) }
            : {}),
        }
        : lora
    )));
  };

  const removeModelscopeLora = (index: number) => {
    setModelscopeLoras(modelscopeLoras.filter((_, loraIndex) => loraIndex !== index));
  };

  return (
    <ApiSettingsFormBlock
      className={formBlockCls}
      labelClassName={labelClassName}
      hintClassName={hintClassName}
      title="4. ModelScope LoRA（可选）"
      note={`为 ModelScope 图像模型绑定 LoRA。图像节点会按当前外部模型自动筛选；当前启用 ${enabledModelscopeLoraCount}/${modelscopeLoras.length}。`}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenExternal('https://www.modelscope.cn/aigc/models')}
          className={linkButtonClassName}
          title="打开 ModelScope 国内模型库"
        >
          <ExternalLink size={11} /> 中文模型库
        </button>
        <button
          type="button"
          onClick={() => onOpenExternal('https://www.modelscope.ai/civision/models')}
          className={linkAltButtonClassName}
          title="打开 ModelScope 国际模型库"
        >
          <ExternalLink size={11} /> 英文模型库
        </button>
        <button
          type="button"
          onClick={addModelscopeLora}
          className={
            isPixel
              ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 inline-flex items-center gap-1'
              : 't8-api-settings-secondary-btn rounded border px-2 py-1 text-[11px] inline-flex items-center gap-1'
          }
        >
          <Plus size={12} /> 添加 LoRA
        </button>
      </div>

      {!modelscopeLoras.length ? (
        <div className={`border border-dashed p-3 text-center text-[11px] ${hintClassName} ${isPixel ? '' : 'rounded-lg'}`}>
          暂无 LoRA。点击“添加 LoRA”后填写 LoRA 模型 ID，并绑定到一个 ModelScope 图像模型。
        </div>
      ) : (
        <div className="space-y-2">
          {modelscopeLoras.map((lora, index) => {
            const target = String((lora as any).targetModel || (lora as any).target_model || (lora as any).model || '').trim();
            const strength = normalizeModelscopeLoraStrength((lora as any).strength ?? (lora as any).default_strength, 0.8);
            return (
              <div
                key={index}
                className={isPixel ? 't8-api-settings-section border p-2 space-y-2' : 't8-api-settings-section rounded-lg border p-2 space-y-2'}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_92px_36px] gap-2 items-end">
                  <label className="space-y-1 min-w-0">
                    <span className={`text-[11px] ${labelClassName}`}>LoRA ID</span>
                    <input
                      value={(lora as any).id || ''}
                      onChange={(event) => updateModelscopeLora(index, { id: event.target.value })}
                      className={fieldInputCls}
                      placeholder="例如 Daniel8152/film"
                    />
                  </label>
                  <label className="space-y-1 min-w-0">
                    <span className={`text-[11px] ${labelClassName}`}>绑定图像模型</span>
                    <select
                      value={target || modelscopeTargetOptions()[0] || ''}
                      onChange={(event) => updateModelscopeLora(index, { targetModel: event.target.value })}
                      className={fieldInputCls}
                    >
                      {modelscopeTargetOptions(target).map((modelName) => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 min-w-0">
                    <span className={`text-[11px] ${labelClassName}`}>强度</span>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={strength}
                      onChange={(event) => updateModelscopeLora(index, { strength: event.target.value })}
                      className={fieldInputCls}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeModelscopeLora(index)}
                    className={
                      isPixel
                        ? 't8-mini-icon-button h-9 w-9 inline-flex items-center justify-center'
                        : 't8-mini-icon-button h-9 w-9 rounded border inline-flex items-center justify-center'
                    }
                    title="删除 LoRA"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
                  <label className="space-y-1 min-w-0">
                    <span className={`text-[11px] ${labelClassName}`}>显示名</span>
                    <input
                      value={(lora as any).name || ''}
                      onChange={(event) => updateModelscopeLora(index, { name: event.target.value })}
                      className={fieldInputCls}
                      placeholder="可选，用于节点下拉显示"
                    />
                  </label>
                  <label className="space-y-1 min-w-0">
                    <span className={`text-[11px] ${labelClassName}`}>备注</span>
                    <input
                      value={(lora as any).note || ''}
                      onChange={(event) => updateModelscopeLora(index, { note: event.target.value })}
                      className={fieldInputCls}
                      placeholder="可选，例如触发词或用途"
                    />
                  </label>
                </div>
                <label className={`inline-flex items-center gap-2 text-[11px] font-bold ${labelClassName}`}>
                  <input
                    type="checkbox"
                    checked={(lora as any).enabled !== false}
                    onChange={(event) => updateModelscopeLora(index, { enabled: event.target.checked })}
                  />
                  在图像节点中可用
                </label>
              </div>
            );
          })}
        </div>
      )}
    </ApiSettingsFormBlock>
  );
}
