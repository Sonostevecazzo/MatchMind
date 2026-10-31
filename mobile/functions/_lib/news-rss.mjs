const MAX_TITLE_LENGTH = 240;
const MAX_SOURCE_LENGTH = 100;

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const point = parseInt(code, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#(\d+);/g, (_, code) => {
      const point = parseInt(code, 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readTag(item, tag) {
  const match = item.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return match ? decodeXmlEntities(match[1]).replace(/<[^>]*>/g, "").trim() : "";
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function parseGoogleNewsRss(xml, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const maxAgeDays = Number.isFinite(options.maxAgeDays) ? Math.max(1, options.maxAgeDays) : 21;
  const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(10, options.limit)) : 6;
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  const items = String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  const articles = [];

  for (const match of items) {
    const item = match[1];
    const title = readTag(item, "title").slice(0, MAX_TITLE_LENGTH);
    const url = safeHttpsUrl(readTag(item, "link"));
    const sourceTag = item.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);
    const source = (sourceTag
      ? decodeXmlEntities(sourceTag[1]).replace(/<[^>]*>/g, "").trim()
      : "Google News").slice(0, MAX_SOURCE_LENGTH);
    const dateValue = Date.parse(readTag(item, "pubDate"));
    const publishedAt = Number.isFinite(dateValue) ? new Date(dateValue).toISOString() : null;

    if (!title || !url) continue;
    if (publishedAt && (dateValue < cutoff || dateValue > now + 60 * 60 * 1000)) continue;
    if (articles.some(article => article.url === url)) continue;

    articles.push({ title, url, source: source || "Google News", publishedAt });
    if (articles.length >= limit) break;
  }

  return articles;
}
