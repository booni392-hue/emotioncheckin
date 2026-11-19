/* 앱 화면과 이벤트 로직 — 기능 변경은 개발자와 협의하세요. */
let day=1, qi=0, selected=null, phase="quiz";
const typeScore={A:0,B:0,C:0,D:0};
// answers[day] = [ {topic, label, kind, idx}, ... ]  실제 유저 선택 저장
const answers={};
const stage=document.getElementById('stage');

function list(){ return DATA[day].q; }

function renderDots(){
  const n=list().length; let h='';
  for(let i=0;i<n;i++) h+=`<i class="${i<=qi?'on':''}"></i>`;
  document.getElementById('dots').innerHTML=h;
}
function updateChrome(){
  document.getElementById('streak').textContent=`🔥 Day ${day}`;
  document.getElementById('prevBtn').style.visibility=(day===1&&qi===0)?'hidden':'visible';
  renderDots();
}

// 한글 문장 줄바꿈
// - 쉼표(,)·마침표(.) 뒤에서는 반드시 줄을 바꾼다
// - 느낌표(!)·물음표(?)는 한 줄이 너무 길어질 때만 끊어, "딱! / 나왔어." 같은 어색함을 막는다
const BRK_MAX=16;
function brk(str){
  const parts=String(str).match(/[^,.!?~]+[,.!?~]*\s*/g);
  if(!parts) return String(str);
  const lines=[]; let cur='';
  parts.forEach(raw=>{
    const t=raw.trim(); if(!t) return;
    const hard=/[,.]$/.test(t);                      // 쉼표·마침표 → 무조건 줄바꿈
    if(cur && (cur.length+1+t.length)>BRK_MAX){ lines.push(cur); cur=t; }
    else { cur = cur ? cur+' '+t : t; }
    if(hard){ lines.push(cur); cur=''; }
  });
  if(cur) lines.push(cur);
  return lines.join('<br>');
}

function render(){
  const item=list()[qi];
  updateChrome();
  if(item.map){ renderMap(item); return; }
  selected=null;
  const grid=item.o.length<=2?'opts one':'opts';
  let opts='';
  item.o.forEach((o,idx)=>{
    opts+=`<button class="opt" data-idx="${idx}" onclick="pick(${idx})">
      <span class="radio"></span><span class="otext">${o[1]}</span><span class="emoji">${o[0]}</span></button>`;
  });
  // big-title greeting = intro
  // 인사/질문 타이틀: 문장 단위로 줄바꿈해 읽기 쉽게
  let title=brk(item.intro).replace(NAME, `<span class="nm">${NAME}</span>`);
  stage.innerHTML=`
    <div class="left">
      <div class="mascot">${item.mascot||"🌟"}</div>
      <div class="q-eyebrow">${item.kind==='emo'?'오늘의 마음 🍪':'오늘의 한 입 질문 🍪'}</div>
      <h1 class="q-title">${title}</h1>
    </div>
    <div class="right">
      <div class="right-guide">너의 마음을 알려줘.<br><b>마음에는 좋고 나쁜 건 없어.</b></div>
      <div class="${grid}">${opts}</div>
      <div class="fbwrap"><div class="fb" id="fb"><span class="fx" id="fbfx"></span><span class="txt" id="fbtxt"></span></div></div>
    </div>`;
  const nb=document.getElementById('nextBtn');
  nb.disabled=true;
  nb.textContent = (qi===list().length-1)? (day===10?'결과 보기 🎉':'오늘 끝!') : '다음';
}

function pick(idx){
  selected=idx;
  document.querySelectorAll('.opt').forEach(e=>{e.classList.remove('sel');e.classList.add('dim');});
  const chosen=document.querySelector(`.opt[data-idx="${idx}"]`);
  chosen.classList.add('sel'); chosen.classList.remove('dim');
  const item=list()[qi];
  // save actual answer
  answers[day]=answers[day]||[];
  answers[day][qi]={topic:item.topic, q:item.intro, label:item.o[idx][1], emoji:item.o[idx][0], kind:item.kind, idx};
  // popup feedback
  const pool=FB[item.kind]||FB.emo; const f=pool[idx%pool.length];
  const fb=document.getElementById('fb');
  document.getElementById('fbfx').textContent=f.fx;
  document.getElementById('fbtxt').innerHTML=f.t;
  // confetti
  fb.querySelectorAll('.spark').forEach(s=>s.remove());
  const cols=['#FF7A00','#FFC02E','#4C8DFF','#7C6BFF','#FF8A3D'];
  for(let i=0;i<10;i++){
    const s=document.createElement('span'); s.className='spark';
    s.style.background=cols[i%cols.length];
    s.style.left=(10+Math.random()*80)+'%'; s.style.top='50%';
    const ang=Math.random()*Math.PI*2, dist=40+Math.random()*50;
    s.style.setProperty('--to',`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist - 30}px)`);
    fb.appendChild(s);
  }
  fb.classList.remove('show'); void fb.offsetWidth; fb.classList.add('show');
  sfxSparkle(item.kind==='emo'?[880,1175]:[988,1319], (ac()?ac().currentTime+.14:0));
  if(item.kind==='type') typeScore[TYPES[idx].key]++;
  document.getElementById('nextBtn').disabled=false;
}

