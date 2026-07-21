"use client";
import React from "react";

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("Game render error:", error); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-rose-800 rounded-xl p-6">
            <h1 className="text-xl font-bold text-rose-400 mb-2">Something broke</h1>
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
            <pre className="text-[10px] text-zinc-500 mt-2 whitespace-pre-wrap break-words">{this.state.error.stack}</pre>
            <button onClick={() => window.location.reload()} className="mt-4 w-full bg-emerald-600 rounded-lg py-2 font-semibold">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
