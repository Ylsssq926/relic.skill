import { Component, type ReactNode, type ErrorInfo } from 'react'
import { useI18n } from '../lib/i18n'

function DefaultErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <span className="text-3xl">⚠️</span>
      <p className="text-sm">{t('app.error.title')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-blue-400 hover:underline"
      >
        {t('app.error.retry')}
      </button>
    </div>
  )
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultErrorFallback onRetry={() => this.setState({ hasError: false })} />
        )
      )
    }
    return this.props.children
  }
}
