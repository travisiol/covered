import { seal } from "@/lib/server/seal";

/**
 * POST { email } -> the e-mail encrypted for storage in the creator's own
 * balance contract. The creator's wallet then writes it there itself, so no
 * sign-in is needed here: this only encrypts.
 */
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "That does not look like an e-mail address." }, { status: 400 });
  }
  try {
    return Response.json({ sealed: seal(email) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