// 그날 아이가 고른 '감정' 아이콘을 꺼내온다 (emo 문항 우선, 없으면 첫 답)
function dayEmotionIcon(d){
  const arr=answers[d]||[];
  const emo=arr.find(a=>a&&a.kind==='emo');
  const pick=emo||arr.find(a=>a&&a.emoji);
  return pick? [pick.emoji, pick.label] : null;   // buildPath는 [emoji,label] 배열로 접근
}

// ---- 친구(별명) 데이터: 랜덤 배정, 실명 아님 ----
let friends=null;       // 랜덤 생성된 친구 목록
let viewingFriend=null; // 현재 보고 있는 친구(null이면 내 지도)

// 친구도 '실제 그날의 질문'에 답한 것처럼 랜덤 선택지를 배정
function friendDayAnswers(d, nick){
  const qs=(DATA[d]&&DATA[d].q)||[];
  const out=[];
  qs.forEach(it=>{
    if(it.map || !it.o) return;
    const i=Math.floor(Math.random()*it.o.length);
    out.push({q:String(it.intro).split(NAME).join(nick), topic:it.topic,
              emoji:it.o[i][0], label:it.o[i][1], kind:it.kind});
  });
  return out;
}

function makeFriends(){
  // 별명 3명 랜덤 + 각자 진행일수/감정노드 랜덤
  const pool=[...NICK_POOL].sort(()=>Math.random()-0.5).slice(0,3);
  const themes=[...FRIEND_THEMES].sort(()=>Math.random()-0.5);
  return pool.map((nick,i)=>{
    const prog=3+Math.floor(Math.random()*8); // 3~10일 진행
    const icons=[], days={};
    for(let d=1; d<=10; d++){
      if(d<=prog){
        const qa=friendDayAnswers(d, nick);
        days[d]=qa;
        const emo=qa.find(a=>a.kind==='emo')||qa[0];
        icons.push(emo? [emo.emoji, emo.label] : EMO_POOL[Math.floor(Math.random()*EMO_POOL.length)]);
      } else { icons.push(null); }
    }
    const emoji=["🐰","🦊","🦦","🐻","🐧","🦉","🐹","🐢"][Math.floor(Math.random()*8)];
    return {nick, prog, icons, days, emoji, theme:themes[i%themes.length]};
  });
}

// 경로+노드 HTML 생성 (내 지도/친구 지도 공용)
function buildPath({total=10, curDay, getIcon, getState, themeProg, onClick, arrived}){
  const stepX=158, amp=44, baseY=176;
  const nodes=[];
  for(let d=1; d<=total; d++){
    const x=140+(d-1)*stepX, y=baseY+Math.sin((d-1)*0.9)*amp;
    nodes.push({d,x,y,state:getState(d),ic:getIcon(d)});
  }
  const width=140+(total-1)*stepX+180;
  let pathD=`M ${nodes[0].x} ${nodes[0].y}`, progD=`M ${nodes[0].x} ${nodes[0].y}`;
  for(let i=1;i<nodes.length;i++){const p0=nodes[i-1],p1=nodes[i],mx=(p0.x+p1.x)/2;
    pathD+=` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;}
  const doneCount=Math.min(curDay,total);
  for(let i=1;i<doneCount;i++){const p0=nodes[i-1],p1=nodes[i],mx=(p0.x+p1.x)/2;
    progD+=` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;}
  let nodeHTML='';
  nodes.forEach((n,i)=>{
    const inside=n.state==='done'&&n.ic?n.ic[0]:(n.state==='today'?'🚌':'🔒');
    const label=n.state==='locked'?'아직 비밀':(n.state==='today'?'여행 중!':(n.ic?n.ic[1]:`Day ${n.d}`));
    const act = onClick? ` onclick="${onClick(n.d)}"` : '';
    const flag = n.state==='today' ? '<div class="dgo">🎒 마음 여행을 떠나요!</div>' : '';
    nodeHTML+=`<div class="node ${n.state}${onClick?' tapable':''}" style="left:${n.x}px;top:${n.y}px;animation-delay:${i*60}ms"${act}>
        ${flag}<div class="bubble">${inside}</div><div class="dlabel">${label}</div><div class="dnum">Day ${n.d}</div>
        ${onClick&&n.state!=='locked'?'<div class="dpeek">눌러서 보기</div>':''}</div>`;
  });
  const progStyle = themeProg? `style="stroke:${themeProg}"` : '';
  return {width, nodes, svg:`
    <svg class="path-svg" width="${width}" height="330" viewBox="0 0 ${width} 330" preserveAspectRatio="none">
      <path d="${pathD}" class="track-line"/>
      <path d="${progD}" class="prog-line" ${progStyle}/>
    </svg>${nodeHTML}
    <div class="goal${arrived?' arrived':''}" style="left:${nodes[total-1].x+82}px;top:${nodes[total-1].y}px">
      <span class="gico">${arrived?'<b class="gbus">🚌</b>':''}🚏</span>
      <span>${arrived?'도착 완료! 🎉':'마음 여행<br>도착지'}</span></div>`};
}

function renderMap(item){
  if(!friends) friends=makeFriends();
  viewingFriend=null;
  paintMyMap(item ? item.intro : "");
  document.getElementById('nextBtn').disabled=false;
  document.getElementById('nextBtn').textContent='계속하기';
}

