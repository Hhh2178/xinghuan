import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const canvasSource = readFileSync(join(root, 'apps', 'web', 'src', 'components', 'Canvas.tsx'), 'utf8');
const themeManagerSource = readFileSync(join(root, 'apps', 'web', 'src', 'components', 'ThemeTemplateManager.tsx'), 'utf8');
const stylesSource = readFileSync(join(root, 'apps', 'web', 'src', 'styles', 'index.css'), 'utf8');

const checks = [
  {
    name: 'canvas no longer imports theme music toggle',
    pass: !canvasSource.includes("import ThemeMusicToggle from './ThemeMusicToggle';"),
  },
  {
    name: 'canvas control rail no longer renders theme music toggle',
    pass: !canvasSource.includes('<ThemeMusicToggle template={currentTemplate} />'),
  },
  {
    name: 'theme template manager no longer exposes default music section',
    pass:
      !themeManagerSource.includes('默认音乐主题') &&
      !themeManagerSource.includes('播放来源') &&
      !themeManagerSource.includes('授权音频 URL') &&
      !themeManagerSource.includes('上传音乐'),
  },
  {
    name: 'shared canvas stylesheet no longer defines theme music toggle block',
    pass:
      !stylesSource.includes('.t8-theme-music-toggle') &&
      !stylesSource.includes('@keyframes t8-theme-music-spin'),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  process.exit(1);
}

console.log('PASS canvas audio playback UI has been removed');
