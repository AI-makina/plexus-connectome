// The Plexus Manager — vendor CRM. Customers grouped, each with their connectomes,
// live version + Effectiveness Score pulled from the running engines. Local-first
// (this machine's registry); the remote phone-home layer is a later phase.
// Client JS uses string concatenation (no nested template literals) on purpose.

export const MANAGER_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plexus Manager</title>
<style>
  :root { --ink0:#08090B; --ink1:#0E0F11; --ink2:#141518; --line:rgba(255,255,255,0.08);
    --hi:#E7E9EC; --mid:#9BA1A9; --lo:#6B7280; --ghost:#3A3F46; --azure:#5B8DEF;
    --green:#3D9A67; --amber:#D9B13D; --red:#E5484D; --mono:ui-monospace,Menlo,monospace; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ink0); color:var(--hi);
    font:14px/1.5 -apple-system,system-ui,sans-serif; min-height:100vh; }
  header { padding:22px 28px; border-bottom:1px solid var(--line); display:flex; align-items:baseline; gap:12px; }
  header h1 { font-size:17px; font-weight:600; margin:0; }
  header .tag { font:500 10px var(--mono); color:var(--lo); text-transform:uppercase; letter-spacing:.14em; }
  header .right { margin-left:auto; font-size:11px; color:var(--lo); }
  .wrap { padding:20px 28px 60px; max-width:960px; margin:0 auto; }
  .cust { margin-bottom:26px; }
  .cust-head { display:flex; align-items:baseline; gap:8px; margin-bottom:10px; }
  .cust-head .name { font-size:15px; font-weight:600; }
  .cust-name-edit { font-size:15px; font-weight:600; background:transparent; border:1px solid transparent;
    border-radius:5px; color:var(--hi); padding:2px 7px; outline:none; font-family:inherit; min-width:120px; }
  .cust-name-edit:hover { border-color:var(--line); }
  .cust-name-edit:focus { border-color:var(--azure); background:var(--ink2); }
  .bulk { padding:10px 28px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:10px; font-size:12px; color:var(--mid); }
  .bulk input { background:var(--ink2); border:1px solid var(--line); border-radius:6px; color:var(--hi); font-size:12px; padding:5px 10px; width:180px; outline:none; }
  .bulk button { background:var(--azure); border:none; border-radius:6px; color:#08090B; font-size:11px; font-weight:600; padding:6px 12px; cursor:pointer; }
  .cust-head .count { font:500 10px var(--mono); color:var(--lo); text-transform:uppercase; letter-spacing:.1em; }
  .cust.unassigned .cust-head .name { color:var(--lo); }
  .card { background:var(--ink1); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:8px; }
  .row1 { display:flex; align-items:center; gap:10px; }
  .dot { width:7px; height:7px; border-radius:50%; flex:none; }
  .cname { font-weight:600; font-size:14px; }
  .fname { font:11px var(--mono); color:var(--ghost); }
  .ver { margin-left:auto; font:11px var(--mono); color:var(--mid); display:flex; align-items:center; gap:8px; }
  .upd { color:var(--green); font-size:10px; border:1px solid rgba(61,154,103,.4); border-radius:4px; padding:1px 5px; }
  .row2 { display:flex; align-items:center; gap:18px; margin-top:11px; }
  .score { display:flex; align-items:center; gap:8px; }
  .score .num { font:600 18px var(--mono); }
  .bar { width:90px; height:5px; background:var(--ink2); border-radius:3px; overflow:hidden; }
  .bar > i { display:block; height:100%; }
  .stat { font-size:11px; color:var(--mid); } .stat b { color:var(--hi); font-weight:600; }
  .assign { margin-left:auto; }
  .assign input { background:var(--ink2); border:1px solid var(--line); border-radius:6px; color:var(--hi);
    font-size:11px; padding:4px 8px; width:150px; outline:none; }
  .assign input::placeholder { color:var(--ghost); }
  .muted { color:var(--lo); font-size:12px; }
  a.back { color:var(--azure); text-decoration:none; font-size:12px; }
</style></head>
<body>
<header>
  <h1>Plexus Manager</h1>
  <span class="tag">vendor control-plane · local</span>
  <span class="right"><a class="back" href="/">← launcher</a> &nbsp; auto-refresh 12s</span>
</header>
<div class="bulk">Put all connectomes under: <input id="bulk-name" placeholder="your name"><button onclick="assignAll()">Apply to all</button></div>
<div class="wrap" id="wrap"><div class="muted">Loading connectomes…</div></div>
<script>
function scoreColor(s){ if(s==null) return 'var(--ghost)'; if(s>=75) return 'var(--green)'; if(s>=50) return 'var(--amber)'; return 'var(--red)'; }
function esc(x){ return String(x==null?'':x).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function renderConnectome(c){
  var live = c.live || {};
  var dotCol = c.running ? 'var(--green)' : 'var(--ghost)';
  var score = live.score;
  var scoreHtml = c.running && score!=null
    ? '<div class="score"><span class="num" style="color:'+scoreColor(score)+'">'+score+'</span>'
      + '<span class="bar"><i style="width:'+score+'%;background:'+scoreColor(score)+'"></i></span>'
      + '<span class="muted">eff</span></div>'
    : '<span class="muted">'+(c.running?'no data':'offline')+'</span>';
  var stats = c.running && score!=null
    ? '<span class="stat">hallucinations caught <b>'+(live.hallucinations_caught||0)+'</b></span>'
      + '<span class="stat">divergences <b>'+(live.divergences||0)+'</b></span>'
      + (live.planned_ratio!=null ? '<span class="stat">planned <b>'+Math.round(live.planned_ratio*100)+'%</b></span>' : '')
    : '';
  var ver = c.running
    ? '<span class="ver">v'+esc(live.version||'?')+(live.update_available?'<span class="upd">update</span>':'')+'</span>'
    : '<span class="ver muted">stopped</span>';
  return '<div class="card">'
    + '<div class="row1"><span class="dot" style="background:'+dotCol+'"></span>'
    + '<span class="cname">'+esc(c.display_name)+'</span> <span class="fname">'+esc(c.name)+'</span>'
    + ver + '</div>'
    + '<div class="row2">'+scoreHtml+stats
    + '<span class="assign"><input placeholder="assign to customer…" data-path="'+esc(c.path)+'" '
    + 'onchange="assign(this)"></span></div>'
    + '</div>';
}

function assign(inp){
  var owner = inp.value.trim(); var path = inp.getAttribute('data-path');
  fetch('/api/launcher/owner', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({path:path, owner:owner})})
    .then(function(){ load(); });
}

function renameOwner(inp){
  var from = inp.getAttribute('data-from'); var to = inp.value.trim();
  if(!to || to===from){ load(); return; }
  fetch('/api/launcher/rename-owner', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({from:from, to:to})})
    .then(function(){ load(); });
}