// 내 마음지도 + 친구 목록
function paintMyMap(intro){
  const built=buildPath({
    total:10, curDay:day,
    getIcon:d=>dayEmotionIcon(d),
    getState:d=> d<day?'done':(d===day?'today':'locked'),
    onClick:d=>`openDayDetail(${d})`
  });
  // 친구 미리보기 카드
  let cards='';
  friends.forEach((f,idx)=>{
    let mini='';
    for(let d=1;d<=10;d++){ mini+=`<span class="mini ${d<=f.prog?'on':'off'}">${d<=f.prog?f.icons[d-1][0]:'·'}</span>`; }
    cards+=`<button class="friend-card" onclick="openFriend(${idx})">
        <div class="fc-top"><span class="fc-emoji">${f.emoji}</span>
          <span class="fc-name">${f.nick}</span>
          <span class="fc-prog">${f.prog}일째</span></div>
        <div class="fc-mini">${mini}</div>
        <div class="fc-cta">마음지도 보기 →</div>
      </button>`;
  });
  stage.innerHTML=`
    <div class="dmap show" id="dmapRoot">
      <div class="dmap-head">
        <h2>🗺️ ${NAME}의 마음지도</h2>
        <p>${intro? intro+' ':''}<b>옆으로 밀어서</b> 지금까지 모은 마음을 쭉 봐!<br>
           <b>Day 동그라미를 누르면</b> 그날 뭘 물어봤고 네가 뭐라고 답했는지 다시 볼 수 있어 👀<br>
           🚏 <b>도착지</b>에 닿으면 너의 <b>마음 타입</b>을 알려줄게!</p>
      </div>
      <div class="path-scroll" id="pathScroll">
        <div class="path-inner" style="width:${built.width}px">${built.svg}</div>
      </div>
      <div class="friends">
        <div class="friends-title">👀 다른 친구들의 마음지도</div>
        <div class="friends-row">${cards}</div>
      </div>
    </div>`;
  setTimeout(()=>{const sc=document.getElementById('pathScroll');
    if(sc){const t=Math.max(0,built.nodes[Math.min(day,10)-1].x-sc.clientWidth*0.5);sc.scrollTo({left:t,behavior:'smooth'});}},300);
  sfxWhoosh();
}

// 친구 마음지도 (분위기·배경 변경)
function openFriend(idx){
  const f=friends[idx]; viewingFriend=idx;
  const th=f.theme;
  const built=buildPath({
    total:10, curDay:f.prog+1>10?11:f.prog+1,
    getIcon:d=> d<=f.prog? f.icons[d-1] : null,
    getState:d=> d<=f.prog?'done':(d===f.prog+1?'today':'locked'),
    themeProg:th.prog,
    onClick:d=>`openFriendDay(${idx},${d})`
  });
  const root=document.getElementById('stage');
  stage.innerHTML=`
    <div class="dmap show friend-view" id="dmapRoot" style="--fbg:${th.bg};--ftrack:${th.track};--fprog:${th.prog};--faccent:${th.accent}">
      <div class="dmap-head">
        <button class="backbtn" onclick="backToMine()">← 내 마음지도로</button>
        <h2 style="color:${th.head}">${f.emoji} ${f.nick}의 마음지도</h2>
        <p style="color:${th.accent}"><b>${f.nick}</b>는 지금 ${f.prog}일째 마음을 모으고 있어!<br>
           <b>Day 동그라미를 누르면</b> ${f.nick}가 그날 어떤 질문에 뭐라고 답했는지 볼 수 있어 👀</p>
      </div>
      <div class="path-scroll friend-scroll" id="pathScroll" style="background:${th.bg};border-color:${th.track}">
        <div class="path-inner" style="width:${built.width}px">${built.svg}</div>
      </div>
      <div class="friend-foot">
        <button class="backbtn big" onclick="backToMine()">← 내 마음지도로 돌아가기</button>
      </div>
    </div>`;
  // 친구 지도는 오늘 노드로 스크롤
  setTimeout(()=>{const sc=document.getElementById('pathScroll');
    if(sc){const t=Math.max(0,built.nodes[Math.min(f.prog,10)-1].x-sc.clientWidth*0.5);sc.scrollTo({left:t,behavior:'smooth'});}},300);
  document.getElementById('nextBtn').disabled=false;
  document.getElementById('nextBtn').textContent='계속하기';
  sfxWhoosh();
}

// ===== Day 상세 모달: 그날의 질문 + 선택한 답 =====
function dmodalHTML({emoji, title, sub, items, note, accent}){
  const ac = accent || '#FF7A00';
  let body='';
  if(note){
    body = `<div class="dm-note">${note}</div>`;
  } else {
    items.forEach((a,i)=>{
      body += `<div class="dm-item">
          <div class="dm-qn">Q${i+1}. ${a.topic?`<span class="dm-tag" style="background:${ac}1a;color:${ac}">${a.topic}</span>`:''}</div>
          <div class="dm-q">${brk(a.q)}</div>
          <div class="dm-a" style="color:${ac}"><span class="ae">${a.emoji}</span>${a.label}</div>
        </div>`;
    });
  }
  return `<div class="dm-card" onclick="event.stopPropagation()">
      <button class="dm-x" onclick="closeDayModal()" aria-label="닫기">✕</button>
      <div class="dm-head">
        <div class="dm-emoji" style="background:${ac}1f">${emoji}</div>
        <div><div class="dm-title">${title}</div><div class="dm-sub">${sub}</div></div>
      </div>
      ${body}
    </div>`;
}

