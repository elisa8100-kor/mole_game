
let leaderboard = [
];

export default function handler(req, res) {
  // CORS 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET만 허용
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 점수 내림차순 → 상위 10개
  const top10 = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return res.status(200).json(top10);
}
