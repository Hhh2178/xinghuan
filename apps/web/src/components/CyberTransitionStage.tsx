import brandStellarGlitchLogo from '../assets/brand-stellar-glitch-logo.png';

export default function CyberTransitionStage() {
  return (
    <div className="xh-entry-shell xh-cyber-transition-shell flex h-screen items-center justify-center overflow-hidden text-cyan-100">
      <div className="xh-cyber-grid" aria-hidden="true" />
      <main className="xh-cyber-transition-center relative z-10 flex h-full w-full items-center justify-center px-6">
        <section className="xh-cyber-transition-stack" aria-label="星幻画布启动同步中">
          <div className="xh-cyber-transition-orbit" aria-hidden="true">
            <span className="xh-cyber-transition-orbit__halo" />
            <span className="xh-cyber-transition-orbit__ring xh-cyber-transition-orbit__ring--outer" />
            <span className="xh-cyber-transition-orbit__ring xh-cyber-transition-orbit__ring--mid" />
            <span className="xh-cyber-transition-orbit__ring xh-cyber-transition-orbit__ring--inner" />
            <span className="xh-cyber-transition-orbit__scan" />
            <img className="xh-cyber-transition-logo" src={brandStellarGlitchLogo} alt="星幻画布启动中" />
          </div>
          <div className="xh-cyber-transition-copy">
            <h2 className="xh-cyber-transition-title">正在接通星幻画布</h2>
            <p className="xh-cyber-transition-subtitle">校验权限、恢复工作区、同步节点目录。</p>
          </div>
          <div className="xh-cyber-transition-progress" aria-hidden="true">
            <div className="xh-cyber-transition-progress__line">
              <span />
            </div>
            <div className="xh-cyber-transition-progress__meta">
              <span>AUTH CHECK</span>
              <span>WORKSPACE SYNC</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
