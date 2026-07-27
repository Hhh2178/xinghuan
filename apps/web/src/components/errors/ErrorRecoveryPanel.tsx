import type { UiFailureDiagnostic } from "./ui-failure-diagnostic.js";

export function ErrorRecoveryPanel({
  diagnostic,
  onRetry,
  onReload,
}: {
  diagnostic: UiFailureDiagnostic;
  onRetry?: () => void;
  onReload?: () => void;
}) {
  return (
    <section className="xh-error-recovery" data-error-scope={diagnostic.scope} role="alert">
      <strong>{diagnostic.userMessage}</strong>
      <span className="xh-error-recovery-id">诊断 ID：{diagnostic.id}</span>
      <div className="xh-error-recovery-actions">
        {diagnostic.recoverable && onRetry ? <button type="button" onClick={onRetry}>重试</button> : null}
        {onReload ? <button type="button" onClick={onReload}>刷新页面</button> : null}
      </div>
    </section>
  );
}