function assignAll(){
  var owner = (document.getElementById('bulk-name').value||'').trim();
  if(!owner) return;
  fetch('/api/launcher/assign-all', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({owner:owner})})
    .then(function(){ document.getElementById('bulk-name').value=''; load(); });
}

function load(){
  fetch('/api/launcher/manager').then(function(r){return r.json();}).then(function(d){
    var cust = d.customers || {};
    var owners = Object.keys(cust).sort(function(a,b){ if(a==='Unassigned')return 1; if(b==='Unassigned')return -1; return a.localeCompare(b); });
    if(owners.length===0){ document.getElementById('wrap').innerHTML='<div class="muted">No connectomes registered yet.</div>'; return; }
    var html='';
    owners.forEach(function(owner){
      var list = cust[owner];
      html += '<div class="cust'+(owner==='Unassigned'?' unassigned':'')+'">'
        + '<div class="cust-head"><input class="cust-name-edit" value="'+esc(owner)+'" data-from="'+esc(owner)+'" onchange="renameOwner(this)" title="rename this customer (moves all their connectomes)">'
        + '<span class="count">'+list.length+' connectome'+(list.length>1?'s':'')+'</span></div>'
        + list.map(renderConnectome).join('') + '</div>';
    });
    document.getElementById('wrap').innerHTML = html;
  }).catch(function(){ document.getElementById('wrap').innerHTML='<div class="muted">Launcher unreachable.</div>'; });
}
load(); setInterval(load, 12000);
</script>
</body></html>`;
