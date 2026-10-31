import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <span className="wordmark-mark">A</span>
      <h1>This room is not in the arcade.</h1>
      <p>Return to today's challenge or read how the reward loop works.</p>
      <div>
        <Link className="button primary" href="/app">Play today</Link>
        <Link className="button secondary" href="/">Arcadia home</Link>
      </div>
    </main>
  );
}
