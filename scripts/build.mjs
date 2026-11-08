// 공개 출력(dist/) 만들기
// 허용한 항목과 확장자만 복사한다. 서버 함수, 설정, 기록, 비밀 파일은 복사하지 않는다.
// 실행: node scripts/build.mjs  (npm 패키지 필요 없음)

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");

// 공개해도 되는 최상위 항목 (assets/ 는 나중에 CSS·JS·이미지를 분리할 때 사용)
const INCLUDE = ["index.html", "assets"];

// 공개해도 되는 확장자: HTML·CSS·브라우저 JS·이미지
const ALLOWED_EXT = new Set([
  ".html", ".css", ".js",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
]);

// 경로 어디에든 있으면 안 되는 이름
const FORBIDDEN = [
  /^\.git$/, /^\.env/, /^\.kiro$/, /^\.vscode$/, /^\.netlify$/, /^node_modules$/,
  /^netlify$/, /^netlify\.toml$/, /^scripts$/, /^docs$/, /^supabase$/,
];

const isForbidden = (rel) => rel.split(sep).some((part) => FORBIDDEN.some((re) => re.test(part)));

const copied = [];
const skipped = [];

function copy(src) {
  const rel = relative(ROOT, src);
  if (isForbidden(rel)) { skipped.push(rel); return; }
  if (statSync(src).isDirectory()) {
    for (const name of readdirSync(src)) copy(join(src, name));
    return;
  }
  if (!ALLOWED_EXT.has(extname(src).toLowerCase())) { skipped.push(rel); return; }
  const dest = join(OUT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  copied.push(rel);
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

// 1. 이전 출력 지우고 다시 만들기 (dist/ 안에서만 삭제)
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

// 2. 허용 항목 복사
for (const item of INCLUDE) {
  const src = join(ROOT, item);
  if (existsSync(src)) copy(src);
}

// 3. 출력 검사: 시작 파일이 있고, 금지 항목·허용 외 확장자가 없어야 한다
const problems = [];
if (!existsSync(join(OUT, "index.html"))) problems.push("dist/index.html 이 없습니다.");
for (const file of listFiles(OUT)) {
  const rel = relative(OUT, file);
  if (isForbidden(rel)) problems.push(`금지 항목 포함: ${rel}`);
  if (!ALLOWED_EXT.has(extname(file).toLowerCase())) problems.push(`허용하지 않는 확장자: ${rel}`);
}

console.log("복사함:", copied.length ? copied.join(", ") : "(없음)");
if (skipped.length) console.log("제외함:", skipped.join(", "));

if (problems.length) {
  console.error("빌드 검사 실패:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`빌드 검사 통과: dist/ 에 파일 ${copied.length}개`);
