function constantTimeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function onRequest(context) {
  const expectedUser = context.env.MATCHMIND_USERNAME;
  const expectedPassword = context.env.MATCHMIND_PASSWORD;

  // Fail closed: never serve the app publicly if secrets are missing.
  if (!expectedUser || !expectedPassword) {
    return new Response("MatchMind access is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const header = context.request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) {
    return new Response("Autenticazione richiesta.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MatchMind", charset="UTF-8"',
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  let decoded = "";
  try {
    const bytes = Uint8Array.from(atob(header.slice(6).trim()), char => char.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    decoded = "";
  }
  const separator = decoded.indexOf(":");
  const user = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";
  if (!constantTimeEqual(user, expectedUser) || !constantTimeEqual(password, expectedPassword)) {
    return new Response("Credenziali non valide.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MatchMind", charset="UTF-8"',
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
