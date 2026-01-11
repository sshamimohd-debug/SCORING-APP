// Cricket scoring rules engine (limited overs).
// Supports: runs, wicket, wide, no-ball (+free hit), byes/legbyes basic, strike rotation.
// This is designed to be deterministic and easy to extend.

export function newMatchDemo(){
  return {
    meta:{
      tournament:"MPGB Premier League",
      matchId:"m1",
      oversLimit:20,
      a:"Indore",
      b:"Dewas",
      venue:"MPGB Stadium",
      startIso: new Date().toISOString()
    },
    innings:[
      newInnings("Indore"),
      newInnings("Dewas")
    ],
    live:{
      inningsIndex:1, // 0 first innings, 1 chase by default for demo
      strikerId:"p_s_sharma",
      nonStrikerId:"p_r_verma",
      bowlerId:"p_a_khan",
      lastBall:""
    },
    players:{
      // minimal demo player registry (extend as needed)
      "p_s_sharma": {id:"p_s_sharma", name:"S. Sharma", team:"Indore"},
      "p_r_verma":  {id:"p_r_verma",  name:"R. Verma", team:"Indore"},
      "p_a_khan":   {id:"p_a_khan",   name:"A. Khan", team:"Dewas"},
      "p_r_patel":  {id:"p_r_patel",  name:"R. Patel", team:"Indore"},
      "p_v_yadav":  {id:"p_v_yadav",  name:"V. Yadav", team:"Indore"},
      "p_r_singh":  {id:"p_r_singh",  name:"R. Singh", team:"Indore"},
      "p_m_tiwari": {id:"p_m_tiwari", name:"M. Tiwari", team:"Dewas"}
    },
    points:{
      teams:["Indore","Dewas","Ujjain","Gwalior"],
      table:{
        "Indore": {P:5,W:4,L:1,NR:0,PTS:8,NRR:0.85},
        "Dewas":  {P:5,W:3,L:2,NR:0,PTS:6,NRR:0.30},
        "Ujjain": {P:5,W:2,L:3,NR:0,PTS:4,NRR:-0.45},
        "Gwalior":{P:5,W:1,L:4,NR:0,PTS:2,NRR:-0.70},
      }
    },
    history:[]
  };
}

function newInnings(battingTeam){
  return {
    battingTeam,
    runs:0,
    wkts:0,
    balls:0,       // legal balls only
    wides:0,
    noballs:0,
    byes:0,
    legbyes:0,
    penalty:0,
    target:null,
    bats:{}, // playerId -> {r,b,4,6,howOut,null}
    bowl:{}, // playerId -> {balls,r,w,wd,nb}
    fall:[], // {score, over, batter}
    ballsLog:[] // {type, runs, extra, legal, wicket, striker, nonStriker, bowler, overStr}
  };
}

export function overStr(balls){
  const o = Math.floor(balls/6);
  const b = balls%6;
  return `${o}.${b}`;
}

export function rr(runs, balls){
  if(balls<=0) return 0;
  return (runs*6)/balls;
}

export function rrr(target, runs, balls, oversLimit){
  const totalBalls = oversLimit*6;
  const remaining = Math.max(0, totalBalls - balls);
  const need = Math.max(0, target - runs);
  if(remaining<=0) return need>0 ? Infinity : 0;
  return (need*6)/remaining;
}

