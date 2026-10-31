"use client";
import { useEffect, useRef, useState } from "react";
import type { PlayerProgress } from "@/lib/progress";
import type { GameMode, GameView, TournamentDay } from "@/lib/game-types";
import { questionMixDescription } from "@/lib/question-policy";
import { dailyTournamentRate, SECONDS_PER_QUESTION, tournamentGameXp } from "@/lib/game-rules";
import { DIFFICULTY_LABELS, TRIVIA_GAMES } from "@/lib/trivia-catalog";
import type { TriviaSelection } from "@/lib/question-types";
import { ArcadeWorld } from "./ArcadeWorld";
import { XpCounter } from "./XpCounter";
import { ArcadeIcon } from "./ArcadeIcon";

interface Props {
  progress: PlayerProgress; walletAddress: string | null;
  onProgress(progress: PlayerProgress): void; onRunActiveChange(active: boolean): void;
  onRunPresentChange(present: boolean): void; canStart: boolean;
  mode?: GameMode; onFinished?(): void;
  trivia?: TriviaSelection;
  tournamentDay?: TournamentDay; enrolled?: boolean;
}
export function DailyChallenge({ progress, walletAddress, onProgress, onRunActiveChange, onRunPresentChange, canStart, mode = "daily", onFinished, trivia, tournamentDay, enrolled = false }: Props) {
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const retryRef = useRef<() => void>(() => {});
  const answerRef = useRef<(index: number) => void>(() => {});
  const advanceRef = useRef<(action: string) => void>(() => {});
  const active = busy || !!game && ["playing", "feedback", "ready"].includes(game.phase);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onRunActiveChange(active); return () => onRunActiveChange(false); }, [active, onRunActiveChange]);
  const present = game !== null;
  useEffect(() => { onRunPresentChange(present); return () => onRunPresentChange(false); }, [present, onRunPresentChange]);
  const questionId = game?.question?.id;
  useEffect(() => {
    if (!questionId) return;
    // A new question should begin in view even when entry or the previous
    // answer was reached by scrolling. Never spend the timed round scrolling.
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [questionId]);

  async function request(path: string, body: object) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    retryRef.current = () => void request(path, body);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, playerAddress: walletAddress }) });
      const payload = await response.json() as { game?: GameView; progress?: PlayerProgress; error?: string };
      if (!alive.current) return;
      if (payload.game) {
        setSecondsLeft(Math.max(0, Math.ceil(((payload.game.deadline ?? payload.game.serverNow) - payload.game.serverNow) / 1000)));
        setGame(payload.game);
        if (payload.progress) onProgress(payload.progress);
        if (payload.game.phase === "complete") onFinished?.();
        if (!response.ok) {
          const id = payload.game.id;
          retryRef.current = () => void request("/api/games/action", { id, action: "read" });
        }
      }
      if (!response.ok || !payload.game) throw new Error(payload.error || "This game could not be saved. Try again.");
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Connection failed. Try again."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  function act(action: string, answerIndex?: number) {
    if (game) void request("/api/games/action", { id: game.id, action, questionIndex: game.questionIndex, answerIndex });
  }
  answerRef.current = (index) => act("answer", index);
  advanceRef.current = act;
  useEffect(() => {
    if (busy || error || !game || !["feedback", "ready"].includes(game.phase)) return;
    const timer = window.setTimeout(() => advanceRef.current(game.phase === "ready" ? "finish" : "next"), game.phase === "feedback" ? 1200 : 0);
    return () => window.clearTimeout(timer);
  }, [game, busy, error]);
  useEffect(() => {
    if (!game || error || game.phase !== "playing" || game.deadline === null) return;
    const deadline = Date.now() + Math.max(0, game.deadline - game.serverNow);
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !busyRef.current) { window.clearInterval(timer); answerRef.current(-1); }
    };
    const timer = window.setInterval(update, 200);
    update();
    return () => window.clearInterval(timer);
  }, [game, error]);

  const start = (practice = false) => { if (canStart) void request("/api/games/start", { mode, practice, trivia }); };
  const arcade = mode === "arcade";
  const triviaTitle = TRIVIA_GAMES.find(item => item.id === (game?.trivia ?? trivia)?.game)?.title ?? "Trivia";
  const round = game?.tournamentRound;
  const normal = mode === "tournament" && (round ? round.kind === "mixed" : tournamentDay?.nextKind === "mixed");
  const oldDaily = mode === "daily" && progress.daily?.challengeId === new Date().toISOString().slice(0, 10) ? progress.daily : null;
  const result = game?.result ?? (!game && oldDaily ? { ...oldDaily, baseXp: oldDaily.xpEarned, multiplier: 100, creditedXp: 0 } : null);
  const nextRate = dailyTournamentRate(result && round ? round.daySequence : tournamentDay?.completedGames ?? 0);
  const nextMaximum = tournamentGameXp(10, 10, nextRate).xpEarned;
  return (
    <section className={`challenge-card ${result ? "result-card" : game ? "question-card" : "challenge-ready"}`} aria-busy={busy}>
      {error ? <div className="game-error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => retryRef.current()} disabled={busy}>Try again</button></div> : null}
      {!canStart && !active ? <p className="panel-note" role="status">Verify your GoodDollar identity before starting another game. Use Recheck identity in the tournament panel if the check is unavailable.</p> : null}
      {result ? <>
        <ArcadeWorld kind="chest" staticOnly className="result-world" />
        <h1>{result.correct / result.total >= .8 ? "Sharp run." : "Run complete."}</h1>
        <p className="result-game-label">{arcade ? "Mixed practice · Round result" : mode === "daily" ? "Daily result" : `Game ${round?.daySequence ?? game?.sequence} · ${result.multiplier}% XP rate${round?.xpCap ? ` · ${round.xpCap} XP cap` : ""}`}</p>
        <p>You answered {result.correct} of {result.total} correctly.</p>
        {arcade ? <div className="result-stats"><div><strong>{result.correct}</strong><span>Correct</span></div><div><strong>{result.total}</strong><span>Questions</span></div><div><strong>{Math.round(result.correct / result.total * 100)}%</strong><span>Accuracy</span></div></div> : <div className="result-stats"><div><strong>{result.baseXp}</strong><span>Base XP</span></div><div><strong>{result.multiplier}%</strong><span>Multiplier</span></div><div><strong><XpCounter value={result.xpEarned} /></strong><span>Game XP</span></div></div>}
        {mode === "tournament" && round?.daySequence === 4 ? <div className="four-game-milestone" role="status"><ArcadeIcon name="trophy" /><div><strong>Full XP streak completed!</strong><span>Four games down. Your mixed-trivia adventure is next.</span></div></div> : null}
        <p className="result-note">{arcade ? "Round complete. Play again or choose another game above. Daily and tournament XP are unchanged." : game?.practice ? "Practice complete. Your daily XP and streak are unchanged." : result.creditedXp > 0 ? `${result.creditedXp} XP saved.` : "This result is already saved. It will not be credited twice."}</p>
        {mode === "tournament" ? <p className="panel-note next-game-note" role="status">{round?.daySequence === 4 ? "Your four daily genre games are complete. Your tournament rounds are closed for today. Keep playing mixed trivia. " : ""}{nextRate.kind === "mixed" ? `Next: a mixed game at ${nextRate.multiplier}% XP, up to ${nextMaximum} XP.${nextRate.xpCap ? " The 5 XP cap now applies to every remaining game today." : ""}` : "Your next game stays in today’s genre at full XP."}</p> : null}
        <button className="button primary wide" disabled={busy || !canStart} onClick={() => start(mode === "daily")}>{busy ? "Loading…" : arcade ? "Play another round" : mode === "daily" ? "Practice again" : nextRate.kind === "mixed" ? "Play mixed quiz" : "Play next tournament game"}</button>
      </> : !game ? <>
        <h1>{arcade ? "Mixed practice." : mode === "daily" ? "Five questions. One clean run." : normal ? "Mixed quiz." : triviaTitle}</h1>
        <p className="game-context">{arcade ? "All four genres · Practice" : mode === "daily" ? "Today's five" : normal ? `Mixed quiz · ${nextRate.multiplier}% XP · Maximum ${nextMaximum} XP` : `Daily tournament · Game ${(tournamentDay?.completedGames ?? 0) + 1} of 4`}</p>
        <p className="challenge-intro">{arcade ? "Ten questions from General, Maths, Crypto and Movies. Practice records your score without adding XP." : mode === "tournament" ? normal ? "Your four genre games are complete for today. Keep playing across all four genres at lower XP. These earnings count toward your tournament standings." : "Your first four games each day stay in this genre and earn full XP: 10 per correct answer, plus 50 for finishing. The genre locks when you start." : "10 XP per correct answer, plus 50 XP for finishing. One daily result counts toward your XP and streak."}</p>
        <div className="challenge-rules"><span>{mode === "daily" ? 5 : 10} questions</span><span>{SECONDS_PER_QUESTION} seconds each</span><span>Free entry</span></div>
        <p className="panel-note">{mode === "daily" ? questionMixDescription("daily", new Date().toISOString().slice(0, 10)) : "3 easy, 3 medium, 2 hard and 2 extremely hard questions. The daily tournament allowance resets at 00:00 UTC."}</p>
        {mode === "tournament" && !enrolled ? <p className="panel-note">Join the free tournament in the tournament panel before starting.</p> : null}
        <button className="button primary wide" disabled={busy || !canStart || mode === "tournament" && !enrolled} onClick={() => start()}>{busy ? "Loading your game…" : arcade ? "Start or resume round" : mode === "daily" ? "Start today's quiz" : normal ? "Play mixed quiz" : "Start or resume tournament game"}</button>
        <p className="panel-note">Pick an answer to continue automatically after brief feedback. Leaving a game keeps it available to resume.</p>
      </> : game.phase === "expired" ? <><h1>This game has ended.</h1><p>Unfinished games earn no XP and do not advance your game count.</p>{mode === "tournament" ? <a className="button primary" href="/app?mode=tournament">Return to today’s tournament</a> : <button className="button primary wide" disabled={busy || !canStart} onClick={() => start()}>{arcade ? "Open a new round" : "Open today's quiz"}</button>}</> : game.phase === "ready" ? <>
        <h1>Saving your run…</h1><p>All answers locked.</p><p role="status">Your result will appear automatically.</p>
      </> : game.question ? <>
        <div className="question-status"><span>Question {game.questionIndex + 1} of {game.total}</span><span className={secondsLeft <= 5 ? "timer is-urgent" : "timer"}><ArcadeIcon name="clock" size={18} />{secondsLeft}s</span></div>
        <div className="question-progress" role="progressbar" aria-label="Question progress" aria-valuenow={game.questionIndex + 1} aria-valuemin={0} aria-valuemax={game.total}><span style={{ width: "100%", transform: `scaleX(${(game.questionIndex + 1) / game.total})`, transformOrigin: "left" }} /></div>
        <h1>{game.question.prompt}</h1>
        <p className="game-context">{arcade ? `Mixed practice · ${DIFFICULTY_LABELS[game.difficulty ?? "mixed"]}` : mode === "tournament" ? `${normal ? "Mixed quiz" : triviaTitle} · ${game.multiplier}% XP${round?.xpCap ? ` · Max ${round.xpCap} XP` : ""}` : game.practice ? "Practice · no extra XP" : "Daily challenge"}</p>
        <div className="answer-grid">{game.question.options.map((option, index) => <button className={`answer-button${game.feedback ? game.feedback.correctIndex === index ? " is-correct" : game.feedback.answerIndex === index ? " is-wrong" : " is-muted" : ""}`} key={option} disabled={busy || game.phase !== "playing"} onClick={() => act("answer", index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
        {game.feedback ? <div className={game.feedback.correct ? "answer-feedback is-correct" : "answer-feedback is-wrong"} aria-live="polite"><div><strong>{game.feedback.correct ? "Correct" : game.feedback.answerIndex === -1 ? "Time is up" : "Not this time"}</strong><p>{game.feedback.explanation}</p><p>{game.questionIndex + 1 === game.total ? "Saving your result…" : "Next question in a moment…"}</p></div></div> : null}
      </> : null}
    </section>
  );
}
