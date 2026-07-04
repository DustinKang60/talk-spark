export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url 파라미터가 없습니다." });

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Referer": "https://news.google.com/",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `기사 서버 응답 오류 (${response.status})`,
      });
    }

    const html = await response.text();

    // HTML에서 본문 텍스트 추출
    const text = extractText(html);
    if (text.length < 200) {
      return res.status(422).json({ error: "기사 본문을 추출할 수 없습니다." });
    }

    return res.status(200).json({ text: text.slice(0, 4000) });
  } catch (e) {
    return res.status(500).json({ error: "기사를 가져오는 중 오류가 발생했습니다." });
  }
}

function extractText(html) {
  // script, style, nav, header, footer, aside 제거
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 단락 태그를 줄바꿈으로 변환
  cleaned = cleaned
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // 나머지 태그 제거
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // HTML 엔티티 디코딩
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ");

  // 빈 줄 정리
  return cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 20)
    .join("\n")
    .trim();
}
