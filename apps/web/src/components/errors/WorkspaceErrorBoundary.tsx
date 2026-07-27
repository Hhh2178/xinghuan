import { Component, type ReactNode } from "react";
import { ErrorRecoveryPanel } from "./ErrorRecoveryPanel.js";
import { toUiFailureDiagnostic } from "./ui-failure-diagnostic.js";

export class WorkspaceErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; reset: number }> {
  state = { error: null, reset: 0 } as { error: Error | null; reset: number };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return <div key={this.state.reset} className="xh-workspace-error-boundary">{this.props.children}</div>;
    return <div className="xh-workspace-error-boundary"><ErrorRecoveryPanel diagnostic={toUiFailureDiagnostic(this.state.error, "workspace")} onRetry={() => this.setState((state) => ({ error: null, reset: state.reset + 1 }))} onReload={() => window.location.reload()} /></div>;
  }
}
