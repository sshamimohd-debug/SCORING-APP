(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CricketRules=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const clone=o=>JSON.parse(JSON.stringify(o));
const BOWLER_WICKETS=new Set(['bowled','caught','lbw','stumped','hit wicket']);
const NORMAL_DISMISSALS=['bowled','caught','lbw','stumped','hit wicket','run out','obstructing the field','hit the ball twice'];
const WIDE_DISMISSALS=['hit wicket','stumped','run out','obstructing the field'];
const NO_BALL_DISMISSALS=['run out','obstructing the field','hit the ball twice'];
const PROFILES={
  ICC_LIMITED:{id:'ICC_LIMITED',name:'ICC Limited Overs',freeHit:true,bowlerLimit:true,noConsecutiveOvers:true,maxPlayers:11},
  MCC_STANDARD:{id:'MCC_STANDARD',name:'MCC Laws (general)',freeHit:false,bowlerLimit:false,noConsecutiveOvers:true,maxPlayers:11},
  CUSTOM:{id:'CUSTOM',name:'Custom Local Match',freeHit:true,bowlerLimit:false,noConsecutiveOvers:true,maxPlayers:11}
};
function profile(id){return clone(PROFILES[id]||PROFILES.ICC_LIMITED)}
function maxBowlerOvers(matchOvers,p){if(!p.bowlerLimit)return Infinity;const o=Number(matchOvers);if(o>=5&&o<10)return 2;return Math.ceil(o/5)}
function newInnings(opts){
  const {battingTeam,bowlingTeam,battingXI,bowlingXI,striker,nonStriker,bowler,overs,target=null,profileId='ICC_LIMITED',wicketLimit=null}=opts;
  if(!Array.isArray(battingXI)||battingXI.length<2) throw Error('Batting XI must contain at least 2 players');
  if(!Array.isArray(bowlingXI)||bowlingXI.length<2) throw Error('Bowling XI must contain at least 2 players');
  if(striker===nonStriker) throw Error('Opening batters must be different');
  if(!battingXI.includes(striker)||!battingXI.includes(nonStriker)) throw Error('Openers must be in batting XI');
  if(!bowlingXI.includes(bowler)) throw Error('Bowler must be in bowling XI');
  return {battingTeam,bowlingTeam,battingXI:[...battingXI],bowlingXI:[...bowlingXI],overs:Number(overs),target:target==null?null:Number(target),profileId,wicketLimit:wicketLimit==null?battingXI.length-1:Number(wicketLimit),
    striker,nonStriker,bowler,currentOverBowlers:[bowler],lastCompletedOverBowler:null,lastCompletedOverBowlers:[],needsBowler:false,pendingBatterEnd:null,dismissed:[],events:[],freeHitPending:false,completed:false,completionReason:null};
}
function legalBalls(i){return i.events.reduce((n,e)=>n+(e.kind==='delivery'&&e.legal?1:0),0)}
function oversText(n){return Math.floor(n/6)+'.'+(n%6)}
function total(i){return i.events.reduce((n,e)=>n+(e.teamRuns||0),0)}
function wickets(i){return i.events.reduce((n,e)=>n+(e.wicket&&e.wicket.counts!==false?1:0),0)}
function extras(i){const x={wide:0,noBall:0,bye:0,legBye:0,penalty:0};for(const e of i.events){if(!e.extras)continue;for(const k of Object.keys(x))x[k]+=Number(e.extras[k]||0)}return x}
function bowlerFigures(i,pid){let balls=0,runs=0,wkts=0;for(const e of i.events){if(e.kind!=='delivery'||e.bowler!==pid)continue;if(e.legal)balls++;runs+=Number(e.bowlerRuns||0);if(e.wicket&&e.wicket.counts!==false&&BOWLER_WICKETS.has(e.wicket.type))wkts++}return{balls,overs:oversText(balls),runs,wickets:wkts,econ:balls?(runs/(balls/6)).toFixed(2):'0.00'}}
function batterFigures(i,pid){let runs=0,balls=0,fours=0,sixes=0,out='not out';for(const e of i.events){if(e.kind==='delivery'&&e.striker===pid){runs+=Number(e.batRuns||0);if(e.legal)balls++;if(e.batRuns===4&&e.boundary)fours++;if(e.batRuns===6&&e.boundary)sixes++}if(e.wicket&&e.wicket.player===pid&&e.wicket.counts!==false)out=e.wicket.type}return{runs,balls,fours,sixes,sr:balls?(runs*100/balls).toFixed(1):'0.0',out}}
function allowedDismissals(ctx){if(ctx.noBall||ctx.freeHit)return [...NO_BALL_DISMISSALS];if(ctx.wide)return [...WIDE_DISMISSALS];return [...NORMAL_DISMISSALS]}
function validateWicket(ctx,w){if(!w)return;const allowed=allowedDismissals(ctx);if(!allowed.includes(w.type))throw Error(`${w.type} is not allowed on this delivery`)}
function swapEnds(i){[i.striker,i.nonStriker]=[i.nonStriker,i.striker];if(i.pendingBatterEnd==='striker')i.pendingBatterEnd='nonStriker';else if(i.pendingBatterEnd==='nonStriker')i.pendingBatterEnd='striker'}
function bowlerOversUsed(i,pid){const set=new Set(i.events.filter(e=>e.kind==='delivery'&&e.bowler===pid).map(e=>e.overIndex));return set.size}
function eligibleBowlers(i){const p=profile(i.profileId),cap=maxBowlerOvers(i.overs,p),prev=i.lastCompletedOverBowlers||[];return i.bowlingXI.map(pid=>({pid,eligible:(!p.noConsecutiveOvers||!prev.includes(pid))&&bowlerOversUsed(i,pid)<cap,figures:bowlerFigures(i,pid),quotaOvers:bowlerOversUsed(i,pid),maxOvers:Number.isFinite(cap)?cap:null}))}
function selectBowler(i,pid){if(i.completed)throw Error('Innings is complete');if(!i.needsBowler)throw Error('A new bowler is not required');const e=eligibleBowlers(i).find(x=>x.pid===pid);if(!e||!e.eligible)throw Error('Bowler is not eligible for this over');i.bowler=pid;i.currentOverBowlers=[pid];i.needsBowler=false;return i}
function replaceBowler(i,pid){if(i.completed)throw Error('Innings is complete');if(i.needsBowler)throw Error('Use next-over bowler selection');if(!i.bowlingXI.includes(pid))throw Error('Bowler is not in the playing XI');if(pid===i.bowler)throw Error('Select a different bowler');const p=profile(i.profileId),cap=maxBowlerOvers(i.overs,p),prev=i.lastCompletedOverBowlers||[];if(p.noConsecutiveOvers&&prev.includes(pid))throw Error('Replacement bowler bowled in the previous over');if(bowlerOversUsed(i,pid)>=cap)throw Error('Bowler has reached the over limit');i.bowler=pid;i.currentOverBowlers=i.currentOverBowlers||[];if(!i.currentOverBowlers.includes(pid))i.currentOverBowlers.push(pid);return i}
function availableBatters(i){return i.battingXI.filter(pid=>!i.dismissed.includes(pid)&&pid!==i.striker&&pid!==i.nonStriker)}
function selectBatter(i,pid){if(!i.pendingBatterEnd)throw Error('No new batter is required');if(!availableBatters(i).includes(pid))throw Error('Batter is not available');i[i.pendingBatterEnd]=pid;i.pendingBatterEnd=null;return i}
function checkCompletion(i){
  if(i.target!=null&&total(i)>=i.target){i.completed=true;i.completionReason='target';i.needsBowler=false;return true}
  if(wickets(i)>=i.wicketLimit){i.completed=true;i.completionReason='all out';i.needsBowler=false;i.pendingBatterEnd=null;return true}
  if(legalBalls(i)>=i.overs*6){i.completed=true;i.completionReason='overs';i.needsBowler=false;return true}
  return false;
}
function delivery(i,a){
  if(i.completed)throw Error('Innings is complete');if(i.needsBowler)throw Error('Select the next bowler');if(i.pendingBatterEnd)throw Error('Select the next batter');
  const p=profile(i.profileId),freeHit=!!i.freeHitPending;
  const noBall=!!a.noBall,wide=!!a.wide;if(noBall&&wide)throw Error('A delivery cannot be both No ball and Wide');
  const legal=!(noBall||wide||a.invalidDeadBall);
  const batRuns=Math.max(0,Number(a.batRuns||0));const byeRuns=Math.max(0,Number(a.byeRuns||0));const legByeRuns=Math.max(0,Number(a.legByeRuns||0));
  if(byeRuns&&legByeRuns)throw Error('Cannot score Byes and Leg byes together');if(wide&&(batRuns||byeRuns||legByeRuns))throw Error('Wide runs must be recorded as wides');
  const wideRuns=wide?Math.max(1,Number(a.wideRuns||1)):0;const nbPenalty=noBall?1:0;const penaltyRuns=Math.max(0,Number(a.penaltyRuns||0));
  let completedRuns=Math.max(0,Number(a.completedRuns||0));
  if(a.wicket&&['bowled','caught','lbw','stumped','hit wicket'].includes(a.wicket.type))completedRuns=0;
  validateWicket({noBall,wide,freeHit},a.wicket);
  const ev={kind:'delivery',overIndex:Math.floor(legalBalls(i)/6),striker:i.striker,nonStriker:i.nonStriker,bowler:i.bowler,legal,noBall,wide,freeHit,batRuns,byeRuns,legByeRuns,wideRuns,boundary:!!a.boundary,completedRuns,
    teamRuns:wideRuns+nbPenalty+batRuns+byeRuns+legByeRuns+penaltyRuns,bowlerRuns:wideRuns+nbPenalty+batRuns,extras:{wide:wideRuns,noBall:nbPenalty,bye:byeRuns,legBye:legByeRuns,penalty:penaltyRuns},label:a.label||labelFor({noBall,wide,batRuns,byeRuns,legByeRuns,wideRuns,freeHit}),wicket:null};
  if(a.wicket){const w=clone(a.wicket);w.counts=w.type!=='retired hurt';if(['bowled','caught','lbw','stumped','hit wicket','hit the ball twice'].includes(w.type)&&w.player!==i.striker)throw Error('This dismissal must dismiss the striker');ev.wicket=w}
  i.events.push(ev);
  if(completedRuns%2===1)swapEnds(i);
  if(ev.wicket&&ev.wicket.type==='run out'&&a.crossedOnWicket)swapEnds(i);
  if(ev.wicket&&ev.wicket.counts!==false){
    const out=ev.wicket.player;if(!i.dismissed.includes(out))i.dismissed.push(out);
    if(out===i.striker)i.pendingBatterEnd='striker';else if(out===i.nonStriker)i.pendingBatterEnd='nonStriker';else throw Error('Dismissed batter is not at the crease');
  }
  if(p.freeHit){if(noBall)i.freeHitPending=true;else if(freeHit&&!legal)i.freeHitPending=true;else if(freeHit&&legal)i.freeHitPending=false;else i.freeHitPending=false}else i.freeHitPending=false;
  const lb=legalBalls(i);const overEnded=legal&&lb>0&&lb%6===0;
  if(overEnded){const justBowled=i.bowler,oi=(lb/6)-1;swapEnds(i);i.lastCompletedOverBowler=justBowled;i.lastCompletedOverBowlers=[...new Set(i.events.filter(e=>e.kind==='delivery'&&e.overIndex===oi).map(e=>e.bowler))];i.currentOverBowlers=[];i.needsBowler=true}
  checkCompletion(i);
  return {event:ev,overEnded,inningsEnded:i.completed,freeHitNext:i.freeHitPending};
}
function labelFor(x){if(x.noBall)return 'NB'+(x.batRuns||x.byeRuns||x.legByeRuns?`+${x.batRuns||x.byeRuns||x.legByeRuns}`:'');if(x.wide)return x.wideRuns===1?'WD':`WD${x.wideRuns}`;if(x.byeRuns)return `B${x.byeRuns}`;if(x.legByeRuns)return `LB${x.legByeRuns}`;return String(x.batRuns||0)+(x.freeHit?' FH':'')}
function nonDeliveryDismissal(i,{type,player}){if(i.completed)throw Error('Innings is complete');if(!['timed out','retired out','run out'].includes(type))throw Error('Unsupported non-delivery dismissal');if(type==='timed out'){if(!availableBatters(i).includes(player))throw Error('Timed-out player must be an incoming batter')}else if(player!==i.striker&&player!==i.nonStriker)throw Error('Player is not at the crease');const e={kind:'dismissal',teamRuns:0,wicket:{type,player,counts:true}};i.events.push(e);if(!i.dismissed.includes(player))i.dismissed.push(player);if(player===i.striker)i.pendingBatterEnd='striker';else if(player===i.nonStriker)i.pendingBatterEnd='nonStriker';checkCompletion(i);return e}
function deadBall(i,reason='Dead ball – re-bowl'){if(i.completed)throw Error('Innings is complete');const e={kind:'dead',teamRuns:0,label:'DB',reason};i.events.push(e);return e}
function penalty(i,runs,reason='Penalty'){if(i.completed)throw Error('Innings is complete');const n=Math.max(1,Number(runs||5));i.events.push({kind:'penalty',teamRuns:n,extras:{wide:0,noBall:0,bye:0,legBye:0,penalty:n},label:`P${n}`,reason});checkCompletion(i)}
function result(first,second,teamName=id=>id){const a=total(first),b=total(second);if(b>a)return `${teamName(second.battingTeam)} won by ${Math.max(0,second.battingXI.length-1-wickets(second))} wicket${Math.max(0,second.battingXI.length-1-wickets(second))===1?'':'s'}`;if(a>b)return `${teamName(first.battingTeam)} won by ${a-b} run${a-b===1?'':'s'}`;return 'Match tied'}
return {PROFILES,profile,maxBowlerOvers,newInnings,legalBalls,oversText,total,wickets,extras,bowlerFigures,batterFigures,allowedDismissals,eligibleBowlers,availableBatters,bowlerOversUsed,selectBowler,replaceBowler,selectBatter,delivery,nonDeliveryDismissal,deadBall,penalty,result,clone};
});