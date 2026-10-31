import type { Metadata } from "next";
import { ProfileApp } from "@/components/ProfileApp";

export const metadata: Metadata = { title: "Your player profile", description: "View your Arcadia progress, playing wallet and verified GoodDollar identity.", robots: { index: false, follow: false } };
export default function ProfilePage() { return <ProfileApp />; }
