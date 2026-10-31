export interface BrowserWalletProvider {
  isMiniPay?: boolean;
  providers?: BrowserWalletProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}
declare global { interface Window { ethereum?: BrowserWalletProvider } }

// WalletConnect's provider returns a number; injected providers usually return
// an EIP-1193 hex string. Validate either form before comparing networks.
export function walletChainId(value: unknown): string {
  let id: bigint | undefined;
  if (typeof value === "number" && Number.isSafeInteger(value)) id = BigInt(value);
  else if (typeof value === "bigint") id = value;
  else if (typeof value === "string" && /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value)) id = BigInt(value);
  if (id === undefined || id <= 0n) throw new Error("Your wallet returned an invalid network ID. Reconnect and choose Celo.");
  return `0x${id.toString(16)}`;
}

let selected: BrowserWalletProvider | null = null;
export function injectedWallet() {
  const injected = window.ethereum;
  return injected?.providers?.find((provider) => provider.isMiniPay) ?? injected;
}
export function activeWallet() { return selected ?? injectedWallet(); }
export function selectWallet(provider: BrowserWalletProvider | null) { selected = provider; }
