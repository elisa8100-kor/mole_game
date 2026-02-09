import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://oykepnxnbyltcvcqnfbe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_85W1hHMVmhILGBbrX-l4wg_qmLCn987";
const TABLE = "leaderboard";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normName(name){
  const n = String(name ?? "").trim().slice(0, 12);
  return n.length ? n : "익명";
}

export function createLeaderboard(){
  const els = {
    lb1Name: $("lb1Name"), lb1Meta: $("lb1Meta"),
    lb2Name: $("lb2Name"), lb2Meta: $("lb2Meta"),
    lb3Name: $("lb3Name"), lb3Meta: $("lb3Meta"),
    lbList: $("lbList"),
    lbStatus: $("lbStatus"),
  };

  async function fetchTop10(){
    const { data, error } = await supabase
      .from(TABLE)
      .select("name, score, max_combo, created_at")
      .order("score", { ascending:false })
      .order("max_combo", { ascending:false })
      .order("created_at", { ascending:true })
      .limit(10);

    if(error) throw error;
    return data ?? [];
  }

  async function insertScore({ name, score, maxCombo }){
    const payload = {
      name: normName(name),
      score: Number(score) || 0,
      max_combo: Number(maxCombo) || 0,
    };

    const { error } = await supabase.from(TABLE).insert(payload);
    if(error) throw error;
  }

  function render(rows){
    const r1 = rows[0], r2 = rows[1], r3 = rows[2];

    els.lb1Name.textContent = r1 ? r1.name : "-";
    els.lb1Meta.textContent = r1 ? `${r1.score} pts • ${(r1.max_combo ?? 0)}x` : "-";

    els.lb2Name.textContent = r2 ? r2.name : "-";
    els.lb2Meta.textContent = r2 ? `${r2.score} pts • ${(r2.max_combo ?? 0)}x` : "-";

    els.lb3Name.textContent = r3 ? r3.name : "-";
    els.lb3Meta.textContent = r3 ? `${r3.score} pts • ${(r3.max_combo ?? 0)}x` : "-";

    els.lbList.innerHTML = "";

    const rest = rows.slice(3, 10);
    if(rest.length === 0){
      const li = document.createElement("li");
      li.innerHTML = `<span class="who">아직 기록이 없어요</span><span class="stat">-</span>`;
      els.lbList.appendChild(li);
      return;
    }

    rest.forEach((r, idx)=>{
      const rank = idx + 4;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="who">${rank}. ${esc(r.name)}</span>
        <span class="stat">${r.score} pts • ${(r.max_combo ?? 0)}x</span>
      `;
      els.lbList.appendChild(li);
    });
  }

  async function refresh(){
    try{
      els.lbStatus.textContent = "불러오는 중…";
      const rows = await fetchTop10();
      render(rows);
      els.lbStatus.textContent = rows.length ? `업데이트됨 • TOP ${rows.length}` : "아직 기록 없음";
    }catch(e){
      console.error(e);
      els.lbStatus.textContent = "불러오기 실패 (콘솔 확인)";
    }
  }

  // 게임오버 처리 (valid=false면 저장 안 함)
  async function handleGameOverForLeaderboard({ score, maxCombo, valid }){
    if(!valid){
      els.lbStatus.textContent = "기록 무효(이탈 감지) • 저장 안 함";
      await refresh();
      return;
    }

    const name = prompt("닉네임 (12자 이내)", "익명");
    if(!name){
      els.lbStatus.textContent = "입력 취소 • 저장 안 함";
      await refresh();
      return;
    }

    try{
      els.lbStatus.textContent = "점수 저장 중…";
      await insertScore({ name, score, maxCombo });
      els.lbStatus.textContent = "저장 완료 • 갱신 중…";
      await refresh();
    }catch(e){
      console.error(e);
      els.lbStatus.textContent = "저장 실패 (RLS/컬럼 확인)";
      alert("저장 실패! 콘솔(F12) 확인\nRLS 정책/테이블 컬럼(name, score, max_combo) 확인해줘.");
    }
  }

  return { refresh, handleGameOverForLeaderboard };
}
