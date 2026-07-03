import type { CSSProperties } from 'react';

import type { ComfyuiVisibleParamField } from './comfyuiNodeHelpers';

function parseInputValue(kind: string, value: unknown) {
  if (kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function renderField(
  field: ComfyuiVisibleParamField,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
  inputClassName: string,
  inputStyle: CSSProperties,
) {
  const { param } = field;
  if (param.kind === 'textarea') {
    return (
      <textarea
        value={String(value ?? '')}
        onChange={(event) => onChange(param.key, event.target.value)}
        rows={param.rows || 4}
        className={`${inputClassName} resize-y`}
        style={inputStyle}
        placeholder={param.placeholder}
      />
    );
  }
  if (param.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(param.key, event.target.checked)} />
        <span>{param.label}</span>
      </label>
    );
  }
  return (
    <input
      type={param.kind === 'number' ? 'number' : 'text'}
      min={param.min}
      max={param.max}
      step={param.step}
      value={parseInputValue(param.kind, value)}
      onChange={(event) => onChange(param.key, param.kind === 'number' ? event.target.value : event.target.value)}
      className={inputClassName}
      style={inputStyle}
      placeholder={param.placeholder}
    />
  );
}

interface ComfyUINodeParamSectionProps {
  primaryFields: ComfyuiVisibleParamField[];
  secondaryFields: ComfyuiVisibleParamField[];
  advancedFields: ComfyuiVisibleParamField[];
  values: Record<string, unknown>;
  inputClassName: string;
  inputStyle: CSSProperties;
  onChange: (key: string, value: unknown) => void;
}

export default function ComfyUINodeParamSection({
  primaryFields,
  secondaryFields,
  advancedFields,
  values,
  inputClassName,
  inputStyle,
  onChange,
}: ComfyUINodeParamSectionProps) {
  if (!primaryFields.length && !secondaryFields.length && !advancedFields.length) {
    return (
      <section className="rounded border px-2 py-2 text-[11px]" style={{ borderColor: inputStyle.borderColor, color: inputStyle.color }}>
        当前工作流没有暴露可编辑参数，直接运行即可。
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="text-xs font-black">核心参数</div>
      {primaryFields.map((field) => (
        <label key={field.param.key} className="block space-y-1">
          <span className="text-[11px] font-bold opacity-75">{field.param.label}</span>
          {renderField(field, values[field.param.key], onChange, inputClassName, inputStyle)}
        </label>
      ))}
      {(secondaryFields.length || advancedFields.length) ? (
        <details className="rounded border p-2" style={{ borderColor: inputStyle.borderColor }}>
          <summary className="cursor-pointer text-[11px] font-black">更多参数</summary>
          <div className="mt-2 space-y-2">
            {[...secondaryFields, ...advancedFields].map((field) => (
              <label key={field.param.key} className="block space-y-1">
                <span className="text-[11px] font-bold opacity-75">{field.param.label}</span>
                {renderField(field, values[field.param.key], onChange, inputClassName, inputStyle)}
              </label>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

