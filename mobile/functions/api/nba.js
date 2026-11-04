export async function onRequestGet() {
  return new Response(JSON.stringify({
    configured: true,
    error: "La fonte NBA precedente è stata disattivata durante la migrazione a fonti pubbliche senza chiavi API.",
    source: null,
    games: []
  }), { status: 410, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
