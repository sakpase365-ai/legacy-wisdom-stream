'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <p className="font-serif text-foreground text-2xl">Something went wrong.</p>
            <p className="text-sm text-muted-foreground">
              Your draft may still be saved locally. Reload the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 py-3 px-8 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
