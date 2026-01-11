export const Icons = {
  home: () => `<svg viewBox="0 0 24 24" fill="none"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  matches: () => `<svg viewBox="0 0 24 24" fill="none"><path d="M8 4v16M16 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  stats: () => `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10m5 10V4m5 16v-7m5 7v-12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  more: () => `<svg viewBox="0 0 24 24" fill="none"><path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  back: () => `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18 9 12l6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

export function setActiveTab(id){
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const el = document.querySelector(`.tab[data-id="${id}"]`);
  if(el) el.classList.add("active");
}

export function mountTabs(active){
  const tabs = document.querySelector("#tabs");
  if(!tabs) return;
  tabs.innerHTML = `
    <a class="tab ${active==="home"?"active":""}" data-id="home" href="index.html">${Icons.home()}<div>Home</div></a>
    <a class="tab ${active==="matches"?"active":""}" data-id="matches" href="scorecard.html">${Icons.matches()}<div>Scorecard</div></a>
    <a class="tab ${active==="stats"?"active":""}" data-id="stats" href="stats.html">${Icons.stats()}<div>Stats</div></a>
    <a class="tab ${active==="more"?"active":""}" data-id="more" href="points.html">${Icons.more()}<div>More</div></a>
  `;
}

export function qs(sel, el=document){ return el.querySelector(sel); }
export function qsa(sel, el=document){ return Array.from(el.querySelectorAll(sel)); }
export function esc(s){
  return (s??"").toString().replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
