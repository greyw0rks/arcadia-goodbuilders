import type { PlayerProgress } from "./progress";

export interface PlayerIdentity {
  address: string | null;
}

export interface PlayerSnapshot {
  identity: PlayerIdentity;
  progress: PlayerProgress;
}

export interface WalletChallenge {
  browserId: string;
  nonce: string;
  address: string;
  origin: string;
  message: string;
  expiresAt: number;
}

export interface WalletSession {
  playerId: string;
  address: string;
}

export class WalletAuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = "WalletAuthError";
  }
}
