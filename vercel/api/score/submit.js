// /api/score-submit.js

import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_PATH, "leaderboard.json");

const MAX_RANK = 10;
const MIN_SCORE = 150;

// 파일 읽기
function readLeaderboard() {
  if (!fs.existsSync(FILE_PATH)) return [];
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  return JSON.parse(raw || "[]");
}

// 파일 저장
function saveLeaderboard(data) {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH);
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { name, score, maxCombo } = req.body;

  // 기본 검증
  if (
    typeof name !== "string" ||
    typeof score !== "number" ||
    score < MIN_SCORE
  ) {
    return res.status(400).json({ error: "Invalid data" });
  }

  let leaderboard = readLeaderboard();

  // 새 점수 추가
  leaderboard.push({
    name: name.slice(0, 12),
    score,
    maxCombo: maxCombo || 0,
    created_at: new Date().toISOString()
  });

  // 점수 기준 정렬
  leaderboard.sort((a, b) => b.score - a.score);

  // Top 10 유지
  leaderboard = leaderboard.slice(0, MAX_RANK);

  saveLeaderboard(leaderboard);

  return res.status(200).json({
    success: true,
    leaderboard
  });
}
