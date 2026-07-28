import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const recoveryStyles = readFileSync(new URL('./error-recovery.css', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

describe('error recovery stylesheet boundary', () => {
  it('keeps recovery selectors scoped and explicitly imported by the web entry', () => {
    expect(indexStyles).toContain("@import './error-recovery.css';");
  expect(recoveryStyles).toContain('.xh-workspace-error-boundary');
  expect(recoveryStyles).toContain('display: flex;');
  expect(recoveryStyles).toContain('flex-direction: column;');
  expect(recoveryStyles).toContain('height: 100%;');
    expect(recoveryStyles).toContain('.xh-node-render-boundary > .xh-error-recovery');
    expect(recoveryStyles).toContain('.xh-error-recovery-actions > button:focus-visible');
    expect(recoveryStyles).not.toMatch(/(^|\n)\s*(body|html|\*)\s*\{/);
  });
});
