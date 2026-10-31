import type { Metadata } from "next";
import { ArcadeLobby } from "@/components/ArcadeLobby";
export const metadata: Metadata = { title: "Tournaments", description: "Choose your daily trivia genre, play four full-XP games and compete in Arcadia’s free tournament." };
export default function TournamentsPage() { return <ArcadeLobby screen="tournaments" />; }
