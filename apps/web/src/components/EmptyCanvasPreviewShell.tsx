import { LogOut, UserRound, Wifi, WifiOff } from 'lucide-react';
import brandStellarGlitchLogo from '../assets/brand-stellar-glitch-logo.png';
import EmptyCanvasSplash from './EmptyCanvasSplash';

declare const __APP_VERSION__: string;

interface EmptyCanvasPreviewShellProps {
  backendStatus: 'checking' | 'ok' | 'error';
}

export default function EmptyCanvasPreviewShell({ backendStatus }: EmptyCanvasPreviewShellProps) {
  return (
    <div className="t8-app-shell flex h-screen flex-col overflow-hidden bg-zinc-950 text-white">
      <header className="t8-topbar flex items-center justify-between border-b border-white/10 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <img className="xh-cyber-topbar-logo xh-cyber-topbar-logo--large" src={brandStellarGlitchLogo} alt="星幻画布" />
          <span className="t8-topbar-status-chip rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
            v{__APP_VERSION__}
          </span>
          <div
            className={`t8-topbar-status-chip flex items-center gap-1.5 text-[11px] ${
              backendStatus === 'ok'
                ? 'text-emerald-400'
                : backendStatus === 'error'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {backendStatus === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {backendStatus === 'ok' && '后端已连接'}
            {backendStatus === 'error' && '后端未连接'}
            {backendStatus === 'checking' && '检测中...'}
          </div>
          <span className="t8-topbar-status-chip flex items-center gap-1.5 text-[11px] text-cyan-100">
            <UserRound size={12} />
            预览账号
          </span>
          <button className="t8-icon-button" title="退出登录" type="button">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <EmptyCanvasSplash
        visualStyle="default"
        background="linear-gradient(180deg, rgba(8, 11, 20, 0.96), rgba(9, 12, 20, 0.98))"
        textColor="rgba(186, 202, 192, 0.88)"
        onCreate={() => undefined}
      />
    </div>
  );
}
