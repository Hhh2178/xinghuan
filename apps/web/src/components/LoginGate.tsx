import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, AtSign, Box, KeyRound, Loader2 } from 'lucide-react';
import * as api from '../services/api';
import type { AuthUser } from '../services/api';
import StellarCursorAura from './StellarCursorAura';

interface LoginGateProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginGate({ onLogin }: LoginGateProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    const updatePointer = (clientX: number, clientY: number) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = stage.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
        stage.style.setProperty('--xh-login-x', x.toFixed(4));
        stage.style.setProperty('--xh-login-y', y.toFixed(4));
        stage.style.setProperty('--xh-card-tilt-x', `${((0.5 - y) * 7).toFixed(2)}deg`);
        stage.style.setProperty('--xh-card-tilt-y', `${((x - 0.5) * 7).toFixed(2)}deg`);
      });
    };

    const onPointerMove = (event: PointerEvent) => updatePointer(event.clientX, event.clientY);
    const onPointerLeave = () => {
      stage.style.setProperty('--xh-login-x', '0.5');
      stage.style.setProperty('--xh-login-y', '0.5');
      stage.style.setProperty('--xh-card-tilt-x', '0deg');
      stage.style.setProperty('--xh-card-tilt-y', '0deg');
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      onLogin(await api.login(email, password));
    } catch (err: any) {
      setError(
        err?.message === 'INVALID_CREDENTIALS'
          ? '账号或密码不正确'
          : err?.message === 'LOGIN_RATE_LIMITED'
            ? '登录尝试过多，请稍后再试'
            : err?.message || '登录失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const stars = Array.from({ length: 58 }, (_, index) => ({
    id: index,
    left: `${(index * 37) % 100}%`,
    top: `${(index * 61 + 11) % 100}%`,
    size: `${1 + (index % 3) * 0.65}px`,
    duration: `${4 + (index % 7) * 0.55}s`,
    delay: `${(index % 13) * -0.38}s`,
  }));

  return (
    <div
      ref={stageRef}
      className="xh-entry-shell xh-login-stage min-h-[100dvh] overflow-hidden text-slate-100"
      style={
        {
          '--xh-login-x': '0.5',
          '--xh-login-y': '0.5',
          '--xh-card-tilt-x': '0deg',
          '--xh-card-tilt-y': '0deg',
        } as CSSProperties
      }
    >
      <StellarCursorAura />
      <div className="xh-nebula-bg" aria-hidden="true">
        <div className="xh-nebula-layer xh-nebula-layer--deep" />
        <div className="xh-nebula-layer xh-nebula-layer--mint" />
        <div className="xh-nebula-layer xh-nebula-layer--cyan" />
        <div className="xh-star-field">
          {stars.map((star) => (
            <span
              key={star.id}
              className="xh-star-particle"
              style={
                {
                  '--xh-star-left': star.left,
                  '--xh-star-top': star.top,
                  '--xh-star-size': star.size,
                  '--xh-star-duration': star.duration,
                  '--xh-star-delay': star.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <main className="relative z-10 min-h-[100dvh] px-5 py-6 sm:px-8 lg:px-12">
        <section className="xh-login-orbit-layout mx-auto grid min-h-[calc(100dvh-48px)] w-full max-w-[1440px] items-center gap-8">
          <div className="xh-login-visual-pane" role="img" aria-label="星幻微缩星系星图">
            <div className="xh-micro-galaxy xh-nebula-scene">
              <span className="xh-nebula-depth xh-nebula-depth--back" />
              <span className="xh-nebula-depth xh-nebula-depth--front" />
              <span className="xh-nebula-layer xh-nebula-layer--a" />
              <span className="xh-nebula-layer xh-nebula-layer--b" />
              <span className="xh-nebula-layer xh-nebula-layer--c" />
              <span className="xh-galaxy-ring xh-nebula-ring xh-nebula-ring--outer" />
              <span className="xh-galaxy-ring xh-nebula-ring xh-nebula-ring--inner" />
              <span className="xh-nebula-spark xh-nebula-spark--a" />
              <span className="xh-nebula-spark xh-nebula-spark--b" />
              <span className="xh-nebula-spark xh-nebula-spark--c" />
              <span className="xh-nebula-spark xh-nebula-spark--d" />
              <span className="xh-nebula-spark xh-nebula-spark--e" />
              <span className="xh-nebula-spark xh-nebula-spark--f" />
            </div>
          </div>

          <div className="xh-login-form-pane">
            <section className="xh-login-card-stellar w-full max-w-[420px] rounded-[2.15rem] p-8 sm:p-10">
              <span className="xh-glow-dot xh-glow-dot--tl" aria-hidden="true" />
              <span className="xh-glow-dot xh-glow-dot--br" aria-hidden="true" />

              <div className="mb-8 flex flex-col items-center text-center">
                <div className="xh-entry-logo mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Box size={27} strokeWidth={2.2} />
                </div>
                <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-cyan-50">星幻画布</h1>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.3em] text-[#bacbc0]">
                  XingHuan Canvas
                </p>
              </div>

              <div className="mb-7 text-center">
                <h2 className="text-xl font-medium text-cyan-50/95">进入创作星域</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">量子星图</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="ml-1 block text-xs font-medium tracking-[0.15em] text-[#bacbc0]">账号邮箱</span>
                  <span className="relative block">
                    <AtSign className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-100/45" size={20} />
                    <input
                      className="xh-input-stellar h-14 w-full rounded-2xl pl-12 pr-4 text-sm text-cyan-50 placeholder:text-slate-500"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      placeholder="Enter your explorer ID"
                      type="email"
                    />
                  </span>
                </label>

                <label className="block space-y-2">
                  <span className="ml-1 block text-xs font-medium tracking-[0.15em] text-[#bacbc0]">访问密钥</span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-100/45" size={20} />
                    <input
                      className="xh-input-stellar h-14 w-full rounded-2xl pl-12 pr-4 text-sm text-cyan-50 placeholder:text-slate-500"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      type="password"
                      autoFocus
                    />
                  </span>
                </label>

                {error && (
                  <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
                    {error}
                  </div>
                )}

                <button
                  className="xh-btn-stellar flex h-14 w-full items-center justify-center gap-3 rounded-2xl px-4 text-[15px] font-semibold text-[#061526] transition disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || !email || !password}
                  type="submit"
                >
                  <span>进入星幻工作区</span>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight className="xh-btn-arrow" size={19} />}
                </button>
              </form>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