function showDayModal(html){
  const m=document.getElementById('dmodal');
  m.innerHTML=html; m.style.display='flex';
}
function closeDayModal(){
  const m=document.getElementById('dmodal');
  m.style.display='none'; m.innerHTML='';
}

// 내 마음지도의 Day 클릭
function openDayDetail(d){
  const arr=(answers[d]||[]).filter(a=>a&&a.q);
  let note=null;
  if(d>day) note=`아직 열리지 않은 날이야 🔒<br>Day ${d}이 되면 여기에 질문과 네 대답이 담길 거야!`;
  else if(arr.length===0) note=`오늘은 아직 마음을 안 알려줬어 🙂<br>질문에 답하면 여기에 쏙 담아둘게!`;
  showDayModal(dmodalHTML({
    emoji: d>day?'🔒':((arr[0]&&arr[0].emoji)||'📍'),
    title: `Day ${d} · ${NAME}의 마음`,
    sub: d<day?'그날 물어본 질문과 네가 고른 답이야':(d===day?'오늘 채우고 있는 날이야':'아직 잠겨 있는 날'),
    items: arr, note, accent:'#FF7A00'
  }));
}

// 친구 마음지도의 Day 클릭
function openFriendDay(fi,d){
  const f=friends[fi], ac=f.theme.accent;
  const arr=(f.days&&f.days[d])||[];
  let note=null;
  if(arr.length===0) note=`${f.nick}는 아직 Day ${d}의 마음을 안 남겼어 🔒`;
  showDayModal(dmodalHTML({
    emoji: arr.length?((arr.find(a=>a.kind==='emo')||arr[0]).emoji):'🔒',
    title: `Day ${d} · ${f.nick}의 마음`,
    sub: arr.length?'그날 물어본 질문과 친구가 고른 답이야':'아직 잠겨 있는 날',
    items: arr, note, accent:ac
  }));
}

function backToMine(){
  viewingFriend=null;
  paintMyMap("");
}

function renderResult(){
  phase="result";
  let top='A',mx=-1; for(const k in typeScore) if(typeScore[k]>mx){mx=typeScore[k];top=k;}
  const t=Object.values(TYPES).find(x=>x.key===top);
  const total=Object.values(typeScore).reduce((a,b)=>a+b,0)||1;
  const colors={A:'#FF8A3D',B:'#4C8DFF',C:'#9B7BFF',D:'#FFC02E'};
  // 타입별 화면 테마 (성향에 따라 배경 분위기도 달라짐)
  const THEME={
    A:{bg:'linear-gradient(150deg,#FF9A56,#FF6B6B 60%,#C9457B)', glow:'#FFD3A0'},
    B:{bg:'linear-gradient(150deg,#4C8DFF,#5B6BFF 55%,#7B4CFF)', glow:'#AED0FF'},
    C:{bg:'linear-gradient(150deg,#9B7BFF,#7C6BFF 55%,#B85BFF)', glow:'#E0D3FF'},
    D:{bg:'linear-gradient(150deg,#FFC02E,#FF9E45 55%,#FF6B6B)', glow:'#FFE7A0'}
  }[top];
  let bars='';
  ['A','B','C','D'].forEach(k=>{
    const tt=Object.values(TYPES).find(x=>x.key===k);
    const pct=Math.round(typeScore[k]/total*100);
    const isTop=(k===top);
    bars+=`<div class="rs-bar ${isTop?'rs-top':''}">
        <span class="nmwrap">${tt.emoji} ${tt.name}${isTop?'<span class="rs-crown">👑</span><span class="rs-mine">내 타입!</span>':''}</span>
        <div class="rs-track"><div class="rs-fill" style="background:${colors[k]}" data-w="${pct}"></div></div>
        <span class="rs-pct">${pct}%</span>
      </div>`;
  });
  // 컨페티
  let conf=''; const cc=['#FFD54F','#FF8A3D','#4C8DFF','#9B7BFF','#FF6B9D','#5DE0A6','#fff'];
  for(let i=0;i<40;i++){
    conf+=`<span class="cfetti" style="left:${Math.random()*100}%;background:${cc[i%cc.length]};
      animation-delay:${Math.random()*2}s;animation-duration:${2.5+Math.random()*2}s;
      transform:rotate(${Math.random()*360}deg)"></span>`;
  }
  // 전체화면 특별 오버레이
  const overlay=document.createElement('div');
  overlay.className='result-screen';
  overlay.id='resultScreen';
  overlay.style.background=THEME.bg;
  overlay.innerHTML=`
    <div class="cfetti-wrap">${conf}</div>
    <div class="rs-inner">
      <div class="rs-eyebrow">
        <span class="rs-hero-sub">
          <i class="r-bus">🚌</i><i class="r-line"></i><i class="r-stop">🚏</i>
          <span class="r-txt">나의 마음 여행이 <span class="hl">첫 번째 목적지</span>에 도착했습니다!</span>
        </span>
        <span class="rs-hero-main">나의 마음 <span class="hl">타입</span>은?</span>
      </div>
      <div class="rs-body">
        <div class="rs-card" style="--glow:${THEME.glow}">
          <div class="rs-stop"><span class="bus">🚌</span>첫 번째 목적지 도착!</div>
          <div class="rs-badge">${t.emoji}</div>
          <div class="rs-name">${NAME}이는<br><b>${t.name}</b></div>
          <div class="rs-desc">${t.desc}</div>
        </div>
        <div class="rs-right">
          <div class="rs-h">🚏 10일 동안 달려온 마음 여행, 여기서 만난 <b>첫 번째 타입</b>이야 🎉</div>
          <div class="rs-bars">${bars}</div>
        </div>
      </div>
      <div class="rs-banner">
        <div class="rs-banner-emoji">🚌</div>
        <div class="rs-banner-txt">
          ${NAME}이는 <b>${t.emoji} ${t.name}</b> 유형이니까,
          ${t.retry}
        </div>
      </div>
    </div>
    <div class="rs-foot">
      <button class="rs-map" onclick="openMapOverlay(true)">🗺️ 내 마음지도 보기</button>
      <button class="rs-done" onclick="restart()">완료</button>
    </div>`;
  document.getElementById('tab').appendChild(overlay);
  sfxFanfare();
  setTimeout(()=>overlay.querySelectorAll('.rs-fill').forEach(f=>f.style.width=f.dataset.w+'%'),200);
  // 하단 기본 네비 숨김 (특별화면 자체 버튼 사용)
  document.querySelector('.bottom').style.display='none';
  document.getElementById('dots').innerHTML='';
}

