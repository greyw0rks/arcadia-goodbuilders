import Link from "next/link";

const OPTIONS = ["A wallet balance", "Tournament XP", "Social likes"] as const;

export function LandingQuizPreview() {
  return (
    <div className="preview-card" aria-label="Arcadia quiz preview">
      <div className="preview-topline"><span>Daily challenge preview</span><span>1 of 5</span></div>
      <div className="preview-progress" aria-hidden="true"><span /></div>
      <h2>What determines your place in tournament standings?</h2>
      <div className="preview-options">
        {OPTIONS.map((option, index) => <div className="preview-option" key={option}><span>{String.fromCharCode(65 + index)}</span>{option}</div>)}
      </div>
      <div className="preview-feedback"><Link href="/app">Connect and verify your wallet to play →</Link></div>
    </div>
  );
}
