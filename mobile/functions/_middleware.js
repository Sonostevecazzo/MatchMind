export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  const pathname = new URL(context.request.url).pathname;
  // Public football data is identical for every visitor. Let Cloudflare cache
  // the API response at the edge instead of forcing every phone to rebuild it.
  if (pathname.endsWith("/api/public-calendar")) {
    headers.set("Cache-Control", "public, max-age=900, s-maxage=900, stale-while-revalidate=3600");
  } else {
    headers.set("Cache-Control", "private, no-store");
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