function next(){
  const item=list()[qi];
  if(phase==="result"){ restart(); return; }
  if(!item.map && item.o && selected===null) return;
  if(day===10 && qi===list().length-1){ renderResult(); return; }
  if(qi<list().length-1){ qi++; render(); return; }
  showDayEnd();
}
function prev(){
  if(phase==="result") return;
  if(qi>0){ qi--; render(); }
  else if(day>1){ day--; qi=list().length-1; render(); }
}

// pick a random remembered answer from a given day (prefer emo/energy style)
// ===== 하루 시작 인트로 =====
function destInfo(d){
  const left=Math.max(0,10-(d-1));            // 이번 목적지까지 남은 날
  return {left, label:'첫 번째 목적지'};
}

function paintRoute(fillId, busId, doneDays){
  const pct=Math.max(0,Math.min(100, doneDays/10*100));
  setTimeout(()=>{
    const f=document.getElementById(fillId), b=document.getElementById(busId);
    if(f) f.style.width=pct+'%';
    if(b) b.style.left=pct+'%';
  },120);
}

function showDayIntro(){
  const info=DAY_INTRO[day]||DAY_INTRO[1];
  const d=destInfo(day);
  document.getElementById('diK').textContent=`🚌 Day ${day} · 마음 여행`;
  document.getElementById('diTitle').innerHTML=info.t;
  document.getElementById('diSub').innerHTML=info.s;
  document.getElementById('diProg').innerHTML =
    `🚏 <b>${d.label}</b>까지 <b>${d.left}일</b> 남았어! · 목적지는 <b>10일</b>마다 하나씩 🚌`;
  const di=document.getElementById('dayintro');
  di.classList.add('show');
  document.getElementById('diFill').style.width='0%';
  document.getElementById('diBus').style.left='0%';
  paintRoute('diFill','diBus', day-1);
  sfxWhoosh();
}

function closeDayIntro(){
  document.getElementById('dayintro').classList.remove('show');
  qi=0; render();
}

// ===== 마음지도 전체보기 (언제든 열 수 있는 오버레이) =====
function openMapOverlay(arrived){
  const built=buildPath({
    total:10, curDay: arrived?11:day,
    getIcon:d=>dayEmotionIcon(d),
    getState:d=> arrived?'done':(d<day?'done':(d===day?'today':'locked')),
    onClick:d=>`openDayDetail(${d})`,
    arrived:!!arrived
  });
  const d=destInfo(arrived?11:day);
  const line = arrived
    ? `🎉 <b>첫 번째 목적지</b>에 도착한 마음 여행길이야! 동그라미를 누르면 그날 기록을 볼 수 있어 👀`
    : `🚏 <b>${d.label}</b>까지 <b>${d.left}일</b> 남았어! 동그라미를 누르면 그날 기록을 볼 수 있어 👀`;
  document.getElementById('mapovBody').innerHTML=`
    <div class="dmap show">
      <div class="dmap-head">
        <h2>🗺️ ${NAME}의 마음지도</h2>
        <p>${line}</p>
      </div>
      <div class="path-scroll" id="pathScrollOv">
        <div class="path-inner" style="width:${built.width}px">${built.svg}</div>
      </div>
    </div>`;
  document.getElementById('mapOverlay').classList.add('show');
  setTimeout(()=>{const sc=document.getElementById('pathScrollOv');
    if(sc){const t=Math.max(0,built.nodes[Math.min(arrived?10:day,10)-1].x-sc.clientWidth*0.5);
      sc.scrollTo({left:t,behavior:'smooth'});}},280);
  sfxWhoosh();
}
function closeMapOverlay(){
  document.getElementById('mapOverlay').classList.remove('show');
}

