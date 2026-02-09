import { createGame } from "./game.js";
import { createLeaderboard } from "./leaderboard.js";

// ✅ storage.js 대체: 로컬 최고점수 저장
const KEY = "mole_high_score_v1";
function getHighScore(){
  const n = Number(localStorage.getItem(KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}
function setHighScore(v){
  localStorage.setItem(KEY, String(Number(v) || 0));
}

// game.js가 storage.js를 import 하지 않도록 “주입” 방식으로 쓰려면
// game.js에서 import 줄을 지우고 createGame(ui, leaderboard, {getHighScore, setHighScore}) 형태가 깔끔한데,
// 지금은 빠르게 동작 우선으로 아래처럼 window에 올려서 해결(간단/확실).
window.__HS__ = { getHighScore, setHighScore };

const ui = (() => {
  const $ = (id) => document.getElementById(id);

  const scoreEl = $("score");
  const timeEl = $("time");
  const comboEl = $("combo");
  const maxComboEl = $("maxCombo");

  const startBtn = $("startBtn");

  // 가벼운 토스트
  let toastT = 0;
  function toast(msg){
    toastT = 2.0;
    console.log("[toast]", msg);
  }

  function setHud({ score, timeLeft, combo, maxCombo }){
    if(score != null) scoreEl.textContent = String(score);
    if(timeLeft != null) timeEl.textContent = String(timeLeft);
    if(combo != null) comboEl.textContent = String(combo);
    if(maxCombo != null) maxComboEl.textContent = String(maxCombo);
  }

  function setHintByState(state){
    // 필요하면 확장 가능 (지금은 HUD로 충분)
  }

  return {
    startBtn,
    setHud,
    setHintByState,
    toast
  };
})();

// 리더보드
const leaderboard = createLeaderboard();
await leaderboard.refresh();

// 게임
// ⚠️ game.js에서 storage.js import 제거 필요.
// 가장 안전한 해결: game.js 맨 위 import {getHighScore,setHighScore} 줄 삭제하고
// 아래 두 줄을 game.js 내부 Game 생성자에서 사용하도록 바꾸기:
// this.highScore = window.__HS__.getHighScore();
// window.__HS__.setHighScore(...)
const game = createGame(ui, leaderboard);
game.boot();

// 버튼
document.getElementById("refreshBtn").addEventListener("click", () => leaderboard.refresh());

