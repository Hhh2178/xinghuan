import { Component, type ErrorInfo, type ReactNode } from "react";

export class AdminRouteErrorBoundary extends Component<{
  children: ReactNode;
  resetKey: string;
}, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin route render failed", { error: error.message, componentStack: info.componentStack });
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="starlight-route-error" role="alert">
        <span>当前页面暂时无法显示</span>
        <strong>业务域渲染失败，其他后台页面仍可继续使用。</strong>
        <p>{this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>重试当前页面</button>
      </section>
    );
  }
}
