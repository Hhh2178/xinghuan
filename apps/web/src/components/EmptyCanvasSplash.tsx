import { Sparkles } from 'lucide-react';

interface EmptyCanvasSplashProps {
  background: string;
  textColor: string;
  visualStyle?: string;
  onCreate: () => void;
}

export default function EmptyCanvasSplash({
  background,
  textColor,
  visualStyle,
  onCreate,
}: EmptyCanvasSplashProps) {
  return (
    <div
      className="t8-canvas-shell xh-empty-canvas xh-cyber-empty-shell relative flex flex-1 items-center justify-center overflow-hidden"
      data-theme-visual={visualStyle}
      style={{ background, color: textColor }}
    >
      <div className="xh-cyber-empty-grid" aria-hidden="true" />
      <div className="xh-cyber-empty-axis xh-cyber-empty-axis--horizontal" aria-hidden="true" />
      <div className="xh-cyber-empty-axis xh-cyber-empty-axis--vertical" aria-hidden="true" />
      <div className="xh-cyber-empty-center-mark" aria-hidden="true">
        <span />
      </div>

      <section className="xh-cyber-empty-card relative z-10 w-[min(840px,calc(100%-40px))] overflow-hidden rounded-[28px] px-6 py-7 text-center md:px-8 md:py-9">
        <div className="xh-cyber-empty-card__frame pointer-events-none absolute inset-0 rounded-[28px]" aria-hidden="true" />
        <div className="xh-cyber-empty-card__frame xh-cyber-empty-card__frame--inner pointer-events-none absolute inset-[12px] rounded-[22px]" aria-hidden="true" />
        <div className="xh-cyber-empty-card__chrome" aria-hidden="true">
          <span className="xh-cyber-empty-card__dot" />
          <span className="xh-cyber-empty-card__dot" />
          <span className="xh-cyber-empty-card__dot" />
          <span className="xh-cyber-empty-card__label">CANVAS ENTRY</span>
        </div>

        <div className="xh-cyber-empty-kicker mt-8 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/72">
          STAR MAP BOOTSTRAP
        </div>

        <h2 className="xh-cyber-empty-title mt-4 text-3xl font-black text-white md:text-[34px]">开启第一张星图</h2>
        <p className="xh-cyber-empty-copy mx-auto mt-4 max-w-[540px] text-[15px] leading-8">
          从空白画布开始，这里会成为你的节点星座、素材资产库和任务历史入口。
        </p>

        <div className="xh-cyber-empty-detail mx-auto mt-6 max-w-[460px]">
          <span>节点编排</span>
          <span>素材归档</span>
          <span>任务回放</span>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="xh-cyber-empty-action mx-auto mt-8 flex h-14 items-center justify-center gap-2 rounded-md px-8 text-base font-black text-slate-950 transition"
        >
          <Sparkles size={18} />
          创建星图画布
        </button>

        <div className="xh-cyber-empty-footer mt-8">
          <span className="xh-cyber-empty-footer__dot" aria-hidden="true" />
          SYSTEM READY // WAITING FOR INPUT
        </div>
      </section>
    </div>
  );
}
