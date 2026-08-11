import { applyCors, verifyClient, rateLimited } from "./_shared.js";

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!verifyClient(req, res)) return;
  if (rateLimited(req, res, { windowMs: 60_000, max: 60 })) return;

  const { query } = req.query;
  if (!query) {
    res.status(400).json({ error: "query required" });
    return;
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Naver API credentials not configured" });
    return;
  }

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=5&sort=date`;
    const upstream = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Referer": "https://talk-spark-eta.vercel.app",
      },
    });
    const data = await upstream.json();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed" });
  }
}
