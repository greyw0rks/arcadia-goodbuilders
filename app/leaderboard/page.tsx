import type { Metadata } from "next";
import { ArcadeLobby } from "@/components/ArcadeLobby";
export const metadata: Metadata = { title: "Rankings", description: "Explore the Arcadia tournament podium and your position in the standings." };
export default function LeaderboardPage() { return <ArcadeLobby screen="leaderboard" />; }
