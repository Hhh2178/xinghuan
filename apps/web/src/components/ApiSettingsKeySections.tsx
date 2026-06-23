import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';

import { FIXED_ZHENZHEN_BASE, RH_BASE } from '../stores/apiKeys';
import { CLASSIFIED_KEYS, COMMON_KEYS, type KeyField } from './apiSettingsHelpers';
import ApiSettingsKeyField from './ApiSettingsKeyField';

interface ApiSettingsKeySectionsProps {
  settings: Partial<Record<KeyField, string | undefined>>;
  inputs: Record<KeyField, string>;
  shows: Record<KeyField, boolean>;
  classifiedOpen: boolean;
  isPixel: boolean;
  labelClassName: string;
  hintClassName: string;
  inputClassName: string;
  eyeButtonClassName: string;
  linkButtonClassName: string;
  altLinkButtonClassName: string;
  onChange: (field: KeyField, value: string) => void;
  onToggleShow: (field: KeyField) => void;
  onOpenExternal: (url: string) => void;
  onToggleClassified: () => void;
}

function renderCommonKey(
  specIndex: number,
  settings: Partial<Record<KeyField, string | undefined>>,
  inputs: Record<KeyField, string>,
  shows: Record<KeyField, boolean>,
  onChange: (field: KeyField, value: string) => void,
  onToggleShow: (field: KeyField) => void,
  onOpenExternal: (url: string) => void,
  labelClassName: string,
  hintClassName: string,
  inputClassName: string,
  eyeButtonClassName: string,
  linkButtonClassName: string,
  altLinkButtonClassName: string,
) {
  const spec = COMMON_KEYS[specIndex];
  const baseUrlNote =
    specIndex === 0
      ? `Base URL 锁定: ${FIXED_ZHENZHEN_BASE}`
      : specIndex === 1
        ? `Base URL: ${RH_BASE}`
        : `Base URL 锁定: ${FIXED_ZHENZHEN_BASE} (与贞贞同地址, Key 独立)`;

  return (
    <ApiSettingsKeyField
      key={spec.field}
      spec={spec}
      savedValue={settings[spec.field]}
      inputValue={inputs[spec.field]}
      shown={shows[spec.field]}
      labelClassName={labelClassName}
      hintClassName={hintClassName}
      inputClassName={inputClassName}
      eyeButtonClassName={eyeButtonClassName}
      linkButtonClassName={linkButtonClassName}
      altLinkButtonClassName={altLinkButtonClassName}
      baseUrlNote={baseUrlNote}
      onChange={(value) => onChange(spec.field, value)}
      onToggleShow={onToggleShow}
      onOpenExternal={onOpenExternal}
    />
  );
}

export default function ApiSettingsKeySections({
  settings,
  inputs,
  shows,
  classifiedOpen,
  isPixel,
  labelClassName,
  hintClassName,
  inputClassName,
  eyeButtonClassName,
  linkButtonClassName,
  altLinkButtonClassName,
  onChange,
  onToggleShow,
  onOpenExternal,
  onToggleClassified,
}: ApiSettingsKeySectionsProps) {
  const configuredCount = CLASSIFIED_KEYS.filter((spec) => {
    const v = settings[spec.field];
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
  const totalCount = CLASSIFIED_KEYS.length;
  const toggleClassName = isPixel
    ? 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 px-btn'
    : 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition';

  return (
    <>
      {renderCommonKey(0, settings, inputs, shows, onChange, onToggleShow, onOpenExternal, labelClassName, hintClassName, inputClassName, eyeButtonClassName, linkButtonClassName, altLinkButtonClassName)}
      {renderCommonKey(1, settings, inputs, shows, onChange, onToggleShow, onOpenExternal, labelClassName, hintClassName, inputClassName, eyeButtonClassName, linkButtonClassName, altLinkButtonClassName)}
      {renderCommonKey(2, settings, inputs, shows, onChange, onToggleShow, onOpenExternal, labelClassName, hintClassName, inputClassName, eyeButtonClassName, linkButtonClassName, altLinkButtonClassName)}

      <div className="t8-api-settings-divider pt-3 border-t">
        <button
          type="button"
          onClick={onToggleClassified}
          aria-expanded={classifiedOpen}
          data-open={classifiedOpen}
          className={toggleClassName}
        >
          <Settings2 size={14} className="t8-api-settings-icon" />
          <span className="text-xs font-bold">分类独立 API Key【可选】</span>
          <span
            className="t8-api-settings-badge ml-1 px-1.5 py-0.5 text-[10px] rounded border"
            data-tone={configuredCount > 0 ? 'success' : 'muted'}
          >
            已配置 {configuredCount}/{totalCount}
          </span>
          <span className={`ml-auto flex items-center gap-1 text-[11px] ${hintClassName}`}>
            {classifiedOpen ? '收起' : '展开'}
            {classifiedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
        {!classifiedOpen && (
          <div className={`text-[11px] mt-2 ${hintClassName}`}>
            不必担心：<b>未填项会自动 fallback 到贞贞工坊通用 Key</b>，新手可直接保存忽略此区块。
          </div>
        )}
        {classifiedOpen && (
          <div className="mt-3">
            <div className={`text-[11px] ${hintClassName} mb-3`}>
              为不同模型系列单独配置 Key；<b>未填则自动 fallback 到贞贞工坊通用 Key</b>。后端会根据调用的模型名/路由自动选择。
            </div>
            <div className="space-y-4">
              {CLASSIFIED_KEYS.map((spec) => (
                <ApiSettingsKeyField
                  key={spec.field}
                  spec={spec}
                  savedValue={settings[spec.field]}
                  inputValue={inputs[spec.field]}
                  shown={shows[spec.field]}
                  labelClassName={labelClassName}
                  hintClassName={hintClassName}
                  inputClassName={inputClassName}
                  eyeButtonClassName={eyeButtonClassName}
                  linkButtonClassName={linkButtonClassName}
                  altLinkButtonClassName={altLinkButtonClassName}
                  fallbackHint
                  onChange={(value) => onChange(spec.field, value)}
                  onToggleShow={onToggleShow}
                  onOpenExternal={onOpenExternal}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
