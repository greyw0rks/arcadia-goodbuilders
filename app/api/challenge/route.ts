import { NextResponse } from "next/server";
import { challengeKey } from "@/lib/questions";
import { SECONDS_PER_QUESTION } from "@/lib/game-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const challengeId = challengeKey();

  return NextResponse.json(
    {
      challengeId,
      title: "Today's five",
      questionCount: 5,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      completionXp: 50,
      correctAnswerXp: 10,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
