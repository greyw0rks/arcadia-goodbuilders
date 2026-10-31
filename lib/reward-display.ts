// Recorded funding, not an advertised tournament prize or redeemable XP balance.
export const ARCADIA_ESCROW = "0x876b0684b3d156434c3fc83dc807ec274c3c9273" as const;
export const FUNDING_RECEIPT = "0x1ff79bc4fc93f2e2b77af36427a3a23e2ed6ac193e1077cf37a5aa4f474beeda";
export const RECORDED_DEPOSIT = "6426.91913403696607823";
export const BUY_GD_URL = "https://app.uniswap.org/swap?chain=celo&outputCurrency=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
export interface RewardView {
  playerAddress: string | null;
  walletBalance: string | null;
  escrowBalance: string | null;
  checkedAt: string | null;
  chainError: string | null;
  historyError: string | null;
  receipts: { hash: string; amount: string; recordedAt: number }[];
}