function pickRecall(fromDay){
  const arr=(answers[fromDay]||[]).filter(a=>a&&a.label);
  if(arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}

function showDayEnd(){
  document.getElementById('deK').textContent=`🚌 Day ${day} 완료!`;
  const msgs=[
    ["오늘도 마음 알려줘서<br>고마워 💛"],
    ["네 마음을 잘<br>들었어 🫶"],
    ["오늘의 마음, 지도에<br>담았어 🗺️"]
  ];
  document.getElementById('deTitle').innerHTML=msgs[(day-1)%msgs.length][0];

  // Day 1 전용: 내일 다시 오라는 문구 (첫날이라 특히 중요)
  const sub=document.getElementById('deSub');
  if(day===1){
    sub.innerHTML='내일도 또 와서 네 마음을 알려줘! 💛';
    sub.style.display='block';
  } else {
    sub.style.display='none';
  }

  // RECALL: Day 2부터만 '어제 답' 상기 (Day 1은 어제가 없음)
  const rc=document.getElementById('deRecall');
  if(day>=2 && day<10){
    const mem=pickRecall(day);
    if(mem){
      // topic별 자연스러운 개인화 문장
      const q=(s)=>`<span class="quote">"${s}"</span>`;
      const em=mem.emoji;
      const M={
        "에너지":`어젠 너의 에너지가 ${q(mem.label)} ${em} 하다고 했는데,<br>오늘은 좀 어때? 또 알려주러 와줘!`,
        "오늘 기분":`어젠 기분이 ${q(mem.label)} ${em} 라고 했지.<br>내일은 어떤 기분일까? 궁금해 😊`,
        "마음의 색":`어제 네 마음은 ${q(mem.label)} ${em} 색이었어.<br>내일은 무슨 색일지 보러 와줄래?`,
        "마음의 무게":`어젠 마음이 ${q(mem.label)} ${em} 하다고 했는데,<br>오늘은 좀 가벼워졌을까?`,
        "기분 날씨":`어젠 마음 날씨가 ${q(mem.label)} ${em} 였지.<br>내일은 맑았으면 좋겠다!`,
        "마음 조약돌":`어제 네 마음 조약돌은 ${q(mem.label)} ${em} 모양이었어.<br>내일은 어떤 조약돌일까?`,
        "오늘 좋았던 순간":`어젠 ${q(mem.label)} ${em} 때가 제일 좋았다고 했지!<br>오늘은 어떤 순간이 좋았어?`
      };
      let line = M[mem.topic];
      if(!line){
        // 학습성향 등 기타: 공통 틀
        line = `어제 ${q(mem.label)} ${em} 라고 했던 거,<br>다 기억하고 있어! 내일도 궁금해 😊`;
      }
      rc.innerHTML=line;
      rc.style.display='block';
    } else { rc.style.display='none'; }
  } else { rc.style.display='none'; }

  // 마음 여행 진행도: 버스를 도착지 쪽으로 이동
  const di=destInfo(day+1);
  document.getElementById('deProg').innerHTML = di.left>0
    ? `🚏 <b>${di.label}</b>까지 <b>${di.left}일</b> 남았어! · 목적지는 <b>10일</b>마다 하나씩 🚌`
    : `🚏 <b>${di.label}</b> 도착 직전! 내일이면 네 마음 타입을 만나 🎉`;
  document.getElementById('dayend').classList.add('show');
  const pct=Math.min(100, day/10*100);
  setTimeout(()=>{
    document.getElementById('deFill').style.width=pct+'%';
    document.getElementById('deBus').style.left=pct+'%';
  },120);
  document.getElementById('deBtn').textContent = day<10 ? '다음 날 →' : '마지막 날 결과 보기 →';
  sfxSparkle([784,988,1319], (ac()?ac().currentTime+.08:0));
}

function resetDeRoute(){
  const f=document.getElementById('deFill'), b=document.getElementById('deBus');
  if(f) f.style.width='0%';
  if(b) b.style.left='0%';
}

function startNextDay(){
  resetDeRoute();
  document.getElementById('dayend').classList.remove('show');
  if(day<10){ day++; qi=0; showDayIntro(); }
  else renderResult();
}

function startFromHome(){
  const h=document.getElementById('home');
  h.style.transition='opacity .4s ease';
  h.style.opacity='0';
  setTimeout(()=>{ h.style.display='none'; showDayIntro(); },400);
}

function restart(){
  day=1;qi=0;selected=null;phase="quiz";
  for(const k in typeScore) typeScore[k]=0;
  for(const k in answers) delete answers[k];
  friends=null; viewingFriend=null;
  // 결과 특별화면 제거 + 하단 네비 복원
  const rs=document.getElementById('resultScreen'); if(rs) rs.remove();
  closeDayModal();
  closeMapOverlay();
  document.getElementById('dayintro').classList.remove('show');
  document.querySelector('.bottom').style.display='';
  document.getElementById('dayend').classList.remove('show');
  document.getElementById('prevBtn').style.visibility='hidden';
  // 처음 화면(홈)으로 복귀
  const h=document.getElementById('home');
  h.style.display='flex'; h.style.opacity='1';
}
// ===================================================================
// 사운드: 외부 파일 없이 Web Audio로 직접 합성 (뽀잉 효과음 + 잔잔한 BGM)
// ===================================================================
const SND={ctx:null, on:true, started:false, timer:null, step:0, nextT:0};

function audioInit(){
  if(SND.ctx) return SND.ctx;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    SND.ctx=new AC();
    SND.master=SND.ctx.createGain(); SND.master.gain.value=SND.on?1:0;
    SND.master.connect(SND.ctx.destination);
    SND.sfx=SND.ctx.createGain(); SND.sfx.gain.value=.6; SND.sfx.connect(SND.master);
    SND.bgmG=SND.ctx.createGain(); SND.bgmG.gain.value=0; SND.bgmG.connect(SND.master);
    // BGM을 부드럽게 만들어주는 로우패스
    SND.bgmLP=SND.ctx.createBiquadFilter();
    SND.bgmLP.type='lowpass'; SND.bgmLP.frequency.value=3400;
    SND.bgmLP.connect(SND.bgmG);
  }catch(e){ SND.ctx=null; }
  return SND.ctx;
}
function ac(){ return SND.ctx && SND.ctx.state!=='closed' ? SND.ctx : null; }
function wake(){ const c=audioInit(); try{ if(c && c.state==='suspended') c.resume(); }catch(e){} return c; }

