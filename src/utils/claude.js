const MODEL = "claude-haiku-4-5-20251001";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const JINA_PREFIX = "https://r.jina.ai/";

export async function summarizeArticle(link, apiKey) {
  if (!apiKey || !link) return { error: "링크 또는 API 키가 없습니다." };
  try {
    const jinaRes = await fetch(`${JINA_PREFIX}${link}`);
    if (!jinaRes.ok) throw new Error(`Jina HTTP ${jinaRes.status}`);
    const articleText = await jinaRes.text();
    if (articleText.length < 100) throw new Error("기사 내용을 가져오지 못했습니다.");
    // Markdown Content: 이후 본문만 추출
    const mdIdx = articleText.indexOf("Markdown Content:");
    const bodyOnly = mdIdx >= 0 ? articleText.slice(mdIdx + 17).trim() : articleText;
    if (bodyOnly.length < 300) throw new Error("이 기사는 원문 접근이 제한되어 요약할 수 없습니다.");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `다음 기사를 원문에 충실하게 요약해 주세요. 기사에 있는 내용만 사용하고, 없는 내용은 절대 추가하지 마세요.\n\n${articleText.slice(0, 3000)}`,
        }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json();
    return { summary: data.content?.[0]?.text?.trim() || "" };
  } catch (e) {
    console.error("summarizeArticle 실패", e);
    return { error: e.message };
  }
}

/**
 * 뉴스 1건을 받아 Claude가 논쟁거리 3개를 추출해 반환.
 * @returns {Array|null} debate 배열 또는 실패 시 null
 */
export async function extractDebates(newsItem, apiKey) {
  if (!apiKey) return null;

  const prompt = `다음 뉴스를 읽고, 이 뉴스를 소재로 사람들이 모임에서 나눌 수 있는 흥미로운 논쟁거리(대화 주제) 3개를 추출해 주세요.

뉴스 제목: ${newsItem.title}
뉴스 요약: ${newsItem.summary}

반드시 아래 JSON 배열 형식만 출력하고 다른 텍스트는 포함하지 마세요:
[
  {
    "title": "논쟁거리 제목 (20자 이내)",
    "starter": "대화를 여는 핵심 질문 (한 문장)",
    "description": "이 논쟁거리의 배경 설명 (2~3문장)",
    "followups": ["꼬리 질문 1", "꼬리 질문 2", "꼬리 질문 3"],
    "counterOpinion": "반대 혹은 보완적 관점 (1~2문장)",
    "difficulty": 숫자(1~5)
  }
]

논쟁거리 3개는 서로 다른 각도(예: 경제적·사회적·개인 가치관)에서 접근해 주세요.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Claude API error", res.status, errText);
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // 마크다운 코드블록 제거 후 JSON 배열 추출
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return { error: `JSON 배열을 찾지 못했습니다. 응답: ${cleaned.slice(0, 100)}` };

    const debates = JSON.parse(match[0]);
    return debates.map((d, i) => ({
      id: `debate_${newsItem.id}_${i}_${Date.now()}`,
      category: newsItem.category,
      sourceNews: newsItem.title,
      sourceLink: newsItem.link,
      ...d,
    }));
  } catch (e) {
    console.error("Claude request failed", e);
    return { error: e.message };
  }
}
