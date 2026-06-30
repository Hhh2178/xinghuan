type UploadRunMode = 'idle' | 'single' | 'batch';

export interface UploadAutoOutputPolicyInput {
  runMode: UploadRunMode;
  hasDownstreamLinks: boolean;
}

export function shouldAutoCreateUploadOutputs({
  runMode,
  hasDownstreamLinks,
}: UploadAutoOutputPolicyInput): boolean {
  if (runMode === 'batch' && hasDownstreamLinks) {
    return false;
  }
  return true;
}
