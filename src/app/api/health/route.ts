/**
 * Liveness probe. Dynamic on purpose — a cached static response would let a
 * dead server look healthy.
 *
 * The app has no backend dependencies (no DB, no upstream services), so this
 * is a "the Next runtime answered" check. If you ever add real deps, probe
 * them here and surface their state in the response body.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
