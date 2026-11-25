import { setupMissing } from "@/lib/server/config";

export async function GET() {
  return Response.json({ missing: setupMissing() }, { headers: { "Cache-Control": "no-store" } });
}