// 🫧 뽀잉! — 살짝 흔들리는 피치로 말랑한 느낌
function sfxBoing(){
  const c=wake(); if(!c||!SND.on) return;
  const t=c.currentTime;
  const o=c.createOscillator(), g=c.createGain();
  o.type='sine';
  o.frequency.setValueAtTime(190,t);
  o.frequency.exponentialRampToValueAtTime(760,t+.06);
  o.frequency.exponentialRampToValueAtTime(310,t+.24);
  const lfo=c.createOscillator(), lg=c.createGain();      // 부르르 떨림
  lfo.type='sine'; lfo.frequency.setValueAtTime(30,t);
  lfo.frequency.exponentialRampToValueAtTime(12,t+.3);
  lg.gain.setValueAtTime(95,t); lg.gain.exponentialRampToValueAtTime(6,t+.3);
  lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.5,t+.016);
  g.gain.exponentialRampToValueAtTime(.14,t+.13);   // 2단 감쇠로 '뽀오잉~' 여운
  g.gain.exponentialRampToValueAtTime(.0001,t+.46);
  o.connect(g); g.connect(SND.sfx);
  o.start(t); lfo.start(t); o.stop(t+.48); lfo.stop(t+.48);
}

// ✨ 반짝 — 선택했을 때 뽀잉 뒤에 얹는 작은 종소리
function sfxSparkle(notes, base){
  const c=wake(); if(!c||!SND.on) return;
  const t0=(base||c.currentTime);
  (notes||[988,1319]).forEach((f,i)=>{
    const o=c.createOscillator(), g=c.createGain(), t=t0+i*.07;
    o.type='triangle'; o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.16,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+.3);
    o.connect(g); g.connect(SND.sfx); o.start(t); o.stop(t+.32);
  });
}

// 🗺️ 지도 펼쳐지는 소리 — 위로 훑고 올라가는 반짝임
function sfxWhoosh(){
  const c=wake(); if(!c||!SND.on) return;
  const t0=c.currentTime;
  [392,523,659,784,988,1319].forEach((f,i)=>{
    const t=t0+i*.045, o=c.createOscillator(), g=c.createGain();
    o.type='triangle'; o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.15,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+.42);
    o.connect(g); g.connect(SND.sfx); o.start(t); o.stop(t+.44);
  });
}

// ✧ 팅— Day 동그라미에 마우스를 올렸을 때 아주 작게
function sfxTingle(){
  const c=wake(); if(!c||!SND.on) return;
  const t=c.currentTime, o=c.createOscillator(), g=c.createGain();
  o.type='sine';
  o.frequency.setValueAtTime(1760,t);
  o.frequency.exponentialRampToValueAtTime(2637,t+.05);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.075,t+.008);
  g.gain.exponentialRampToValueAtTime(.0001,t+.24);
  o.connect(g); g.connect(SND.sfx); o.start(t); o.stop(t+.26);
}

// 🎉 완성 팡파레 — 결과 화면에서
function sfxFanfare(){
  const c=wake(); if(!c||!SND.on) return;
  [523,659,784,1047,1319].forEach((f,i)=>{
    const t=c.currentTime+i*.1;
    const o=c.createOscillator(), g=c.createGain();
    o.type='triangle'; o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.22,t+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t+.55);
    o.connect(g); g.connect(SND.sfx); o.start(t); o.stop(t+.6);
  });
}

// 🎵 BGM — 통통 튀는 장조 진행(C-G-Am-F)에 엇박 반짝을 얹어 발랄하게
const BGM_CHORDS=[
  {bass:130.81, notes:[523.25,659.25,783.99,659.25]},  // C
  {bass:196.00, notes:[587.33,783.99,987.77,783.99]},  // G
  {bass:220.00, notes:[523.25,659.25,880.00,659.25]},  // Am
  {bass:174.61, notes:[523.25,698.46,880.00,698.46]}   // F
];
const BGM_STEP=.20, BGM_PER_CHORD=8;

function bgmNote(freq, t, dur, vol, type){
  const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain();
  o.type=type||'triangle'; o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+.015);    // 또렷한 어택 = 통통 튀는 느낌
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(SND.bgmLP);
  o.start(t); o.stop(t+dur+.05);
}

