const LS_KEY = "mpgbpl_state_v1";

export function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
export function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
export function resetState(){
  localStorage.removeItem(LS_KEY);
}
