import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoodWalletConnection, goodWalletUrl, type WalletConnectProvider } from "../lib/goodwallet-connection";

const uri = `wc:${"a".repeat(64)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;
class Provider implements WalletConnectProvider {
  session?: unknown;
  events = new EventEmitter();
  approve: () => void = () => {};
  reject: (error: Error) => void = () => {};
  ignoreExpiry = false;
  autoDisplay = true;
  request = vi.fn(async () => []);
  connect = vi.fn(() => new Promise<void>((resolve, reject) => {
    this.reject = reject;
    this.approve = () => { this.session = {}; resolve(); };
    if (this.autoDisplay) this.events.emit("display_uri", uri);
  }));
  disconnect = vi.fn(async () => { this.session = undefined; });
  signer = { client: {
    proposal: { getAll: () => [{ id: 1, pairingTopic: "a".repeat(64) }, { id: 2, pairingTopic: "c".repeat(64) }] },
    core: { expirer: { set: vi.fn((key: string | number, _expiry: number) => {
      if (key === 1 && !this.ignoreExpiry) this.reject(new Error("Proposal expired"));
    }) } },
  } };
  on(event: string, listener: (...args: unknown[]) => void) { this.events.on(event, listener); }
  removeListener(event: string, listener: (...args: unknown[]) => void) { this.events.removeListener(event, listener); }
}
afterEach(() => vi.useRealTimers());

describe("GoodWallet connection", () => {
  it("waits for wallet approval and removes the pairing listener afterwards", async () => {
    const provider = new Provider();
    const connection = new GoodWalletConnection(async () => provider);
    const display = vi.fn();
    const pending = connection.connect(display, new AbortController().signal);
    await vi.waitFor(() => expect(display).toHaveBeenCalledWith(uri));
    expect(provider.request).not.toHaveBeenCalled();
    provider.approve();
    expect(await pending).toBe(provider);
    expect(provider.events.listenerCount("display_uri")).toBe(0);
  });

  it("resumes an existing session without issuing another pairing", async () => {
    const provider = new Provider(); provider.session = {};
    const factory = vi.fn(async () => provider);
    const connection = new GoodWalletConnection(factory);
    await connection.connect(vi.fn(), new AbortController().signal);
    await connection.connect(vi.fn(), new AbortController().signal);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(provider.connect).not.toHaveBeenCalled();
    await connection.disconnect();
    expect(provider.disconnect).toHaveBeenCalledOnce();
  });

  it("cancels while initialization is pending without pairing when initialization finishes", async () => {
    const provider = new Provider();
    let initialized: (provider: WalletConnectProvider) => void = () => {};
    const connection = new GoodWalletConnection(() => new Promise((resolve) => { initialized = resolve; }));
    const controller = new AbortController();
    const pending = connection.connect(vi.fn(), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 4001 });
    controller.abort();
    await rejected;
    initialized(provider);
    await vi.waitFor(() => expect(connection.current()).toBe(provider));
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it("cancels promptly and disconnects a wallet that approves after cancellation", async () => {
    const provider = new Provider();
    provider.ignoreExpiry = true;
    const connection = new GoodWalletConnection(async () => provider);
    const controller = new AbortController();
    const pending = connection.connect(vi.fn(), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 4001 });
    await vi.waitFor(() => expect(provider.connect).toHaveBeenCalledOnce());
    controller.abort(); await rejected;
    expect(provider.signer.client.core.expirer.set).toHaveBeenCalledWith(1, 0);
    expect(provider.signer.client.core.expirer.set).toHaveBeenCalledWith("a".repeat(64), 0);
    expect(provider.signer.client.core.expirer.set).not.toHaveBeenCalledWith(2, 0);
    provider.approve();
    await vi.waitFor(() => expect(provider.disconnect).toHaveBeenCalledOnce());
    expect(provider.events.listenerCount("display_uri")).toBe(0);
    expect(provider.request).not.toHaveBeenCalled();
  });

  it("expires an unanswered pairing and permits retry after initialization failure", async () => {
    vi.useFakeTimers();
    const provider = new Provider();
    let first = true;
    const connection = new GoodWalletConnection(async () => { if (first) { first = false; throw new Error("Relay unavailable"); } return provider; }, 1000);
    await expect(connection.connect(vi.fn(), new AbortController().signal)).rejects.toThrow("Relay unavailable");
    const pending = connection.connect(vi.fn(), new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow("expired");
    await vi.advanceTimersByTimeAsync(1001); await rejected;
    expect(provider.signer.client.core.expirer.set).toHaveBeenCalledWith(1, 0);
    expect(provider.events.listenerCount("display_uri")).toBe(0);
  });

  it("expires a URI arriving after cancellation without displaying it", async () => {
    const provider = new Provider(); provider.autoDisplay = false;
    const connection = new GoodWalletConnection(async () => provider);
    const controller = new AbortController();
    const display = vi.fn();
    const pending = connection.connect(display, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 4001 });
    await vi.waitFor(() => expect(provider.connect).toHaveBeenCalledOnce());
    controller.abort(); await rejected;
    provider.events.emit("display_uri", uri);
    await vi.waitFor(() => expect(provider.events.listenerCount("display_uri")).toBe(0));
    expect(display).not.toHaveBeenCalled();
    expect(provider.signer.client.core.expirer.set).toHaveBeenCalledWith(1, 0);
  });

  it("finishes late-approval cleanup before starting a retry", async () => {
    const provider = new Provider(); provider.ignoreExpiry = true;
    const connection = new GoodWalletConnection(async () => provider);
    const first = new AbortController();
    const pending = connection.connect(vi.fn(), first.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 4001 });
    await vi.waitFor(() => expect(provider.connect).toHaveBeenCalledOnce());
    first.abort(); await rejected;
    const display = vi.fn();
    const retried = connection.connect(display, new AbortController().signal);
    await Promise.resolve();
    expect(provider.connect).toHaveBeenCalledOnce();
    provider.approve();
    await vi.waitFor(() => expect(display).toHaveBeenCalledWith(uri));
    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(provider.connect).toHaveBeenCalledTimes(2);
    provider.approve();
    expect(await retried).toBe(provider);
    expect(provider.session).toBeDefined();
    expect(provider.disconnect).toHaveBeenCalledOnce();
  });

  it("uses GoodWallet's uri deep link and rejects non-pairing URLs", () => {
    const url = new URL(goodWalletUrl(uri));
    expect(url.origin).toBe("https://goodwallet.xyz");
    expect(url.searchParams.get("uri")).toBe(uri);
    expect(() => goodWalletUrl("javascript:alert(1)")).toThrow();
    expect(() => goodWalletUrl(`wc:${"a".repeat(64)}@1?bridge=old`)).toThrow();
  });
});
