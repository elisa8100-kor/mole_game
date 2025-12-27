global.leaderboard = global.leaderboard || [];

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const top10 = [...global.leaderboard]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
      score: r.score,
      maxCombo: r.maxCombo,
      createdAt: r.createdAt
    }));

  res.status(200).json(top10);
}
