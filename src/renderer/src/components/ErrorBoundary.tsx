import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showStack: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showStack: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showStack: false }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[pulse:render-error]', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, showStack: false })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  private handleGoHome = (): void => {
    this.handleReset()
    useAppStore.getState().setView({ name: 'list' })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.'
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || ''

      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-background">
          <div className="flex w-full max-w-[500px] flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-danger-border,#fca5a5)] bg-[var(--color-danger-bg,#fee2e2)] text-destructive">
              <AlertCircle className="size-6 text-destructive" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="font-sans text-lg font-bold text-foreground">Something went wrong</h2>
              <p className="font-sans text-xs text-muted-foreground">
                A component failed to render. You can return to the downloads list or reload the
                app.
              </p>
            </div>

            <div className="w-full rounded-md border border-border bg-background p-3 text-left font-mono text-xs text-destructive break-all">
              {errorMessage}
            </div>

            {stack && (
              <div className="w-full text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showStack: !prev.showStack }))}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  {this.state.showStack ? 'Hide technical details' : 'Show technical details'}
                </button>
                {this.state.showStack && (
                  <pre className="mt-2 max-h-36 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px] leading-tight text-muted-foreground whitespace-pre-wrap">
                    {stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex w-full items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-sans text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Home className="size-3.5" />
                All Downloads
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-sans text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="size-3.5" />
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
