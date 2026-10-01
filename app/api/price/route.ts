import { ethUsd } from "@/lib/server/fulfiller";

export async function GET() {
  try {
    return Response.json({ ethUsd: await ethUsd() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
