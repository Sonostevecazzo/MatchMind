const FEED_URL = "https://www.nytimes.com/athletic/rss/football/";
const CACHE_SECONDS = 900;

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}
function plainText(value) {
  return decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(xml, name) {
  const match = xml.match(new RegExp("<(?:[\\w-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?" + name + ">", "i"));
  return match ? decodeXml(match[1].trim()) : "";
}
function parseFeed(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 20).map(([_, item]) => {
    const link = tag(item, "link").trim();
    const title = plainText(tag(item, "title"));
    const summary = plainText(tag(item, "description")).slice(0, 300);
    const date = tag(item, "pubDate");
    const image = item.match(/<(?:media:content|media:thumbnail|enclosure)[^>]+url=["']([^"']+)["']/i)?.[1] || null;
    return { title, summary, url: link, publishedAt: date, image };
  }).filter(item => item.title && /^https:\/\/(?:www\.)?theathletic\.com\//i.test(item.url));
}
export async function onRequestGet() {
  try {
    const response = await fetch(FEED_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("The Athletic feed HTTP " + response.status);
    const xml = await response.text();
    const articles = parseFeed(xml);
    if (!articles.length) throw new Error("Feed The Athletic senza articoli leggibili.");
    return new Response(JSON.stringify({
      source: "The Athletic · RSS calcio",
      sourceUrl: FEED_URL,
      updatedAt: new Date().toISOString(),
      articles,
      note: "Titoli, brevi descrizioni e collegamenti; gli articoli completi restano sul sito dell'editore e possono richiedere un abbonamento."
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=" + CACHE_SECONDS + ", s-maxage=" + CACHE_SECONDS,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      source: "The Athletic",
      articles: [],
      error: String(error?.message || error),
      note: "Il feed non è disponibile in questo momento."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}
