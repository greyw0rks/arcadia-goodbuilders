import type { TriviaGame } from "@/lib/question-types";

export function TriviaIcon({ game }: { game: TriviaGame }) {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {game === "general" ? <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></>
      : game === "maths" ? <><rect x="4" y="2.5" width="16" height="19" rx="3" /><path d="M8 7h8M8 12h2m-1-1v2m5-1h2M8 17h2m4-1h2m-2 2h2" /></>
      : game === "crypto" ? <><path d="m8 8 2.8-2.8a4.25 4.25 0 0 1 6 6L14 14m2 2-2.8 2.8a4.25 4.25 0 0 1-6-6L10 10m-1 5 6-6" /></>
      : <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="m3 7 17-4-1-3L2 4zm4-4 2 3m4-4 2 3m-5 7 5 3-5 3z" /></>}
  </svg>;
}
