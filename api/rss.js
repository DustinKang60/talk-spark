import { applyCors, verifyClient, rateLimited } from "./_shared.js";

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!verifyClient(req, res)) return;
  if (rateLimited(req, res, { windowMs: 60_000, max: 90 })) return;

  const path = req.query.path || "";
  if (!path.startsWith("/") && !path.startsWith("?")) {
    res.status(400).json({ error: "invalid path" });
    return;
  }
  try {
    const upstream = await fetch(`https://news.google.com/rss${path}`);
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed" });
  }
}
