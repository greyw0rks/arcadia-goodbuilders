export interface SponsorTransaction { from: string; to?: string; data: string; value: "0x0" }
export interface SponsorView {
  stage: "deploy" | "pending" | "approve" | "fund" | "funded";
  address: string;
  amount?: string;
  amountRaw?: string;
  priceUsd?: string;
  estimatedUsd?: string;
  quotedAt?: number;
  quoteUrl?: string;
  expiresAt?: number;
  tournament?: string;
  endsAt?: number;
  escrow?: string;
  transaction?: SponsorTransaction;
  gasEstimateCelo?: string;
  message?: string;
  transactionResult?: "pending" | "success" | "reverted";
}
