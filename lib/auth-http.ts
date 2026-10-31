import { NextResponse } from "next/server";
import { WalletAuthError } from "./wallet-identity";
import { RateLimitError } from "./rate-limit";

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "private, no-store", vary: "Cookie" } });
}

export function requireSameOrigin(request: Request): string {
  const configured = process.env.ARCADIA_AUTH_ORIGIN?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = new URL(configured || (process.env.NODE_ENV === "production" ? "https://g.arcadia.uno" : request.url)).origin;
  if (request.headers.get("origin") !== origin) throw new WalletAuthError("Open Arcadia on its configured site to continue.", 403);
  return origin;
}

export async function authBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new WalletAuthError("Send the sign-in request as JSON.", 400);
  }
  const text = await request.text();
  if (text.length > 12_288) throw new WalletAuthError("This sign-in request is too large.", 413);
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new WalletAuthError("This sign-in request is not valid JSON.", 400); }
}

export function authFailure(error: unknown) {
  const response = error instanceof WalletAuthError
    ? privateJson({ error: error.message }, error.status)
    : privateJson({ error: "Account access is temporarily unavailable. Please try again." }, 503);
  if (error instanceof RateLimitError) response.headers.set("Retry-After", String(error.retryAfter));
  return response;
}
