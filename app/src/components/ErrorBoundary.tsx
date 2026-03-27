import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in dev; in production this would go to Sentry/etc.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <h2 className="text-xl font-bold text-foreground">
            {this.props.fallbackTitle ?? "Ups, coś poszło nie tak"}
          </h2>

          <p className="text-sm text-muted-foreground">
            Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę lub wrócić do
            poprzedniego widoku.
          </p>

          {this.state.error && (
            <details className="w-full rounded-md bg-muted p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Szczegóły techniczne
              </summary>
              <pre className="mt-2 overflow-auto text-xs text-destructive">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Spróbuj ponownie
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Odśwież stronę
            </button>
          </div>
        </div>
      </div>
    );
  }
}
