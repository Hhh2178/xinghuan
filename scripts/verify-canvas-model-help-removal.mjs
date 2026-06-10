import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const canvasSource = readFileSync(join(root, 'apps', 'web', 'src', 'components', 'Canvas.tsx'), 'utf8');

const checks = [
  {
    name: 'canvas no longer defines model usage help text',
    pass: !canvasSource.includes('const MODEL_USAGE_HELP_TEXT ='),
  },
  {
    name: 'canvas no longer keeps model help toggle state',
    pass:
      !canvasSource.includes('const [modelHelpOpen, setModelHelpOpen] = useState(false);') &&
      !canvasSource.includes('setModelHelpOpen('),
  },
  {
    name: 'canvas control rail no longer renders model help toggle',
    pass:
      !canvasSource.includes('data-canvas-floating-ui="model-help-toggle"') &&
      !canvasSource.includes('aria-label="模型注意事项"') &&
      !canvasSource.includes('title="模型注意事项"'),
  },
  {
    name: 'canvas no longer renders model help panel shell',
    pass:
      !canvasSource.includes('data-canvas-floating-ui="model-help-panel"') &&
      !canvasSource.includes('className="t8-model-help-panel nodrag nopan"') &&
      !canvasSource.includes('MODEL NOTES'),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  process.exit(1);
}

console.log('PASS canvas model help UI has been removed');
