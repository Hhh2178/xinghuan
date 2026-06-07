import { useEffect, useRef, type CSSProperties } from 'react';

interface StellarCursorAuraProps {
  className?: string;
}

export default function StellarCursorAura({ className = '' }: StellarCursorAuraProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        target.style.setProperty('--xh-pointer-x', `${event.clientX}px`);
        target.style.setProperty('--xh-pointer-y', `${event.clientY}px`);
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`xh-cursor-aura ${className}`.trim()}
      style={
        {
          '--xh-pointer-x': '50vw',
          '--xh-pointer-y': '44vh',
        } as CSSProperties
      }
    />
  );
}
