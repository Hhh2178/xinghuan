import { Component, type ReactNode } from 'react';
import { ErrorRecoveryPanel } from './errors/ErrorRecoveryPanel';
import { toUiFailureDiagnostic } from './errors/ui-failure-diagnostic';

/**
 * ErrorBoundary - 防御性错误边界
 *
 * 用途:
 *   1. 包裹 Canvas / 节点子树，捕获渲染期抛出的运行时异常
 *   2. 避免单个节点（如 OutputNode 在多源连接下）抛错把整页拖白屏
 *   3. 给用户一个可视的错误反馈 + 重置按钮，仍可继续操作其他画布
 */
interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error | null;
  info?: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // 控制台留痕方便排查
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught:', error, info?.componentStack);
    this.setState({ info: info?.componentStack || '' });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, info: '' });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 12,
          color: '#fca5a5',
          background: 'rgba(20,20,22,.92)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <ErrorRecoveryPanel diagnostic={toUiFailureDiagnostic(this.state.error, 'workspace')} onRetry={this.reset} onReload={this.reload} />
      </div>
    );
  }
}

export default ErrorBoundary;
