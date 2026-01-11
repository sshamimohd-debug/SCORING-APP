import { newMatchDemo, applyBall, rr, rrr, overStr, calcNeedLine, extrasLine } from "./rules-engine.js";
import { loadState, saveState, resetState } from "./storage.js";
import { mountTabs, qs, esc, Icons } from "./ui.js";
import { RT } from "./firebase.js";

const page = document.body.dataset.page || "home";

function ensureState(){
  let st = loadState();
  if(!st){
    st = newMatchDemo();
    // demo state tweaks to match screenshot feel
    const inn = st.innings[1];
    inn.runs = 145; inn.wkts = 4; inn.balls = 105; // 17.3
    inn.bats["p_s_sharma"] = {r:42,b:28,f4:5,f6:1,howOut:null};
    inn.bats["p_r_verma"] = {r:18,b:14,f4:2,f6:0,howOut:null};
    inn.bowl["p_a_khan"] = {balls:21,r:32,w:2,wd:1,nb:0}; // 3.3 overs
    // 1st innings for scorecard demo
    const i0 = st.innings[0];
    i0.runs = 161; i0.wkts = 8; i0.balls = 120;
    i0.bats["p_r_patel"] = {r:55,b:38,f4:6,f6:2,howOut:"Caught"};
    i0.bats["p_v_yadav"] = {r:34,b:25,f4:3,f6:1,howOut:"Bowled"};
    i0.bats["p_r_singh"] = {r:22,b:18,f4:1,f6:1,howOut:"LBW"};
    i0.wides = 6; i0.noballs = 2; i0.byes = 2; i0.legbyes = 2;
    i0.bowl["p_m_tiwari"] = {balls:24,r:27,w:2,wd:2,nb:0};
    i0.bowl["p_a_khan"] = {balls:24,r:32,w:3,wd:1,nb:0};
    saveState(st);
  }
  return st;
}

let state = ensureState();

function bindCommonTopbar(){
  const left = qs("#navLeft");
  const right = qs("#navRight");
  if(left){
    left.innerHTML = `<span class="iconbtn">${Icons.back()}</span>`;
    left.addEventListener("click", (e)=>{
      e.preventDefault();
      history.length>1 ? history.back() : (location.href="index.html");
    });
  }
  if(right){
    right.innerHTML = `<a class="iconbtn" href="settings.html" aria-label="Settings">⚙️</a>`;
  }
}

function setBrand(){
  const el = qs("#brandTitle");
  if(el) el.textContent = state.meta.tournament;
}

async function initRealtime(){
  // local-only for now; keep hooks for firebase
  RT.ready = false;
  RT.mode = "local";
  RT.onUpdate = (st)=>{
    state = st;
    saveState(state);
    render();
  };
  RT.pushState = async (st)=>{
    saveState(st);
  };
}

function renderHome(){
  mountTabs("home");
  const m = state.meta;
  const inn = state.innings[state.live.inningsIndex];

  qs("#teams").innerHTML = `
    <div class="vs">
      <div class="team">${esc(m.a)}</div>
      <div class="mid">VS</div>
      <div class="team">${esc(m.b)}</div>
    </div>
  `;

  qs("#score").innerHTML = `
    <div class="scoreBig">
      ${inn.runs}/${inn.wkts} <small>(${overStr(inn.balls)})</small>
    </div>
    <div class="subline">${esc(calcNeedLine(state))}</div>
  `;

  const rrNow = rr(inn.runs, inn.balls);
  const target = state.innings[0].runs + 1;
  const rrrNow = rrr(target, inn.runs, inn.balls, m.oversLimit);
  qs("#rates").innerHTML = `
    <div class="pills">
      <div class="pill">RR <b style="color:var(--gold)">${rrNow.toFixed(2)}</b></div>
      <div class="pill">RRR <b style="color:var(--gold)">${(isFinite(rrrNow)?rrrNow:0).toFixed(2)}</b></div>
      <div class="pill">${state.live.freeHit ? "FREE HIT" : " "}</div>
    </div>
  `;

  // progress: chase completion %
  const pct = Math.min(1, inn.runs / (target||1));
  qs("#progress").style.transform = `scaleX(${Math.max(.06, pct)})`;
  qs("#progressText").innerHTML = `
    <div>Chase</div>
    <div>${inn.runs} / ${target}</div>
  `;

  const sBat = inn.bats[state.live.strikerId] || {r:0,b:0};
  const nBat = inn.bats[state.live.nonStrikerId] || {r:0,b:0};
  const bowl = inn.bowl[state.live.bowlerId] || {balls:0,r:0,w:0};

  qs("#lines").innerHTML = `
    <div class="playerLine">
      <div><strong>${esc(state.players[state.live.strikerId]?.name||"Striker")}</strong> <span>${sBat.r} (${sBat.b})</span></div>
      <span class="badge">★</span>
    </div>
    <div style="height:10px"></div>
    <div class="playerLine">
      <div><strong>${esc(state.players[state.live.nonStrikerId]?.name||"Non-striker")}</strong> <span>${nBat.r} (${nBat.b})</span></div>
      <span class="badge"> </span>
    </div>
    <div style="height:10px"></div>
    <div class="playerLine">
      <div><strong>${esc(state.players[state.live.bowlerId]?.name||"Bowler")}</strong> <span>${fmtOvers(bowl.balls)}-${bowl.r}-${bowl.w}</span></div>
      <span class="badge">BOWL</span>
    </div>
  `;

  qs("#notice").style.display = RT.ready ? "none" : "block";

  // buttons
  const btnMap = [
    {id:"b0", t:"0", ev:{kind:"RUNS", runs:0}},
    {id:"b1", t:"1", ev:{kind:"RUNS", runs:1}},
    {id:"b2", t:"2", ev:{kind:"RUNS", runs:2}},
    {id:"b4", t:"4", ev:{kind:"RUNS", runs:4}},
    {id:"b6", t:"6", ev:{kind:"RUNS", runs:6}},
    {id:"bw", t:"W", ev:{kind:"WICKET", wicketType:"Wicket"}},
  ];
  btnMap.forEach(x=>{
    const el = qs(`#${x.id}`);
    if(!el) return;
    el.textContent = x.t;
    el.onclick = ()=> onBall(x.ev);
  });
  qs("#bnb").onclick = ()=> onBall({kind:"NOBALL", runs:0});
  qs("#bwd").onclick = ()=> onBall({kind:"WIDE", runs:0});
  qs("#lastBall").textContent = state.live.lastBall ? `Last: ${state.live.lastBall}` : "";
}

