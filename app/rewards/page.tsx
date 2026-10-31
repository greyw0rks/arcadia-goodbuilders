import type { Metadata } from "next";
import { ArcadeLobby } from "@/components/ArcadeLobby";
export const metadata: Metadata = { title: "Rewards", description: "Your Arcadia XP, G$ funding and reward status." };
export default function RewardsPage() { return <ArcadeLobby screen="rewards" />; }
