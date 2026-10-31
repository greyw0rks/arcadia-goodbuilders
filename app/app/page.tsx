import type { Metadata } from "next";
import { GameApp } from "@/components/GameApp";
import { TRIVIA_GAMES } from "@/lib/trivia-catalog";

export const metadata: Metadata = {
  title: "Daily trivia tournament",
  description: "Choose a trivia genre for four daily tournament games, then continue with mixed games. A GoodDollar-verified wallet is required.",
};

export default async function AppPage({ searchParams }: { searchParams: Promise<{ mode?: string; genre?: string }> }) {
  const { genre } = await searchParams;
  const initialGenre = TRIVIA_GAMES.find(item => item.id === genre)?.id;
  return <GameApp initialGenre={initialGenre}  />;
}
