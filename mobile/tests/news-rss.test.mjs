import test from "node:test";
import assert from "node:assert/strict";
import { parseGoogleNewsRss } from "../functions/_lib/news-rss.mjs";

const now = Date.parse("2026-10-31T10:00:00.000Z");
const recent = new Date(now - 60 * 60 * 1000).toUTCString();
const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toUTCString();
const future = new Date(now + 3 * 60 * 60 * 1000).toUTCString();

function item(title, url, date, source = "Test Sport") {
  return "<item><title>" + title + "</title><link>" + url + "</link><pubDate>" + date +
    "</pubDate><source url=\\"https://example.test\\">" + source + "</source></item>";
}

test("parses CDATA, XML entities, source and publication date", () => {
  const xml = "<rss><channel>" + item(
    "<![CDATA[Inter &amp; Milan: derby news]]>",
    "https://news.google.com/rss/articles/example",
    recent,
    "Test &amp; Sport"
  ) + "</channel></rss>";
  const result = parseGoogleNewsRss(xml, { now });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Inter & Milan: derby news");
  assert.equal(result[0].source, "Test & Sport");
  assert.equal(result[0].publishedAt, new Date(recent).toISOString());
});

test("rejects stale, future and non-HTTPS article links", () => {
  const xml = "<rss><channel>" +
    item("Old article", "https://example.test/old", old) +
    item("Future article", "https://example.test/future", future) +
    item("Unsafe article", "http://example.test/article", recent) +
    "</channel></rss>";
  assert.deepEqual(parseGoogleNewsRss(xml, { now }), []);
});

test("deduplicates article links and enforces result limit", () => {
  const xml = "<rss><channel>" +
    item("First", "https://example.test/1", recent) +
    item("Duplicate", "https://example.test/1", recent) +
    item("Second", "https://example.test/2", recent) +
    item("Third", "https://example.test/3", recent) +
    "</channel></rss>";
  const result = parseGoogleNewsRss(xml, { now, limit: 2 });
  assert.deepEqual(result.map(article => article.title), ["First", "Second"]);
});

test("ignores malformed items without a usable title or HTTPS URL", () => {
  const xml = "<rss><channel><item><title></title><link>https://example.test/a</link></item></channel></rss>";
  assert.deepEqual(parseGoogleNewsRss(xml, { now }), []);
});
