import type { CanvasPresentation } from '../stores/canvasPresentation';

interface CanvasPresentationToggleProps {
  presentation: CanvasPresentation;
  onChange: (presentation: CanvasPresentation) => void;
}

const OPTIONS: Array<{ value: CanvasPresentation; label: string; title: string; preview?: boolean }> = [
  { value: 'legacy', label: '旧版', title: '旧版画布' },
  { value: 'modern', label: '新版', title: '新版画布（预览）', preview: true },
];

export function CanvasPresentationToggle({ presentation, onChange }: CanvasPresentationToggleProps) {
  return (
    <div className="t8-canvas-presentation-toggle" role="group" aria-label="画布样式">
      <span className="t8-canvas-presentation-toggle__label">画布样式</span>
      {OPTIONS.map((option) => {
        const selected = presentation === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`t8-canvas-presentation-toggle__option ${selected ? 'is-active' : ''}`}
            aria-pressed={selected}
            aria-label={option.title}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.preview ? <em>预览</em> : null}
          </button>
        );
      })}
    </div>
  );
}
