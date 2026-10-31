export interface GoodDollarIdentity {
  verified: boolean;
  root: string | null;
  verificationUrl: string;
}
export type IdentityStatus = "guest" | "loading" | "unavailable" | "verified" | "linked" | "unverified";
export function identityStatus(address: string | null, identity: GoodDollarIdentity | null, loading: boolean, error: string): IdentityStatus {
  if (!address) return "guest";
  if (loading) return "loading";
  if (error || !identity) return "unavailable";
  if (!identity.verified || !identity.root) return "unverified";
  return identity.root.toLowerCase() === address.toLowerCase() ? "verified" : "linked";
}
export const identityLabels: Record<IdentityStatus, string> = {
  guest: "Guest player", loading: "Checking GoodDollar identity…", unavailable: "Verification check unavailable",
  verified: "Verified GoodDollar wallet", linked: "Linked to GoodDollar", unverified: "GoodDollar not linked",
};
