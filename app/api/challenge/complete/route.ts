import { privateJson } from "@/lib/auth-http";

export async function POST() {
  return privateJson({ error: "This scoring endpoint has retired. Reload Arcadia to use server-controlled games." }, 410);
}
