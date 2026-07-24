// TalkSpark 서버리스 API 공용 보안 유틸.
// 목적: 완전한 인증이 아니라, URL만 알아내서 앱 밖에서 두드리는
// 자동화된 스크래핑·API 할당량 남용을 억제하기 위한 최소 방어선.

// src/utils/apiToken.js의 값과 반드시 동일해야 한다.
export const CLIENT_TOKEN = "tsk_82f1c9a4e7d3b6f0";

const ALLOWED_ORIGINS = [
  "https://talk-spark-eta.vercel.app",
  "https://dustinkang60.github.io",
  "http://localhost:5173",
];

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TalkSpark-Client");
}

export function verifyClient(req, res) {
  if (req.headers["x-talkspark-client"] !== CLIENT_TOKEN) {
    res.status(403).json({ error: "인증되지 않은 요청입니다." });
    return false;
  }
  return true;
}

// 메모리 기반 간이 요청 제한. 서버리스 인스턴스가 재시작되면 초기화되므로
// 완벽하진 않지만, 단순 반복 스크래핑 정도는 충분히 막아준다.
const buckets = new Map();

export function rateLimited(req, res, { windowMs = 60_000, max = 30 } = {}) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const key = `${ip}:${req.url?.split("?")[0]}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
    return true;
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > 5 * 60_000) buckets.delete(key);
  }
}, 5 * 60_000)?.unref?.();
