import type { Metadata } from "next";
import { SponsorApp } from "@/components/SponsorApp";
export const metadata: Metadata = { title: "Fund the G$ escrow", robots: { index: false, follow: false } };
export default function FundPage() { return <SponsorApp />; }
