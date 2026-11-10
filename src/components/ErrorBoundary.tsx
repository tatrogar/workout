import { Component, type ReactNode } from "react";
import { exportFileName, toMarkdown } from "../export/markdown";
import { shareOrDownload } from "../export/share";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";

type State = { error: Error | null };

/** If a screen crashes, show a way out instead of a blank page — and a way to save the data first. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const exportNow = () => {
      const { workouts, aliases } = useData.getState();
      const now = new Date();
      void shareOrDownload(exportFileName(now), toMarkdown(workouts, aliases, useSettings.getState().units, now));
    };
    return (
      <div className="space-y-4 pt-10">
        <h1 className="text-2xl font-bold">This screen hit a problem</h1>
        <p className="text-[var(--muted)]">Your other workouts are still saved. Export your log to be safe, then go back to Start.</p>
        <p className="text-sm text-[var(--muted)]">{this.state.error.message}</p>
        <button className="min-h-touch w-full rounded-xl bg-sky-600 px-4 font-semibold" onClick={exportNow}>Export log</button>
        <a href="#/" className="flex min-h-touch items-center justify-center rounded-xl bg-slate-700 px-4 font-semibold">Back to Start</a>
      </div>
    );
  }
}
