import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, AtSign, KeyRound, Loader2 } from 'lucide-react';
import * as api from '../services/api';
import type { AuthUser } from '../services/api';
import brandStellarGlitchLogo from '../assets/brand-stellar-glitch-logo.png';
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
        stage.style.setProperty('--xh-card-tilt-x', `${((0.5 - y) * 5).toFixed(2)}deg`);
        stage.style.setProperty('--xh-card-tilt-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
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

  return (
    <div
      ref={stageRef}
      className="xh-entry-shell xh-login-stage xh-cyber-login-shell min-h-[100dvh] overflow-hidden text-slate-100"
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
      <div className="xh-cyber-grid" aria-hidden="true" />
      <div className="xh-cyber-scanlines" aria-hidden="true" />
      <div className="xh-cyber-noise" aria-hidden="true" />
      <div className="xh-cyber-login-shell__frame" aria-hidden="true" />

      <main className="relative z-10 min-h-[100dvh] px-4 py-4 sm:px-8 sm:py-8">
        <section className="xh-cyber-login-layout mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-[1560px] items-stretch gap-6">
          <section className="xh-cyber-login-visual" aria-label="星幻 Cyber PCB 登录主视觉">
            <div className="xh-cyber-logo-stage">
              <div className="xh-cyber-logo-halo" aria-hidden="true" />
              <div className="xh-cyber-logo-rings" aria-hidden="true">
                <span className="xh-cyber-logo-ring xh-cyber-logo-ring--outer" />
                <span className="xh-cyber-logo-ring xh-cyber-logo-ring--mid" />
                <span className="xh-cyber-logo-ring xh-cyber-logo-ring--inner" />
              </div>
              <div className="xh-cyber-logo-traces" aria-hidden="true">
                <span className="xh-cyber-logo-trace xh-cyber-logo-trace--top" />
                <span className="xh-cyber-logo-trace xh-cyber-logo-trace--right" />
                <span className="xh-cyber-logo-trace xh-cyber-logo-trace--bottom" />
                <span className="xh-cyber-logo-trace xh-cyber-logo-trace--left" />
              </div>
              <img
                className="xh-cyber-brand-logo"
                src={brandStellarGlitchLogo}
                alt="星幻画布品牌 logo"
              />
            </div>

            <div className="xh-cyber-visual-copy">
              <p className="xh-cyber-kicker">XINGHUAN CANVAS // CYBER PCB ENTRY</p>
              <h1 className="xh-cyber-title">星幻画布</h1>
              <p className="xh-cyber-copy">
                左侧主视觉切成品牌电路核心，右侧保持控制台式登录入口，进入后仍沿用现有认证链路与工作区状态。
              </p>
            </div>

            <div className="xh-cyber-status-strip" aria-hidden="true">
              <span>PCB BUS: READY</span>
              <span>AUTH GATE: SECURE</span>
              <span>NODE FABRIC: ONLINE</span>
            </div>
          </section>

          <div className="xh-cyber-console-pane">
            <section className="xh-cyber-console">
              <div className="xh-cyber-console__chrome">
                <span className="xh-cyber-console__dot" />
                <span className="xh-cyber-console__dot" />
                <span className="xh-cyber-console__dot" />
                <span className="xh-cyber-console__label">AUTH CONSOLE</span>
              </div>

              <div className="xh-cyber-console__head">
                <p className="xh-cyber-console__eyebrow">SECURE SESSION HANDSHAKE</p>
                <h2 className="xh-cyber-console__title">登录到星幻控制台</h2>
                <p className="xh-cyber-console__sub">保持现有账号体系，仅替换为硬边 Cyber PCB 视觉壳层。</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="xh-cyber-field-label">账号邮箱</span>
                  <span className="relative block">
                    <AtSign className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8af7d3]/70" size={18} />
                    <input
                      className="xh-cyber-input h-14 w-full pl-11 pr-4 text-sm text-[#d9fff2] placeholder:text-[#5f8f84]"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      placeholder="operator@xinghuan.ai"
                      type="email"
                    />
                  </span>
                </label>

                <label className="block space-y-2">
                  <span className="xh-cyber-field-label">访问密钥</span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8af7d3]/70" size={18} />
                    <input
                      className="xh-cyber-input h-14 w-full pl-11 pr-4 text-sm text-[#d9fff2] placeholder:text-[#5f8f84]"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      type="password"
                      autoFocus
                    />
                  </span>
                </label>

                {error && <div className="xh-cyber-error">{error}</div>}

                <div className="xh-cyber-console__meta">
                  <span>LOGIN LOGIC: CURRENT</span>
                  <span>API CONTRACT: LOCKED</span>
                </div>

                <button
                  className="xh-cyber-button flex h-14 w-full items-center justify-center gap-3 px-4 text-[15px] font-semibold text-[#03110e] transition disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || !email || !password}
                  type="submit"
                >
                  <span>进入星幻工作区</span>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight className="xh-cyber-button__arrow" size={18} />}
                </button>
              </form>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