export function applyBall(state, ev){
  // ev: {kind:"RUNS"|"WICKET"|"WIDE"|"NOBALL"|"BYE"|"LEGBYE", runs:number, wicketType?:string}
  const s = structuredClone(state);
  const inn = s.innings[s.live.inningsIndex];
  const striker = s.players[s.live.strikerId];
  const non = s.players[s.live.nonStrikerId];
  const bowler = s.players[s.live.bowlerId];

  ensureBatter(inn, s.live.strikerId);
  ensureBatter(inn, s.live.nonStrikerId);
  ensureBowler(inn, s.live.bowlerId);

  const bstat = inn.bats[s.live.strikerId];
  const bowl = inn.bowl[s.live.bowlerId];

  let legal = true;
  let addRuns = 0;
  let extra = 0;
  let wicket = false;

  if(ev.kind==="RUNS"){
    addRuns = ev.runs;
    bstat.r += ev.runs;
    bstat.b += 1;
    if(ev.runs===4) bstat.f4 += 1;
    if(ev.runs===6) bstat.f6 += 1;
  }else if(ev.kind==="WICKET"){
    wicket = true;
    addRuns = 0;
    bstat.b += 1;
    bstat.howOut = ev.wicketType || "Wicket";
    inn.wkts += 1;
    inn.fall.push({score: inn.runs, over: overStr(inn.balls+1), batter: striker.name});
  }else if(ev.kind==="WIDE"){
    legal = false;
    extra = 1 + (ev.runs||0);
    addRuns = extra;
    inn.wides += extra;
    bowl.wd += extra;
    bowl.r += extra;
  }else if(ev.kind==="NOBALL"){
    legal = false;
    extra = 1 + (ev.runs||0);
    addRuns = extra;
    inn.noballs += 1;
    bowl.nb += 1;
    bowl.r += extra;
    // free hit is tracked on liveState
    s.live.freeHit = true;
  }else if(ev.kind==="BYE"){
    addRuns = ev.runs;
    extra = ev.runs;
    inn.byes += ev.runs;
    bstat.b += 1;
  }else if(ev.kind==="LEGBYE"){
    addRuns = ev.runs;
    extra = ev.runs;
    inn.legbyes += ev.runs;
    bstat.b += 1;
  }

  // update totals
  inn.runs += addRuns;
  bowl.r += (ev.kind==="RUNS"||ev.kind==="WICKET"||ev.kind==="BYE"||ev.kind==="LEGBYE") ? addRuns : 0;
  if(legal){
    inn.balls += 1;
    bowl.balls += 1;
  }
  if(wicket){
    // wicket credit to bowler for most types except run-out etc; keep simple:
    bowl.w += 1;
    // after wicket, swap striker to placeholder "Next Batter" if not configured
    s.live.pendingNewBatter = true;
  }

  // strike rotation: for legal deliveries (including wicket ball) where runs are odd (bats or byes/legbyes)
  const rotate = legal && ( (ev.kind==="RUNS"||ev.kind==="BYE"||ev.kind==="LEGBYE") ? (ev.runs%2===1) : false );
  if(rotate){
    const tmp = s.live.strikerId;
    s.live.strikerId = s.live.nonStrikerId;
    s.live.nonStrikerId = tmp;
  }

  // over-end strike change (after legal ball completes over)
  if(legal && inn.balls % 6 === 0){
    const tmp = s.live.strikerId;
    s.live.strikerId = s.live.nonStrikerId;
    s.live.nonStrikerId = tmp;
  }

  // free hit consumed on next legal ball
  if(s.live.freeHit && legal){
    s.live.freeHit = false;
  }

  // log ball
  const label = ballLabel(ev);
  s.live.lastBall = label;
  inn.ballsLog.push({
    ts: Date.now(),
    label,
    kind: ev.kind,
    runs: ev.runs||0,
    extra,
    legal,
    wicket,
    striker: striker.name,
    nonStriker: non.name,
    bowler: bowler.name,
    overStr: overStr(inn.balls)
  });
  s.history.push({ts:Date.now(), label});

  return s;
}

function ballLabel(ev){
  if(ev.kind==="RUNS") return String(ev.runs);
  if(ev.kind==="WICKET") return "W";
  if(ev.kind==="WIDE") return "WD";
  if(ev.kind==="NOBALL") return "NB";
  if(ev.kind==="BYE") return `B${ev.runs}`;
  if(ev.kind==="LEGBYE") return `LB${ev.runs}`;
  return "?";
}

function ensureBatter(inn, pid){
  if(!inn.bats[pid]){
    inn.bats[pid] = {r:0,b:0,f4:0,f6:0,howOut:null};
  }
}
function ensureBowler(inn, pid){
  if(!inn.bowl[pid]){
    inn.bowl[pid] = {balls:0,r:0,w:0,wd:0,nb:0};
  }
}

export function calcNeedLine(state){
  const m = state.meta;
  const inn = state.innings[state.live.inningsIndex];
  const first = state.innings[0];
  let target = inn.target;
  if(target==null){
    // if chasing innings, set target from first innings if finished
    target = (state.live.inningsIndex===1) ? (first.runs + 1) : null;
  }
  if(target==null) return "";
  const ballsLeft = m.oversLimit*6 - inn.balls;
  const need = Math.max(0, target - inn.runs);
  return `Target: ${target} | Need ${need} from ${ballsLeft} balls`;
}

export function extrasLine(inn){
  const total = inn.wides + inn.noballs + inn.byes + inn.legbyes + inn.penalty;
  return {total, parts:{wd:inn.wides, nb:inn.noballs, b:inn.byes, lb:inn.legbyes, p:inn.penalty}};
}
