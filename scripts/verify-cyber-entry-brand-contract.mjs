import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const files = {
  app: path.join(rootDir, 'apps/web/src/App.tsx'),
  canvas: path.join(rootDir, 'apps/web/src/components/Canvas.tsx'),
  loginGate: path.join(rootDir, 'apps/web/src/components/LoginGate.tsx'),
  styles: path.join(rootDir, 'apps/web/src/styles/index.css'),
};

const expectations = [
  {
    file: 'loginGate',
    label: 'LoginGate cyber shell',
    patterns: ['xh-cyber-login-shell', 'xh-cyber-login-layout', 'xh-cyber-console', 'brand-stellar-glitch-logo.png'],
  },
  {
    file: 'app',
    label: 'App transition shell',
    patterns: ['xh-cyber-transition-shell', 'xh-cyber-transition-panel', 'xh-cyber-brand-lockup', 'brand-stellar-glitch-logo.png'],
  },
  {
    file: 'canvas',
    label: 'Canvas cyber empty shell',
    patterns: ['xh-cyber-empty-shell', 'xh-cyber-empty-card', 'xh-cyber-empty-status'],
  },
  {
    file: 'styles',
    label: 'Shared cyber styles',
    patterns: [
      '.xh-cyber-login-shell',
      '.xh-cyber-login-layout',
      '.xh-cyber-brand-logo',
      '.xh-cyber-console',
      '.xh-cyber-input',
      '.xh-cyber-button',
      '.xh-cyber-transition-shell',
      '.xh-cyber-brand-lockup',
      '.xh-cyber-empty-shell .xh-cyber-empty-card',
    ],
  },
];

async function main() {
  const contents = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, filePath]) => [key, await readFile(filePath, 'utf8')]),
    ),
  );

  const failures = [];

  for (const expectation of expectations) {
    const content = contents[expectation.file];
    for (const pattern of expectation.patterns) {
      if (!content.includes(pattern)) {
        failures.push(`${expectation.label}: missing "${pattern}"`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Cyber entry brand contract failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Cyber entry brand contract passed.');
}

main().catch((error) => {
  console.error('Cyber entry brand contract crashed.');
  console.error(error);
  process.exitCode = 1;
});
