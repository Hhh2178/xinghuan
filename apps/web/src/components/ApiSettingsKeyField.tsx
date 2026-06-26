import { Eye, EyeOff, Lock } from 'lucide-react';

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
  fallbackHint?: boolean;
  baseUrlNote?: string;
  onChange: (value: string) => void;
  onToggleShow: (field: KeyField) => void;
}

function toMaskedDisplay(value?: string): string {
  if (!value) return '';
  if (value.includes('*')) return value;
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
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
  fallbackHint,
  baseUrlNote,
  onChange,
  onToggleShow,
}: ApiSettingsKeyFieldProps) {
  const field = spec.field;
  const hasSaved = !!savedValue;
  const maskedDisplay = toMaskedDisplay(savedValue);

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
      {baseUrlNote && (
        <div className={`flex items-center gap-2 flex-wrap text-[11px] ${hintClassName}`}>
          <span className="flex items-center gap-1.5">
            <Lock size={11} /> {baseUrlNote}
          </span>
        </div>
      )}
    </div>
  );
}
