import { getNbaSchedule } from "../../../nba-engine.mjs";

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const data = await getNbaSchedule();
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=900, stale-while-revalidate=300",
        "X-MatchMind-Source": "ESPN-NBA"
      }
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return new Response(JSON.stringify({
      error: "NBA data temporarily unavailable",
      detail: String(error?.message || error),
      source: "ESPN · NBA"
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}
