import { getHighScore, setHighScore } from "./storage.js"; // storage.js가 없다면 main.js에서 대체 구현해줄게

export function createGame(ui, leaderboard){
  const W = 640, H = 720;
  const TAU = Math.PI * 2;
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rand = (a,b)=>Math.random()*(b-a)+a;

  const COLORS = {
    BG: getCSS('--bg','#121621'),
    HOLE: getCSS('--hole','#172030'),
    MOLE: getCSS('--mole','#7b4a2b'),
    MOLE_SHADOW: getCSS('--mole-shadow','#3a2316'),
    HUD: getCSS('--hud','#eaeaf0'),
    RED: getCSS('--danger','#ff6b6b'),
    ACCENT: getCSS('--accent','#7aa2ff'),
    WHITE: "#ffffff",
  };

  function getCSS(varName, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }
  const font = (px=28)=>`${px}px "Malgun Gothic","Apple SD Gothic Neo",system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans KR",Arial,sans-serif`;

  const STATE_MENU="MENU", STATE_PLAY="PLAY", STATE_GAMEOVER="GAMEOVER";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha:false });

  let DPR = 1;
  function setupCanvas(){
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = true;
  }
  setupCanvas();
  window.addEventListener("resize", setupCanvas, { passive:true });

  // 정적 배경(홀) 캐시
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = W; bgCanvas.height = H;
  const bgCtx = bgCanvas.getContext("2d");

  // 포인터
  let pointer = { x:0, y:0, justPressed:false, isTouch:false };
  function updatePointer(e){
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / W;
    const sy = rect.height / H;
    pointer.x = (e.clientX - rect.left) / sx;
    pointer.y = (e.clientY - rect.top) / sy;
  }

  canvas.addEventListener("pointermove", (e)=> updatePointer(e), { passive:true });
  canvas.addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    pointer.isTouch = (e.pointerType === "touch");
    canvas.setPointerCapture(e.pointerId);
    updatePointer(e);
    pointer.justPressed = true;

    if(game.state === STATE_MENU){
      game.reset();
      game.state = STATE_PLAY;
      ui.setHintByState("PLAY");
    }
  }, { passive:false });

  class Mole {
    constructor(cx,cy){
      this.cx=cx; this.cy=cy;
      this.baseR=36;
      this.state="hidden";
      this.t=0;
      this.visibleDur=0.7;
      this.appearDur=0.16;
      this.disappearDur=0.13;
      this.wasHit=false;
    }
    spawn(visibleSeconds){
      this.state="appearing"; this.t=0; this.wasHit=false;
      this.visibleDur = Math.max(0.28, visibleSeconds);
    }
    isClickable(){ return this.state==="appearing" || this.state==="visible"; }
    currentRadius(){
      if(this.state==="appearing"){
        const k = clamp(this.t/this.appearDur,0,1);
        return this.baseR*(0.2+0.8*k);
      }
      if(this.state==="visible"){
        const pulse = 0.04*Math.sin(this.t*10);
        return this.baseR*(1+pulse);
      }
      if(this.state==="disappearing"){
        const k = 1 - clamp(this.t/this.disappearDur,0,1);
        return this.baseR*(0.2+0.8*k);
      }
      return this.baseR*0.2;
    }
    contains(x,y,isTouch){
      const r=this.currentRadius();
      const bonus = isTouch ? 1.15 : 1.0;
      const rr = (r*0.9*bonus);
      const dx=x-this.cx, dy=y-this.cy;
      return dx*dx+dy*dy <= rr*rr;
    }
    update(dt){
      if(this.state==="hidden") return;
      this.t += dt;

      if(this.state==="appearing" && this.t>=this.appearDur){
        this.state="visible"; this.t=0;
      } else if(this.state==="visible" && this.t>=this.visibleDur){
        this.state="disappearing"; this.t=0;
      } else if(this.state==="disappearing" && this.t>=this.disappearDur){
        this.state="hidden"; this.t=0;
      }
    }
    hit(){
      if(this.isClickable() && !this.wasHit){
        this.wasHit=true;
        this.state="disappearing"; this.t=0;
        return true;
      }
      return false;
    }
    draw(c){
      if(this.state==="hidden") return;
      const r=this.currentRadius();

      c.fillStyle=COLORS.MOLE_SHADOW;
      c.beginPath(); c.arc(this.cx,this.cy+3,r,0,TAU); c.fill();

      c.fillStyle=COLORS.MOLE;
      c.beginPath(); c.arc(this.cx,this.cy,r,0,TAU); c.fill();

      const eyeR=Math.max(2, r/8);
      c.fillStyle="#1e1e1e";
      c.beginPath(); c.arc(this.cx-r/3,this.cy-r/5,eyeR,0,TAU); c.fill();
      c.beginPath(); c.arc(this.cx+r/3,this.cy-r/5,eyeR,0,TAU); c.fill();

      const noseR=Math.max(2, r/6);
      c.fillStyle="#ffaaaa";
      c.beginPath(); c.arc(this.cx,this.cy,noseR,0,TAU); c.fill();
    }
  }

  class ParticlePool {
    constructor(cap=240){
      this.pool = Array.from({length:cap}, ()=>({active:false,x:0,y:0,vx:0,vy:0,life:0,color:"#fff",size:2}));
      this.cursor=0;
    }
    emit(x,y,color,count=16){
      for(let i=0;i<count;i++){
        const p=this.pool[this.cursor];
        this.cursor=(this.cursor+1)%this.pool.length;
        const ang = rand(0,TAU), spd=rand(2,6);
        p.active=true; p.x=x; p.y=y;
        p.vx=Math.cos(ang)*spd; p.vy=Math.sin(ang)*spd;
        p.life=rand(0.25,0.45);
        p.color=color; p.size=rand(2,4);
      }
    }
    update(dt){
      for(const p of this.pool){
        if(!p.active) continue;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.96; p.vy *= 0.96;
        p.life -= dt;
        if(p.life<=0) p.active=false;
      }
    }
    draw(c){
      for(const p of this.pool){
        if(!p.active) continue;
        const r = Math.max(1, p.size*(p.life/0.45));
        c.fillStyle=p.color;
        c.beginPath(); c.arc(p.x,p.y,r,0,TAU); c.fill();
      }
    }
  }

  class FloatTextPool {
    constructor(cap=42){
      this.pool=Array.from({length:cap}, ()=>({active:false,x:0,y:0,vy:-40,life:0.8,text:"",color:"#fff"}));
      this.cursor=0;
    }
    pop(x,y,text,color){
      const f=this.pool[this.cursor];
      this.cursor=(this.cursor+1)%this.pool.length;
      f.active=true; f.x=x; f.y=y; f.text=text; f.color=color;
      f.life=0.8; f.vy=-40;
    }
    update(dt){
      for(const f of this.pool){
        if(!f.active) continue;
        f.life -= dt;
        f.y += f.vy*dt;
        if(f.life<=0) f.active=false;
      }
    }
    draw(c){
      c.font = font(18);
      c.textAlign="center"; c.textBaseline="middle";
      for(const f of this.pool){
        if(!f.active) continue;
        c.globalAlpha = clamp(f.life/0.8,0,1);
        c.fillStyle=f.color;
        c.fillText(f.text, f.x, f.y);
        c.globalAlpha=1;
      }
    }
  }

  function drawTextCenter(text, size, color, cx, cy){
    ctx.font = font(size);
    ctx.fillStyle = color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
  }

  function renderStaticBackground(holeCenters){
    bgCtx.fillStyle = COLORS.BG;
    bgCtx.fillRect(0,0,W,H);
    bgCtx.fillStyle = COLORS.HOLE;
    for(const [x,y] of holeCenters){
      const shadowR = 36*1.15;
      bgCtx.beginPath();
      bgCtx.arc(x,y,shadowR,0,TAU);
      bgCtx.fill();
    }
  }

  class Game {
    constructor(){
      this.state=STATE_MENU;
      this.timeLimit=30;
      this.highScore=getHighScore();

      this.invalidRun=false;
      this.reset();
    }
    reset(){
      const marginX=80, marginY=160;
      const gapX=((W-marginX*2)/2);
      const gapY=((H-marginY-120)/2);

      this.centers=[];
      for(let gy=0; gy<3; gy++){
        for(let gx=0; gx<3; gx++){
          this.centers.push([marginX+gx*gapX+40, marginY+gy*gapY+40]);
        }
      }

      this.moles=this.centers.map(([x,y])=>new Mole(x,y));
      renderStaticBackground(this.centers);

      this.score=0; this.combo=0; this.maxCombo=0;
      this.elapsed=0; this.spawnTimer=0;

      this.baseVisible=0.80;
      this.visible=this.baseVisible;
      this.spawnInterval=0.95;
      this.warmup=4.0;

      this.particles=new ParticlePool(240);
      this.floatText=new FloatTextPool(42);

      this.invalidRun=false;
    }
    updateDifficulty(){
      const p = clamp(this.elapsed/this.timeLimit, 0, 1);
      const warm = clamp(this.elapsed/this.warmup, 0, 1);

      const targetVisible = Math.max(0.28, this.baseVisible - 0.38*p);
      const targetInterval = Math.max(0.35, 0.95 - 0.60*p);

      this.visible = this.baseVisible*(1-warm) + targetVisible*warm;
      this.spawnInterval = 1.05*(1-warm) + targetInterval*warm;
    }
    spawnLogic(){
      const hidden=this.moles.filter(m=>m.state==="hidden");
      if(hidden.length) hidden[(Math.random()*hidden.length)|0].spawn(this.visible);
    }
  }

  const game = new Game();
  let last = performance.now();
  let topHint = "";

  function invalidate(reason){
    if(game.state !== STATE_PLAY) return;
    game.invalidRun = true;
    topHint = `기록 무효: ${reason}`;
    game.state = STATE_GAMEOVER;
    onGameOver();
  }

  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) invalidate("탭/앱 이탈");
  });
  window.addEventListener("blur", ()=> invalidate("포커스 이탈"));

  function boot(){
    ui.setHintByState("MENU");

    ui.startBtn.addEventListener("click", ()=>{
      if(game.state===STATE_MENU || game.state===STATE_GAMEOVER){
        topHint=""; game.reset(); game.state=STATE_PLAY;
        ui.setHintByState("PLAY");
      }
    });

    window.addEventListener("keydown", (e)=>{
      if(e.code==="Space" && game.state===STATE_MENU){
        topHint=""; game.reset(); game.state=STATE_PLAY; ui.setHintByState("PLAY");
      } else if(e.code==="KeyR" && (game.state===STATE_GAMEOVER || game.state===STATE_PLAY)){
        topHint=""; game.reset(); game.state=STATE_PLAY; ui.setHintByState("PLAY");
      }
    });

    requestAnimationFrame(loop);
  }

  async function onGameOver(){
    if(game.score > game.highScore){
      game.highScore = game.score;
      setHighScore(game.highScore);
    }
    ui.setHintByState("GAMEOVER");

    ui.setHud({ score: game.score, combo: game.combo, maxCombo: game.maxCombo, timeLeft: 0 });

    leaderboard.handleGameOverForLeaderboard({
      score: game.score,
      maxCombo: game.maxCombo,
      valid: !game.invalidRun
    });
  }

  function update(dt){
    if(game.state===STATE_PLAY){
      game.elapsed += dt;
      game.spawnTimer += dt;

      game.updateDifficulty();
      while(game.spawnTimer >= game.spawnInterval){
        game.spawnTimer -= game.spawnInterval;
        game.spawnLogic();
      }

      for(const m of game.moles) m.update(dt);

      if(pointer.justPressed){
        let hit=false;

        for(const m of game.moles){
          if(m.contains(pointer.x, pointer.y, pointer.isTouch) && m.hit()){
            hit=true;
            const gain = 10 + game.combo*2;
            game.score += gain;
            game.combo += 1;
            game.maxCombo = Math.max(game.maxCombo, game.combo);

            game.particles.emit(pointer.x, pointer.y, COLORS.ACCENT, 18);
            game.floatText.pop(pointer.x, pointer.y-10, `+${gain}`, COLORS.ACCENT);
            break;
          }
        }

        if(!hit){
          const prevCombo = game.combo;
          game.combo = 0;
          game.score = Math.max(0, game.score-5);
          game.floatText.pop(pointer.x, pointer.y-10, `MISS`, COLORS.RED);
          if(prevCombo >= 8) ui.toast(`콤보 ${prevCombo}에서 끊김`);
        }
      }

      game.particles.update(dt);
      game.floatText.update(dt);

      const remain = Math.max(0, Math.ceil(game.timeLimit - game.elapsed));
      ui.setHud({ score: game.score, combo: game.combo, maxCombo: game.maxCombo, timeLeft: remain });

      if(game.elapsed >= game.timeLimit){
        game.state = STATE_GAMEOVER;
        onGameOver();
      }
    }

    pointer.justPressed = false;
  }

  function draw(){
    ctx.drawImage(bgCanvas, 0, 0);

    for(const m of game.moles) m.draw(ctx);
    game.particles.draw(ctx);
    game.floatText.draw(ctx);

    if(game.state===STATE_MENU){
      drawTextCenter("두더지 잡기", 64, COLORS.WHITE, W/2, H/2-90);
      drawTextCenter("Space 또는 시작 버튼", 28, COLORS.WHITE, W/2, H/2-20);
      drawTextCenter(`최대 점수: ${game.highScore}`, 24, COLORS.HUD, W/2, H/2+60);
    }

    if(game.state===STATE_GAMEOVER){
      const title = game.invalidRun ? "기록 무효" : "게임 오버";
      const color = game.invalidRun ? COLORS.WHITE : COLORS.RED;

      drawTextCenter(title, 64, color, W/2, H/2-70);
      drawTextCenter(`최종 점수: ${game.score}`, 40, COLORS.WHITE, W/2, H/2-5);
      drawTextCenter(`최대 점수: ${game.highScore}`, 30, COLORS.WHITE, W/2, H/2+45);
      drawTextCenter("R 로 재시작 가능", 26, COLORS.HUD, W/2, H/2+120);
      if(topHint) drawTextCenter(topHint, 20, COLORS.HUD, W/2, H/2+160);
    }
  }

  function loop(now){
    const dt = clamp((now-last)/1000, 0, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  return { boot };
}
