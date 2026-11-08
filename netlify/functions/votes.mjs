// 다음 그림 주제 반응 API (Netlify Functions)
//   GET  /api/votes                    → 주제별 반응 횟수
//   POST /api/votes  {"topic":"풍경"}  → 한 건 저장 (선택 시각은 DB가 기록)
// 키는 코드에 쓰지 않는다. Netlify 환경 변수에서만 읽는다.
// npm 패키지 없이 내장 fetch로 Supabase REST API를 호출한다.

// 주제를 바꾸면 supabase/schema.sql 의 check 조건도 같이 바꾼다.
const TOPICS = ["풍경", "인물", "정물", "추상"];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(405, { error: "허용하지 않는 요청 방식입니다." });
  }

  // 입력 검사는 DB에 닿기 전에 먼저 한다
  let topic;
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "요청 형식이 올바르지 않습니다." });
    }
    topic = body?.topic;
    if (!TOPICS.includes(topic)) {
      return json(400, { error: "선택할 수 없는 주제입니다." });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return json(500, { error: "서버 설정이 완료되지 않았습니다." });
  }

  const headers = { apikey: key, "content-type": "application/json" };

  try {
    if (req.method === "POST") {
      const res = await fetch(`${url}/rest/v1/votes`, {
        method: "POST",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) return json(502, { error: "저장하지 못했습니다." });
      return json(201, { ok: true });
    }

    const res = await fetch(`${url}/rest/v1/vote_counts?select=topic,count`, { headers });
    if (!res.ok) return json(502, { error: "반응 수를 불러오지 못했습니다." });
    const rows = await res.json();
    const counts = Object.fromEntries(TOPICS.map((t) => [t, 0]));
    for (const row of rows) {
      if (Object.hasOwn(counts, row.topic)) counts[row.topic] = row.count;
    }
    return json(200, { counts });
  } catch {
    return json(502, { error: "데이터베이스에 연결하지 못했습니다." });
  }
};

export const config = { path: "/api/votes" };
