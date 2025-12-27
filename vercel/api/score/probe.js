// /api/score-probe.js

import { kv } from "@vercel/kv";

/*
리더보드 저장 형식 예시:
[
  { name: "AAA", score: 320, maxCombo: 12, created_at: "2025-12-27T12:00:00Z" },
  ...
]
*/

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { score, maxCombo } = req.body;

    // 기본 검증
    if (typeof score !== "number") {
      return res.status(400).json({ error: "Invalid score" });
    }

    // ⭐ 최소 점수 제한 (원하던 150점)
    if (score < 150) {
      return res.json({ qualifies: false });
    }

    // 기존 리더보드 불러오기
    const leaderboard = (await kv.get("leaderboard")) || [];

    // 아직 10명 미만이면 무조건 진입
    if (leaderboard.length < 10) {
      return res.json({ qualifies: true });
    }

    // 가장 낮은 점수
    const lowestScore = leaderboard[leaderboard.length - 1].score;

    // Top10 진입 가능 여부
    const qualifies = score > lowestScore;

    return res.json({ qualifies });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
