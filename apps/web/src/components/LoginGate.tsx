import { useState } from 'react';
import { LockKeyhole, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import * as api from '../services/api';
import type { AuthUser } from '../services/api';

interface LoginGateProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginGate({ onLogin }: LoginGateProps) {
  const [email, setEmail] = useState('admin@xinghuan.local');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      onLogin(await api.login(email, password));
    } catch (err: any) {
      setError(err?.message === 'INVALID_CREDENTIALS' ? '账号或密码不正确' : err?.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#05070a] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_80%_12%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,#05070a_0%,#0d1117_48%,#07130f_100%)]" />
      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <section className="w-full max-w-[420px] rounded-[8px] border border-cyan-300/20 bg-slate-950/82 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-cyan-300/35 bg-cyan-400/10 text-cyan-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal">星幻无限画布</h1>
              <p className="mt-1 text-xs text-cyan-100/62">安全工作区登录</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-slate-300">账号邮箱</span>
              <input
                className="h-11 w-full rounded-[6px] border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-slate-300">密码</span>
              <input
                className="h-11 w-full rounded-[6px] border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                type="password"
                autoFocus
              />
            </label>

            {error && (
              <div className="rounded-[6px] border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {error}
              </div>
            )}

            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !email || !password}
              type="submit"
            >
              {submitting ? <Loader2 className="animate-spin" size={17} /> : <LockKeyhole size={17} />}
              进入工作区
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
            <Sparkles size={14} className="text-emerald-300" />
            画布、素材和资源库将按当前账号隔离保存。
          </div>
        </section>
      </main>
    </div>
  );
}
