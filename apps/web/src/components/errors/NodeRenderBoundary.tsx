import { Component, type ReactNode } from "react";
import { ErrorRecoveryPanel } from "./ErrorRecoveryPanel.js";
import { toUiFailureDiagnostic } from "./ui-failure-diagnostic.js";

export function nodeRenderResetKey(node: { id?: unknown; type?: unknown; data?: Record<string, unknown> }) {
  const revision = node.data?.revision ?? node.data?.updatedAt ?? 0;
  return `${String(node.id || "unknown")}:${String(node.type || "unknown")}:${String(revision)}`;
}

export class NodeRenderBoundary extends Component<{ resetKey: string; fallback: ReactNode; children: ReactNode }, { error: Error | null }> {
  state = { error: null } as { error: Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="xh-node-render-boundary">{this.props.fallback}<ErrorRecoveryPanel diagnostic={toUiFailureDiagnostic(this.state.error, "node-renderer")} onRetry={() => this.setState({ error: null })} /></div>;
  }
}
