import assert from 'node:assert/strict';

import { shouldAutoCreateUploadOutputs } from '../apps/web/src/components/nodes/uploadRunPolicy';

assert.equal(
  shouldAutoCreateUploadOutputs({
    runMode: 'batch',
    hasDownstreamLinks: true,
  }),
  false,
  'batch execution should not auto-create output nodes when upload nodes already have downstream links',
);

assert.equal(
  shouldAutoCreateUploadOutputs({
    runMode: 'single',
    hasDownstreamLinks: true,
  }),
  true,
  'manual single-node run should preserve the existing auto-output behavior',
);

assert.equal(
  shouldAutoCreateUploadOutputs({
    runMode: 'batch',
    hasDownstreamLinks: false,
  }),
  true,
  'batch execution may still auto-create output nodes when no downstream chain exists',
);

console.log('verify-upload-node-batch-output-policy-contract: ok');
