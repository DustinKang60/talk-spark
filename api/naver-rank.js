import { applyCors, verifyClient, rateLimited } from "./_shared.js";
import { buildHeadline, buildSection, buildEntertainment } from "./_naverRank.js";

// 탭 이름 → 네이버 섹션 번호. headline 은 전국 랭킹, entertainment 는 검색을 쓴다.
const SECTIONS = { world: 104 };

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!verifyClient(req, res)) return;
  if (rateLimited(req, res, { windowMs: 60_000, max: 60 })) return;

  const tab = String(req.query.tab || "headline");

  try {
    const items =
      tab === "headline"
        ? await buildHeadline(10)
        : tab === "entertainment"
          ? await buildEntertainment(10)
          : SECTIONS[tab]
            ? await buildSection(SECTIONS[tab], 10)
            : null;

    if (!items) return res.status(400).json({ error: "알 수 없는 tab 값입니다." });

    // 랭킹은 자주 바뀌지 않는다. 5분 캐시로 네이버 쪽 요청도 줄인다.
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).json({ items });
  } catch (e) {
    // 네이버가 페이지 구조를 바꾸면 여기로 떨어진다.
    // 호출하는 쪽이 기존 방식으로 후퇴할 수 있게 502로 명확히 알린다.
    res.status(502).json({ error: "ranking_unavailable", detail: String(e.message || e) });
  }
}
