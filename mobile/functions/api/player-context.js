export async function onRequestGet() {
  return new Response(JSON.stringify({
    configured: false,
    error: "Le integrazioni precedenti sono state rimosse. Questo endpoint non fornisce più dati.",
    source: null
  }), { status: 410, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
