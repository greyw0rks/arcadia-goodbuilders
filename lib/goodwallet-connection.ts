import type { BrowserWalletProvider } from "./browser-wallet";

export interface WalletConnectProvider extends BrowserWalletProvider {
  session?: unknown;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signer: {
    client: {
      proposal: { getAll(): { id: number; pairingTopic: string }[] };
      core: { expirer: { set(key: string | number, expiry: number): void } };
    };
  };
}

function cancelled() { return Object.assign(new Error("Connection cancelled."), { code: 4001 }); }
export function goodWalletUrl(uri: string) {
  if (!/^wc:[a-f0-9]{64}@2\?/i.test(uri)) throw new Error("A WalletConnect v2 pairing is required.");
  const url = new URL("https://goodwallet.xyz");
  url.searchParams.set("uri", uri);
  return url.toString();
}

function expirePairing(provider: WalletConnectProvider, uri: string | undefined) {
  const topic = uri?.match(/^wc:([a-f0-9]{64})@2\?/i)?.[1];
  if (!topic) return;
  const { client } = provider.signer;
  // Expiring the proposal rejects SDK approval; expiring its pairing also
  // removes the relay subscription and symmetric key. Other sessions survive.
  for (const proposal of client.proposal.getAll()) {
    if (proposal.pairingTopic === topic) client.core.expirer.set(proposal.id, 0);
  }
  client.core.expirer.set(topic, 0);
}

export class GoodWalletConnection {
  private pending: Promise<WalletConnectProvider> | null = null;
  private provider: WalletConnectProvider | null = null;
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly factory: () => Promise<WalletConnectProvider>, private readonly timeoutMs = 180_000) {}
  current() { return this.provider; }
  private async get() {
    if (this.provider) return this.provider;
    if (!this.pending) this.pending = this.factory().then((provider) => { this.provider = provider; return provider; }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async connect(onUri: (uri: string) => void, signal: AbortSignal): Promise<WalletConnectProvider> {
    if (signal.aborted) throw cancelled();
    let provider: WalletConnectProvider | undefined;
    let connection: Promise<void> | undefined;
    let pairingUri: string | undefined;
    let abandoned = false;
    const previous = this.queue;
    let release: () => void = () => {};
    const finished = new Promise<void>((resolve) => { release = resolve; });
    this.queue = previous.then(() => finished);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: () => void = () => {};
    const display = (...args: unknown[]) => {
      if (typeof args[0] !== "string") return;
      pairingUri = args[0];
      if (abandoned || signal.aborted) { if (provider) expirePairing(provider, pairingUri); }
      else onUri(pairingUri);
    };
    const interrupted = new Promise<never>((_resolve, reject) => {
      stop = () => reject(cancelled());
      signal.addEventListener("abort", stop, { once: true });
      timer = setTimeout(() => reject(new Error("The GoodWallet connection expired. Start a new connection.")), this.timeoutMs);
    });
    let accepted = false;
    try {
      // Serialize retries until the previous SDK request has actually closed.
      // Cancellation also covers the queue, module loading and initialization.
      await Promise.race([previous, interrupted]);
      provider = await Promise.race([this.get(), interrupted]);
      if (signal.aborted) throw cancelled();
      if (provider.session) { accepted = true; return provider; }
      provider.on?.("display_uri", display);
      connection = provider.connect();
      await Promise.race([connection, interrupted]);
      if (signal.aborted) throw cancelled();
      accepted = true;
      return provider;
    }
    finally {
      clearTimeout(timer); signal.removeEventListener("abort", stop);
      if (!accepted && provider && connection) {
        abandoned = true;
        const pendingProvider = provider;
        expirePairing(provider, pairingUri);
        // Keep the listener until settling so even a late URI is expired.
        // A late approval is disconnected before a retry can start.
        void connection.then(() => pendingProvider.disconnect()).catch(() => {}).finally(() => {
          pendingProvider.removeListener?.("display_uri", display);
          release();
        });
      } else { provider?.removeListener?.("display_uri", display); release(); }
    }
  }
  async disconnect() { if (this.provider?.session) await this.provider.disconnect(); }
}

export const goodWalletConnection = new GoodWalletConnection(async () => {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  if (!projectId || !/^[a-f0-9]{32}$/i.test(projectId)) throw new Error("GoodWallet connection is temporarily unavailable. You can use a browser wallet or play as a guest.");
  // Heavy WalletConnect code is loaded only when this connection is chosen.
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  return await EthereumProvider.init({
    projectId, chains: [42220], showQrModal: false,
    methods: ["personal_sign"], events: ["accountsChanged", "chainChanged"],
    optionalMethods: ["eth_sendTransaction", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
    rpcMap: { 42220: "https://forno.celo.org" },
    metadata: {
      name: "Arcadia", description: "Daily quizzes and free XP tournaments on Celo.",
      url: window.location.origin,
      icons: [new URL("/brand/arcadia-icon-192.png", window.location.origin).toString()],
    },
  }) as unknown as WalletConnectProvider;
});
