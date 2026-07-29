import type { CanvasPresentation } from '../stores/canvasPresentation';

interface CanvasPresentationToggleProps {
  presentation: CanvasPresentation;
  onChange: (presentation: CanvasPresentation) => void;
}

const OPTIONS: Array<{ value: CanvasPresentation; label: string }> = [
  { value: 'legacy', label: '旧版画布' },
  { value: 'modern', label: '新版画布（预览）' },
];

export function CanvasPresentationToggle({ presentation, onChange }: CanvasPresentationToggleProps) {
  return (
    <div className="t8-canvas-presentation-toggle" role="group" aria-label="画布界面">
      {OPTIONS.map((option) => {
        const selected = presentation === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`t8-canvas-presentation-toggle__option ${selected ? 'is-active' : ''}`}
            aria-pressed={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
