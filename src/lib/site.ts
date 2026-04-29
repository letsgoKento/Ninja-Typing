export const SITE_NAME = "Ninja Typing / 忍者タイピング";
export const SITE_BRAND = "Ninja Typing";
export const SITE_DESCRIPTION =
  "忍者が手裏剣で敵を倒す演出が気持ちいい、和風サイバー忍者テーマの無料タイピングゲーム。日本語の読みをローマ字で入力して、60秒でハイスコアとランキング上位を目指せます。";
export const SITE_KEYWORDS = [
  "Ninja Typing",
  "忍者タイピング",
  "タイピングゲーム",
  "無料タイピングゲーム",
  "ローマ字入力",
  "日本語タイピング",
  "ブラウザゲーム",
  "Next.js ゲーム",
  "ランキング タイピング",
  "手裏剣"
];
export const OG_IMAGE_PATH = "/OGP.png";
export const FAVICON_PATH = "/favicon.png";

export function getSiteUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const fallbackUrl = "http://localhost:3000";
  const url = explicitUrl || vercelUrl || fallbackUrl;

  return url.replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}