function bgmSchedule(){
  const c=ac(); if(!c) return;
  while(SND.nextT < c.currentTime+.7){
    const ch=BGM_CHORDS[Math.floor(SND.step/BGM_PER_CHORD)%BGM_CHORDS.length];
    const i=SND.step%BGM_PER_CHORD;
    const t=SND.nextT+((i%2)?.028:0);                            // 살짝 스윙
    if(i===0) bgmNote(ch.bass,     t, .46, .17, 'sine');         // 쿵
    if(i===4) bgmNote(ch.bass*1.5, t, .36, .12, 'sine');         // 짝
    if(i%2===0) bgmNote(ch.notes[(i/2)%ch.notes.length], t, .30, .095);        // 스타카토 멜로디
    else        bgmNote(ch.notes[((i-1)/2)%ch.notes.length]*2, t, .10, .030);  // 엇박 반짝
    if(i===7 && Math.random()<.55) bgmNote(ch.notes[3]*2, t+.09, .13, .038);   // 마디 끝 장식음
    SND.nextT+=BGM_STEP; SND.step++;
  }
}

function bgmStart(){
  const c=wake(); if(!c || SND.timer) return;
  SND.step=0; SND.nextT=c.currentTime+.15;
  SND.timer=setInterval(bgmSchedule,120);
  bgmSchedule();
  SND.bgmG.gain.cancelScheduledValues(c.currentTime);
  SND.bgmG.gain.setValueAtTime(.0001,c.currentTime);
  SND.bgmG.gain.linearRampToValueAtTime(.26,c.currentTime+2.5);         // 슬며시 페이드인
}

function toggleSound(){
  SND.on=!SND.on;
  const b=document.getElementById('sndBtn');
  b.textContent=SND.on?'🔊':'🔇';
  b.classList.toggle('off',!SND.on);
  const c=audioInit();
  if(c){
    c.resume();
    SND.master.gain.cancelScheduledValues(c.currentTime);
    SND.master.gain.linearRampToValueAtTime(SND.on?1:0, c.currentTime+.18);
  }
  if(SND.on) bgmStart();
}

// 다른 탭으로 이동하면 BGM을 잠시 재우기
document.addEventListener('visibilitychange', ()=>{
  const c=ac(); if(!c) return;
  if(document.hidden){ c.suspend&&c.suspend(); }
  else if(SND.on){ c.resume&&c.resume(); }
});

// 화면 어디를 눌러도 '뽀잉' — 첫 터치에 오디오와 BGM 시작
document.addEventListener('pointerdown', e=>{
  if(!SND.started){ SND.started=true; wake(); if(SND.on) bgmStart(); }
  const el=e.target.closest('button, .opt, .node.tapable, .friend-card, .speech, .bot-hit, .dm-item');
  if(!el) return;
  if(el.closest('.demo-row')) return;          // 시연 컨트롤러는 조용히
  if(el.id==='sndBtn') return;                 // 음소거 버튼 자체는 제외
  sfxBoing();
}, true);

// Day 동그라미 롤오버 → 팅
let _hoverNode=null;
document.addEventListener('mouseover', e=>{
  const n=(e.target && e.target.closest)? e.target.closest('.node.tapable') : null;
  if(n===_hoverNode) return;
  _hoverNode=n;
  if(n && SND.started) sfxTingle();
});

// ===================================================================
// 시연용 컨트롤러: 앞부분을 자동으로 채우고 원하는 지점으로 바로 이동
// ===================================================================
function autoAnswer(d, limit){
  const qs=(DATA[d]&&DATA[d].q)||[];
  answers[d]=answers[d]||[];
  qs.forEach((it,i)=>{
    if(it.map || !it.o) return;
    if(limit!=null && i>=limit) return;
    const idx=Math.floor(Math.random()*it.o.length);
    answers[d][i]={topic:it.topic, q:it.intro, label:it.o[idx][1],
                   emoji:it.o[idx][0], kind:it.kind, idx};
    if(it.kind==='type') typeScore[TYPES[idx].key]++;
  });
}

function demoJump(target){
  restart();                                   // 상태 초기화
  const h=document.getElementById('home');
  if(target==='start'){ return; }              // 홈에서 처음부터
  h.style.display='none'; h.style.opacity='1';
  if(!friends) friends=makeFriends();

  if(target==='map5'){
    for(let d=1; d<=4; d++) autoAnswer(d);
    autoAnswer(5,1);                           // Day5 첫 질문까지 답한 상태
    day=5; qi=1; render();                     // qi=1 → 마음지도
  }
  else if(target==='map9'){
    for(let d=1; d<=8; d++) autoAnswer(d);
    autoAnswer(9,2);                           // Day9 질문 2개 답한 상태
    day=9; qi=2; render();                     // qi=2 → 마지막 마음지도
  }
  else if(target==='finish'){
    for(let d=1; d<=10; d++) autoAnswer(d);    // 10일치 랜덤 응답
    day=10; qi=DATA[10].q.length-1;
    renderResult();
  }
}

function demoToggle(show){
  document.getElementById('demoBar').classList.toggle('hide', !show);
  document.getElementById('demoOpen').classList.toggle('show', !show);
}

document.addEventListener('keydown', e=>{
  if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const map={'1':'start','2':'map5','3':'map9','4':'finish'};
  if(map[e.key]) demoJump(map[e.key]);
  if(e.key==='0') demoToggle(document.getElementById('demoBar').classList.contains('hide'));
  if(e.key==='Escape'){ closeDayModal(); closeMapOverlay(); }
});

// 초기 화면은 홈 오버레이가 담당 (render는 startFromHome에서 호출)
