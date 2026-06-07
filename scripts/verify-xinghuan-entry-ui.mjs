import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = {
  app: join(root, 'apps/web/src/App.tsx'),
  login: join(root, 'apps/web/src/components/LoginGate.tsx'),
  cursor: join(root, 'apps/web/src/components/StellarCursorAura.tsx'),
  canvas: join(root, 'apps/web/src/components/Canvas.tsx'),
  sidebar: join(root, 'apps/web/src/components/Sidebar.tsx'),
  styles: join(root, 'apps/web/src/styles/index.css'),
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]),
);

const checks = [
  {
    name: 'login matches approved centered stellar card copy',
    pass:
      source.login.includes('星幻画布') &&
      source.login.includes('XingHuan Canvas') &&
      source.login.includes('进入创作星域') &&
      source.login.includes('量子星图系统已就绪') &&
      !source.login.includes('把画布打开成一张星图') &&
      !source.login.includes('每个用户拥有独立星域') &&
      !source.login.includes('登录后将点亮星图装载动画') &&
      !source.login.includes('私有工作区'),
  },
  {
    name: 'login uses centered glassmorphism stage',
    pass:
      source.login.includes('xh-entry-shell') &&
      source.login.includes('xh-login-stage') &&
      source.login.includes('xh-login-card-stellar') &&
      source.login.includes('xh-input-stellar') &&
      source.login.includes('xh-btn-stellar'),
  },
  {
    name: 'mouse-follow aura is implemented',
    pass:
      source.login.includes('StellarCursorAura') &&
      source.login.includes('--xh-login-x') &&
      source.cursor.includes('xh-cursor-aura') &&
      source.cursor.includes('--xh-pointer-x') &&
      source.styles.includes('.xh-cursor-aura'),
  },
  {
    name: 'login renders css-only nebula without design placeholder buttons',
    pass:
      source.login.includes('xh-nebula-bg') &&
      source.login.includes('xh-nebula-layer') &&
      source.login.includes('xh-star-field') &&
      source.styles.includes('.xh-nebula-bg') &&
      !source.login.includes('SSO 接入') &&
      !source.login.includes('组织网络') &&
      !source.login.includes('或通过以下方式接入') &&
      !source.login.includes('XINGHUAN') &&
      !source.login.includes('STELLAR CANVAS') &&
      !source.login.includes('星幻微缩星系星图') &&
      !source.login.includes('>星幻<'),
  },
  {
    name: 'startup transition uses quantum stellar sync',
    pass:
      source.app.includes('xh-quantum-transition') &&
      source.app.includes('节点同步中') &&
      source.app.includes('正在接入星域核心') &&
      source.app.includes('权限校验完成') &&
      source.app.includes('星图渲染管线初始化') &&
      source.styles.includes('.xh-transition-orbit') &&
      source.styles.includes('@keyframes xhParticleSuck') &&
      source.styles.includes('@keyframes xhTransitionFlash'),
  },
  {
    name: 'empty canvas page uses stellar create CTA',
    pass: source.canvas.includes('xh-empty-canvas') && source.canvas.includes('开启第一张星图') && source.canvas.includes('createCanvas'),
  },
  {
    name: 'sidebar empty state matches stellar visual language',
    pass: source.sidebar.includes('xh-sidebar-empty') && source.sidebar.includes('创建星图画布'),
  },
  {
    name: 'glassmorphism and animation css exists',
    pass:
      source.styles.includes('.xh-login-card-stellar') &&
      source.styles.includes('backdrop-filter: blur(24px)') &&
      source.styles.includes('@keyframes xhStellarFloat') &&
      source.styles.includes('@keyframes xhBootOrbit') &&
      source.styles.includes('@keyframes xhNebulaLayerDrift'),
  },
  {
    name: 'reduced motion fallback exists',
    pass: source.styles.includes('@media (prefers-reduced-motion: reduce)') && source.styles.includes('xh-cursor-aura'),
  },
  {
    name: 'workspace topbar removes legacy promotional buttons',
    pass:
      !source.app.includes('在线画布') &&
      !source.app.includes('视频教程') &&
      !source.app.includes('贞贞工坊') &&
      !source.app.includes('AIX产品') &&
      !source.app.includes('T8老师') &&
      !source.app.includes('cloud.pebbling.cn') &&
      !source.app.includes('runninghub.cn/user-center') &&
      !source.app.includes('runninghub.ai/user-center') &&
      !source.app.includes('ai.t8star.org') &&
      !source.app.includes('Lovexy_0222') &&
      !source.app.includes('rh-v1121'),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} entry UI checks failed.`);
  process.exit(1);
}

console.log('\nAll Xinghuan entry UI checks passed.');
