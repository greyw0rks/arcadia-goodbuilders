import { createHash, timingSafeEqual } from "node:crypto";
import { privateJson } from "@/lib/auth-http";
import { cleanExpiredData } from "@/lib/maintenance";
import { progressStore } from "@/lib/progress-store";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return privateJson({ error: "Maintenance is not configured." }, 503);
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(request.headers.get("authorization") || ""), hash(`Bearer ${secret}`))) return privateJson({ error: "Unauthorized." }, 401);
  try { return privateJson({ ok: true, removed: await cleanExpiredData(progressStore()) }); }
  catch { return privateJson({ error: "Maintenance failed. Retry later." }, 503); }
}
