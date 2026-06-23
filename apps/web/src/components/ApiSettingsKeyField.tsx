import { ExternalLink, Eye, EyeOff, Lock } from 'lucide-react';

import type { KeyField, KeySpec } from './apiSettingsHelpers';

interface ApiSettingsKeyFieldProps {
  spec: KeySpec;
  savedValue?: string;
  inputValue: string;
  shown: boolean;
  labelClassName: string;
  hintClassName: string;
  inputClassName: string;
  eyeButtonClassName: string;
  linkButtonClassName: string;
  altLinkButtonClassName: string;
  fallbackHint?: boolean;
  baseUrlNote?: string;
  onChange: (value: string) => void;
  onToggleShow: (field: KeyField) => void;
  onOpenExternal: (url: string) => void;
}

function toMaskedDisplay(value?: string): string {
  if (!value) return '';
  if (value.includes('*')) return value;
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function renderGetKeyButtons(
  field: KeyField,
  linkButtonClassName: string,
  altLinkButtonClassName: string,
  onOpenExternal: (url: string) => void,
) {
  if (field === 'zhenzhenApiKey') {
    return (
      <button
        type="button"
        onClick={() => onOpenExternal('https://ai.t8star.org/register?aff=dP7j')}
        className={linkButtonClassName}
        title="前往贞贞工坊注册获取 APIKEY"
      >
        <ExternalLink size={11} /> 获取 APIKey
      </button>
    );
  }
  if (field === 'rhApiKey') {
    return (
      <>
        <button
          type="button"
          onClick={() => onOpenExternal('https://www.runninghub.cn/user-center/1819214514410942465/webapp?inviteCode=rh-v1121')}
          className={linkButtonClassName}
          title="国内用户·前往 runninghub.cn 获取 APIKEY"
        >
          <ExternalLink size={11} /> 获取 APIKey：国内用户
        </button>
        <button
          type="button"
          onClick={() => onOpenExternal('https://www.runninghub.ai/user-center/1819214514410942465/webapp?inviteCode=rh-v1121')}
          className={altLinkButtonClassName}
          title="国外用户·前往 runninghub.ai 获取 APIKEY"
        >
          <ExternalLink size={11} /> 国外用户
        </button>
      </>
    );
  }
  return null;
}

export default function ApiSettingsKeyField({
  spec,
  savedValue,
  inputValue,
  shown,
  labelClassName,
  hintClassName,
  inputClassName,
  eyeButtonClassName,
  linkButtonClassName,
  altLinkButtonClassName,
  fallbackHint,
  baseUrlNote,
  onChange,
  onToggleShow,
  onOpenExternal,
}: ApiSettingsKeyFieldProps) {
  const field = spec.field;
  const hasSaved = !!savedValue;
  const maskedDisplay = toMaskedDisplay(savedValue);
  const keyButtons = renderGetKeyButtons(
    field,
    linkButtonClassName,
    altLinkButtonClassName,
    onOpenExternal,
  );

  return (
    <div className="space-y-2">
      <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelClassName}`}>
        <span className={`w-2 h-2 rounded-full ${spec.bullet}`} />
        {spec.label}
        <span className={`text-[11px] font-normal ${hintClassName}`}>{spec.desc}</span>
        {hasSaved && (
          <span className="t8-api-settings-badge text-[10px] font-bold px-1.5 py-0.5 rounded border" data-tone="success">
            ✓ 已保存 {maskedDisplay}
          </span>
        )}
        {fallbackHint && !hasSaved && (
          <span className="t8-api-settings-badge text-[10px] font-normal px-1.5 py-0.5 rounded border" data-tone="muted">
            未设置 · 使用通用 Key
          </span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={shown ? 'text' : 'password'}
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasSaved ? '留空保持不变 / 输入新值覆盖' : (fallbackHint ? '留空则使用通用 Key / 输入独立 Key' : '请输入 sk-...')}
          className={inputClassName}
          autoComplete="off"
        />
        <button
          onClick={() => onToggleShow(field)}
          className={eyeButtonClassName}
          title={shown ? '隐藏' : '显示明文'}
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {(baseUrlNote || keyButtons) && (
        <div className={`flex items-center gap-2 flex-wrap text-[11px] ${hintClassName}`}>
          {baseUrlNote && (
            <span className="flex items-center gap-1.5">
              <Lock size={11} /> {baseUrlNote}
            </span>
          )}
          {keyButtons}
        </div>
      )}
    </div>
  );
}
