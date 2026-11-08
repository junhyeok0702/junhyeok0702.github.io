// 작품 응원 API (Netlify Functions)
//   GET  /api/cheers                             → 작품별 누적 응원 횟수와 최근 응원 시각
//   POST /api/cheers  {"work_id":"photo-night"}  → 응원 한 건 저장 (고유 번호·시각은 DB가 기록)
// 키는 코드에 쓰지 않는다. Netlify 환경 변수에서만 읽는다.
// npm 패키지 없이 내장 fetch로 Supabase REST API를 호출한다.

// 작품을 바꾸면 supabase/cheers.sql 의 check 조건과 index.html 의 data-work 도 같이 바꾼다.
const WORKS = ["photo-night", "animation-short", "poster"];
const MAX_BODY = 1024; // 요청 본문 최대 글자 수

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
  let workId;
  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.length > MAX_BODY) {
      return json(413, { error: "요청이 너무 깁니다." });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "요청 형식이 올바르지 않습니다." });
    }
    workId = body?.work_id;
    if (typeof workId !== "string" || !WORKS.includes(workId)) {
      return json(400, { error: "없는 작품입니다." });
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
      const res = await fetch(`${url}/rest/v1/cheers`, {
        method: "POST",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify({ work_id: workId }),
      });
      if (!res.ok) return json(502, { error: "응원을 저장하지 못했습니다." });
      return json(201, { ok: true });
    }

    const res = await fetch(`${url}/rest/v1/cheer_stats?select=work_id,count,last_at`, { headers });
    if (!res.ok) return json(502, { error: "응원 수를 불러오지 못했습니다." });
    const rows = await res.json();
    const works = Object.fromEntries(WORKS.map((w) => [w, { count: 0, last_at: null }]));
    for (const row of rows) {
      if (!Object.hasOwn(works, row.work_id) || !Number.isInteger(row.count)) continue;
      works[row.work_id] = {
        count: row.count,
        last_at: typeof row.last_at === "string" ? row.last_at : null,
      };
    }
    return json(200, { works });
  } catch {
    return json(502, { error: "데이터베이스에 연결하지 못했습니다." });
  }
};

export const config = { path: "/api/cheers" };
