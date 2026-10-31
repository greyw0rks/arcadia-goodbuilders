export type ArcadeIconName = "home" | "play" | "trophy" | "rank" | "reward" | "profile" | "arrow" | "bolt" | "clock" | "check" | "pause";
const paths: Record<ArcadeIconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></>,
  play: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m10 8 6 4-6 4Z" /></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0Zm5 10v5m-5 3h10m-8-3h6" /><path d="M7 5H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4" /></>,
  rank: <><path d="M3 21V10h6v11m0 0V3h6v18m0-7h6v7M2 21h20" /></>,
  reward: <><rect x="3" y="7" width="18" height="5" rx="1" /><path d="M5 12v9h14v-9M12 7v14m0-14C5 9 4 2 8 2c3 0 4 5 4 5Zm0 0c7 2 8-5 4-5-3 0-4 5-4 5Z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  pause: <><path d="M8 5v14M16 5v14" /></>,
};
export function ArcadeIcon({ name, size = 22 }: { name: ArcadeIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