function fmtOvers(balls){ return `${Math.floor(balls/6)}.${balls%6}`; }

function onBall(ev){
  state = applyBall(state, ev);
  saveState(state);
  RT.pushState(state);

  // if wicket, prompt to set next batter quickly
  if(state.live.pendingNewBatter){
    state.live.pendingNewBatter = false;
    const name = prompt("Next batter name (e.g., A. Mishra):");
    if(name && name.trim()){
      const id = "p_"+name.toLowerCase().replace(/[^a-z0-9]+/g,"_");
      state.players[id] = {id, name: name.trim(), team: state.innings[state.live.inningsIndex].battingTeam};
      state.live.strikerId = id;
      // ensure batter exists
    }
    saveState(state);
  }
  render();
}

function renderScorecard(){
  mountTabs("matches");
  const i0 = state.innings[0];
  const ex0 = extrasLine(i0);
  qs("#scTitle").textContent = "FULL SCORECARD";

  qs("#innTitle").textContent = `${i0.battingTeam} Innings`;
  const bats = Object.entries(i0.bats).map(([pid,st])=>{
    const nm = state.players[pid]?.name || pid;
    const sr = st.b ? ((st.r*100)/st.b).toFixed(1) : "0.0";
    return `<tr><td>${esc(nm)}</td><td class="right">${st.r}</td><td class="right">${st.b}</td><td class="right">${sr}</td></tr>`;
  }).join("");
  qs("#batTable").innerHTML = `
    <table class="table">
      <thead><tr><th>Batter</th><th class="right">R</th><th class="right">B</th><th class="right">SR</th></tr></thead>
      <tbody>${bats || `<tr><td colspan="4" class="muted">No data</td></tr>`}</tbody>
    </table>
  `;

  qs("#extras").innerHTML = `
    <div class="row"><div class="h2">Extras</div><div class="h1">${ex0.total}</div></div>
    <div class="row muted" style="margin-top:6px;font-weight:800">
      <div>WD ${ex0.parts.wd} • NB ${ex0.parts.nb} • B ${ex0.parts.b} • LB ${ex0.parts.lb}</div>
    </div>
  `;

  qs("#total").innerHTML = `
    <div class="row"><div class="h2">Total</div>
      <div class="h1">${i0.runs} / ${i0.wkts} <span class="muted" style="font-size:12px;font-weight:800">(${overStr(i0.balls)} overs)</span></div>
    </div>
  `;

  const bowls = Object.entries(i0.bowl).map(([pid,st])=>{
    const nm = state.players[pid]?.name || pid;
    return `<tr><td>${esc(nm)}</td><td class="right">${fmtOvers(st.balls)}</td><td class="right">${st.r}</td><td class="right">${st.w}</td></tr>`;
  }).join("");
  qs("#bowlTable").innerHTML = `
    <div class="h2" style="margin:10px 0 8px">Bowling</div>
    <table class="table">
      <thead><tr><th>Bowler</th><th class="right">O</th><th class="right">R</th><th class="right">W</th></tr></thead>
      <tbody>${bowls || `<tr><td colspan="4" class="muted">No data</td></tr>`}</tbody>
    </table>
  `;
}

