from pathlib import Path
import re

p = Path('js/cricpro-v3.js')
s = p.read_text(encoding='utf-8')

# 1) Boot safety: clone must exist before load() executes.
old = "let db=load(), page='home', active=null;\nconst $=id=>document.getElementById(id);\nconst uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);\nconst clone=o=>JSON.parse(JSON.stringify(o));"
new = "const clone=o=>JSON.parse(JSON.stringify(o));\nlet db=load(), page='home', active=null;\nconst $=id=>document.getElementById(id);\nconst uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);"
if old in s:
    s = s.replace(old, new, 1)

# 2) Snapshot-based Undo restores runs, strike, wickets, innings transitions and results.
if 'function pushUndo(m)' not in s:
    marker = "function team(id){return db.teams.find(t=>t.id===id)} function match(id){return db.matches.find(m=>m.id===id)}\n"
    assert marker in s, 'team/match marker missing'
    s = s.replace(marker, marker + "function pushUndo(m){m.undoStack=m.undoStack||[];m.undoStack.push({currentInnings:m.currentInnings,status:m.status,result:m.result||null,innings:clone(m.innings)});if(m.undoStack.length>100)m.undoStack.shift()}\n", 1)

if "currentInnings:0,undoStack:[]" not in s:
    s = s.replace("status:'setup',created:Date.now(),innings:[],currentInnings:0}", "status:'setup',created:Date.now(),innings:[],currentInnings:0,undoStack:[]}", 1)

old_add = "function addBall(kind,val=0){const m=match(active),i=m?.innings[m.currentInnings];if(!m||!i||i.completed)return;let b="
if old_add in s:
    s = s.replace(old_add, "function addBall(kind,val=0){const m=match(active),i=m?.innings[m.currentInnings];if(!m||!i||i.completed)return;pushUndo(m);let b=", 1)

old_w = "function confirmWicket(){const m=match(active),i=m.innings[m.currentInnings],wt=$('wt'),wp=$('wp');if(!wt||!wp)return;const out="
if old_w in s:
    s = s.replace(old_w, "function confirmWicket(){const m=match(active),i=m.innings[m.currentInnings],wt=$('wt'),wp=$('wp');if(!wt||!wp)return;pushUndo(m);const out=", 1)

if "Last scoring action undone" not in s:
    s = re.sub(
        r"function undo\(\)\{.*?\}\nfunction swap\(\)",
        "function undo(){const m=match(active);if(!m)return;const st=(m.undoStack||[]).pop();if(!st)return toast('Nothing to undo');m.currentInnings=st.currentInnings;m.status=st.status;m.innings=clone(st.innings);if(st.result)m.result=st.result;else delete m.result;persist();render();toast('Last scoring action undone')}\nfunction swap()",
        s, count=1, flags=re.S
    )

old_end = "endInnings:()=>{const m=match(active);if(m){finishInnings(m);render()}}"
if old_end in s:
    s = s.replace(old_end, "endInnings:()=>{const m=match(active);if(m){pushUndo(m);finishInnings(m);render()}}", 1)

# 3) Native Android Back closes modal / score / section before exiting app.
if 'window.CricProBack=' not in s:
    marker = "window.CricProQA={selfTest};\nrender();"
    assert marker in s, 'QA/render marker missing'
    s = s.replace(marker, "window.CricProQA={selfTest};\nwindow.CricProBack=()=>{if($('modalback')){closeModal();return true}if(page==='score'){page='matches';active=null;render();return true}if(page!=='home'){page='home';active=null;render();return true}return false};\nrender();", 1)

p.write_text(s, encoding='utf-8')
print('CricPro runtime hardening applied')
