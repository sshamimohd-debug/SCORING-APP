(()=>{'use strict';
const KEY='cricpro_v2';
const gid=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const read=()=>{try{return Object.assign({teams:[],matches:[],competitions:[],settings:{language:'English'}},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){return{teams:[],matches:[],competitions:[],settings:{language:'English'}}}};
const write=d=>localStorage.setItem(KEY,JSON.stringify(d));
const closeModal=()=>gid('modal')?.remove();
// cricpro-v2 used modal.remove() from inside a closure where `modal` is a function.
// Giving functions a safe remove method preserves the original flow without changing scoring state.
if(!Function.prototype.remove)Object.defineProperty(Function.prototype,'remove',{configurable:true,value:closeModal});
// Make form IDs reliably addressable in Android WebView, including strict-mode handlers.
function exposeIds(){document.querySelectorAll('[id]').forEach(el=>{const id=el.id;if(!id)return;try{Object.defineProperty(window,id,{configurable:true,get:()=>document.getElementById(id)})}catch(e){}})}
document.addEventListener('click',exposeIds,true);document.addEventListener('change',exposeIds,true);exposeIds();
function reloadTo(route){sessionStorage.setItem('cp_route',route);location.reload()}
// Robust team save: explicit DOM lookup, duplicate protection and persisted reload.
cp.saveTeam=()=>{const n=gid('tn'),s=gid('ts'),p=gid('tp');const name=(n?.value||'').trim();if(!name){n?.focus();return alert('Please enter team name.')}const names=(p?.value||'').split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);if(names.length<1){p?.focus();return alert('Please add at least one player.')}const d=read();if(d.teams.some(t=>String(t.name).toLowerCase()===name.toLowerCase()))return alert('A team with this name already exists.');d.teams.push({id:uid(),name,short:(s?.value||name.slice(0,3)).trim().toUpperCase().slice(0,5),players:names.map(x=>({id:uid(),name:x,role:'Player'}))});write(d);closeModal();reloadTo('teams')};
cp.addPlayer=id=>{const input=gid('newp');const name=(input?.value||'').trim();if(!name){input?.focus();return}const d=read(),t=d.teams.find(x=>x.id===id);if(!t)return alert('Team not found.');if(t.players.some(x=>String(x.name).toLowerCase()===name.toLowerCase()))return alert('Player already exists in this team.');t.players.push({id:uid(),name,role:'Player'});write(d);closeModal();reloadTo('teams')};
// Re-open the screen the user was working on after a persistence reload.
const route=sessionStorage.getItem('cp_route');if(route){sessionStorage.removeItem('cp_route');setTimeout(()=>cp.nav(route),0)}
window.addEventListener('error',e=>{console.error('CricPro error',e.error||e.message)});
})();