function renderStats(){
  mountTabs("stats");
  // compute simple season stats from innings totals + bats tables (demo)
  const runAgg = new Map();
  const sixAgg = new Map();
  const fourAgg = new Map();
  const wktAgg = new Map();

  state.innings.forEach(inn=>{
    for(const [pid,st] of Object.entries(inn.bats)){
      runAgg.set(pid, (runAgg.get(pid)||0) + (st.r||0));
      fourAgg.set(pid, (fourAgg.get(pid)||0) + (st.f4||0));
      sixAgg.set(pid, (sixAgg.get(pid)||0) + (st.f6||0));
    }
    for(const [pid,st] of Object.entries(inn.bowl)){
      wktAgg.set(pid, (wktAgg.get(pid)||0) + (st.w||0));
    }
  });

  const topRuns = topN(runAgg, 3);
  const top4 = topN(fourAgg, 1);
  const top6 = topN(sixAgg, 1);
  const topW = topN(wktAgg, 1);

  qs("#kpis").innerHTML = `
    <div class="kpiRow">
      ${kpi("Most Sixes", top6[0], (top6[0]?.v ?? 0))}
      ${kpi("Most Fours", top4[0], (top4[0]?.v ?? 0))}
      ${kpi("Most Wickets", topW[0], (topW[0]?.v ?? 0))}
      ${kpi("Most of the Match", {name:"Vijay Yadav"}, "")}
    </div>
  `;

  const max = topRuns[0]?.v || 1;
  qs("#topBats").innerHTML = topRuns.map((x,i)=>{
    const nm = x.name;
    const pct = Math.max(6, Math.round((x.v/max)*100));
    return `
      <div class="listItem">
        <div class="avatar">${nm.split(" ").map(w=>w[0]).slice(0,2).join("")}</div>
        <div class="meta">
          <div class="name">${esc(nm)}</div>
          <div class="sub">${x.v} Runs</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="badge">›</div>
      </div>
      <div style="height:10px"></div>
    `;
  }).join("");
}

function kpi(label, top, val){
  const name = top?.name || "—";
  return `
    <div class="kpi">
      <img src="assets/icons/trophy.svg" alt="trophy"/>
      <div class="k">${esc(label)}</div>
      <div class="v">${esc(name)}</div>
      <div class="v" style="color:var(--gold)">${esc(String(val))}</div>
    </div>
  `;
}

function topN(map, n){
  const arr = Array.from(map.entries()).map(([pid,v])=>({pid,v, name: state.players[pid]?.name || pid}));
  arr.sort((a,b)=>b.v-a.v);
  return arr.slice(0,n);
}

function renderPoints(){
  mountTabs("more");
  const teams = state.points.teams;
  const rows = teams.map(t=>{
    const r = state.points.table[t];
    return `<tr>
      <td><span class="badge">${esc(t)}</span></td>
      <td class="right">${r.P}</td>
      <td class="right">${r.W}</td>
      <td class="right">${r.L}</td>
      <td class="right">${(r.NRR>=0?"+":"")}${r.NRR.toFixed(2)}</td>
    </tr>`;
  }).join("");
  qs("#pointsTable").innerHTML = `
    <table class="table">
      <thead><tr><th>Team</th><th class="right">P</th><th class="right">W</th><th class="right">L</th><th class="right">NRR</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  qs("#tips").innerHTML = `
    <div class="notice">
      <div style="font-weight:900;color:var(--text);margin-bottom:6px">Admin Tips</div>
      <div>• Live scoring works offline. Firebase optional for realtime multi-user.</div>
      <div>• Reset demo anytime in <code class="kbd">Settings</code>.</div>
    </div>
  `;
}

function renderSettings(){
  mountTabs("more");
  qs("#reset").onclick = ()=>{
    if(confirm("Reset to demo data?")){
      resetState();
      location.href="index.html";
    }
  };
  const inn = state.innings[state.live.inningsIndex];
  qs("#info").innerHTML = `
    <div class="notice">
      <div style="font-weight:900;color:var(--text);margin-bottom:6px">Mode</div>
      <div>Realtime: <b>${RT.ready ? "ON" : "OFF"}</b> (${RT.mode})</div>
      <div style="margin-top:8px">Current: <b>${inn.battingTeam}</b> ${inn.runs}/${inn.wkts} (${overStr(inn.balls)})</div>
    </div>
  `;
}

function render(){
  setBrand();
  bindCommonTopbar();

  if(page==="home") renderHome();
  else if(page==="scorecard") renderScorecard();
  else if(page==="stats") renderStats();
  else if(page==="points") renderPoints();
  else if(page==="settings") renderSettings();
}

(async function main(){
  await initRealtime();
  // PWA
  if("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("sw.js"); }catch{}
  }
  render();
})();
