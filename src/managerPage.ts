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
  .upd-btn { color:#08090B; background:var(--green); border:none; font:600 10px var(--mono); border-radius:4px; padding:3px 9px; cursor:pointer; margin-left:2px; }
  .upd-btn:disabled { opacity:.55; cursor:default; }
  .start-btn { color:var(--hi); background:var(--ink2); border:1px solid var(--line); font:600 10px var(--mono); border-radius:4px; padding:3px 9px; cursor:pointer; }
  .start-btn:disabled { opacity:.55; cursor:default; }
  .uptodate { color:var(--lo); font:10px var(--mono); }
  .st-sent { color:var(--amber); font:600 10px var(--mono); }
  .st-pushed { color:var(--lo); font:600 10px var(--mono); }
  .st-updated { color:var(--green); font:600 10px var(--mono); }
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
  /* ── Fleet aggregate panel (vendor rollup across all connectomes) ── */
  .fleet { background:var(--ink1); border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin-bottom:22px; }
  .fleet h2 { font-size:12px; font-weight:600; margin:0 0 12px; color:var(--mid); text-transform:uppercase; letter-spacing:.12em; display:flex; align-items:baseline; gap:8px; }
  .fleet h2 .sub { font:400 10px var(--mono); color:var(--lo); letter-spacing:0; text-transform:none; }
  .tiles { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
  .tile { background:var(--ink2); border:1px solid var(--line); border-radius:9px; padding:9px 13px; min-width:96px; }
  .tile .k { font-size:10px; color:var(--lo); text-transform:uppercase; letter-spacing:.08em; }
  .tile .v { font:600 20px var(--mono); margin-top:2px; }
  .block { margin-top:12px; } .block .h { font:600 10px var(--mono); color:var(--lo); text-transform:uppercase; letter-spacing:.1em; margin-bottom:6px; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { background:var(--ink2); border:1px solid var(--line); border-radius:20px; padding:3px 10px; font-size:11px; color:var(--mid); }
  .chip b { color:var(--hi); font-weight:600; } .chip.ai b{color:var(--azure);} .chip.harness b{color:var(--amber);} .chip.structure b{color:#B07BD6;} .chip.value b{color:var(--green);}
  .mtable { width:100%; border-collapse:collapse; font-size:11px; }
  .mtable th { text-align:left; color:var(--lo); font:500 10px var(--mono); text-transform:uppercase; letter-spacing:.06em; padding:3px 8px 5px 0; border-bottom:1px solid var(--line); }
  .mtable td { padding:4px 8px 4px 0; color:var(--mid); border-bottom:1px solid var(--line); } .mtable td b{color:var(--hi);}
  .mtable td .rate { font:11px var(--mono); }
  .fb { border-left:2px solid var(--line); padding:2px 0 2px 10px; margin:7px 0; }
  .fb .q { font-size:11px; color:var(--lo); } .fb .a { font-size:12px; color:var(--hi); margin-top:1px; }
  .fb .m { font:10px var(--mono); color:var(--ghost); margin-top:2px; }
  /* ── Per-card drill-down ── */
  .expand { cursor:pointer; user-select:none; color:var(--lo); font:11px var(--mono); margin-left:8px; }
  .expand:hover { color:var(--hi); }
  .card.open { border-color:rgba(91,141,239,.35); }
  .detail { margin-top:13px; padding-top:13px; border-top:1px solid var(--line); display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .detail .col .h { font:600 10px var(--mono); color:var(--lo); text-transform:uppercase; letter-spacing:.1em; margin-bottom:6px; }
  .ded { display:flex; justify-content:space-between; font-size:11px; padding:2px 0; color:var(--mid); } .ded b{color:var(--red);font-weight:600;font-family:var(--mono);}
  .spark { display:flex; align-items:flex-end; gap:2px; height:34px; }
  .spark i { display:block; width:6px; background:var(--azure); border-radius:1px; opacity:.7; min-height:1px; }
  .spark-lbl { font:10px var(--mono); color:var(--ghost); margin-top:3px; }
  @media(max-width:640px){ .detail{grid-template-columns:1fr;} }
</style></head>
<body>
<header>
  <h1>Plexus Manager</h1>
  <span class="tag">vendor control-plane · local</span>
  <span class="right"><a class="back" href="/">← launcher</a> &nbsp; auto-refresh 12s</span>
</header>
<div class="bulk"><div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px"><button onclick="updateAll()">Send update to all outdated</button><span style="font-size:10px;color:var(--lo)">pushing&nbsp;v<span id="latest-ver">…</span></span></div></div>
<div class="wrap"><div id="fleet"></div><div id="wrap"><div class="muted">Loading connectomes…</div></div></div>
<script>
function scoreColor(s){ if(s==null) return 'var(--ghost)'; if(s>=75) return 'var(--green)'; if(s>=50) return 'var(--amber)'; return 'var(--red)'; }
function esc(x){ return String(x==null?'':x).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function num(n){ return (n==null?0:n).toLocaleString(); }
function pct(x){ return x==null?'—':(Math.round(x*1000)/10)+'%'; }
function tile(k,v,col){ return '<div class="tile"><div class="k">'+esc(k)+'</div><div class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</div></div>'; }

function chipsFrom(obj, useClass){
  var keys = Object.keys(obj||{});
  if(!keys.length) return '<span class="muted">none yet</span>';
  keys.sort(function(a,b){ return (obj[b]||0)-(obj[a]||0); });
  return '<div class="chips">' + keys.map(function(k){
    return '<span class="chip '+(useClass?esc(k):'')+'">'+esc(k)+' <b>'+num(obj[k])+'</b></span>';
  }).join('') + '</div>';
}

// Per-model hallucination trend — which model is inventing symbols / going out of scope.
function modelTable(bm){
  var models = Object.keys(bm||{});
  if(!models.length) return '<span class="muted">no model activity yet</span>';
  models.sort(function(a,b){ return (bm[b].events||0)-(bm[a].events||0); });
  var rows = models.map(function(m){
    var v = bm[m]; var ev = v.events||0;
    var hr = ev? (v.claim_missing/ev) : 0;
    var oos = ev? (v.claim_out_of_scope/ev) : 0;
    var hrCol = hr>=0.1?'var(--red)':hr>=0.03?'var(--amber)':'var(--green)';
    return '<tr><td><b>'+esc(m)+'</b></td><td>'+num(ev)+'</td>'
      + '<td><span class="rate" style="color:'+hrCol+'">'+pct(hr)+'</span></td>'
      + '<td class="rate">'+pct(oos)+'</td></tr>';
  }).join('');
  return '<table class="mtable"><thead><tr><th>model</th><th>events</th><th>halluc</th><th>out&#8209;of&#8209;scope</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function feedbackList(arr, withConn){
  if(!arr || !arr.length) return '<span class="muted">no questionnaire answers yet</span>';
  return arr.map(function(r){
    var meta = esc(r.model||'?') + (withConn && r.connectome? ' · '+esc(r.connectome):'') + (r.theme? ' · '+esc(r.theme):'');
    return '<div class="fb"><div class="q">'+esc(r.question||'')+'</div><div class="a">'+esc(r.answer||'')+'</div><div class="m">'+meta+'</div></div>';
  }).join('');
}

// ── Fleet aggregate: the vendor-level rollup across every running connectome ──
function renderFleet(agg){
  var el = document.getElementById('fleet'); if(!el) return;
  if(!agg || !agg.running){ el.innerHTML=''; return; }
  var s = agg.avg_score;
  var tiles = tile('avg eff', s==null?'—':s, scoreColor(s))
    + tile('checks', num(agg.checks))
    + tile('hallucinations caught', num(agg.hallucinations_caught), agg.hallucinations_caught? 'var(--green)':null)
    + tile('coverage gaps', num(agg.coverage_gaps), agg.coverage_gaps?'var(--amber)':null)
    + tile('divergences', num(agg.divergences), agg.divergences?'var(--red)':null)
    + tile('feedback', num(agg.feedback_total));
  el.innerHTML = '<div class="fleet">'
    + '<h2>Fleet signals <span class="sub">across '+agg.running+' of '+agg.connectomes+' connectomes running</span></h2>'
    + '<div class="tiles">'+tiles+'</div>'
    + '<div class="block"><div class="h">signal by category</div>'+chipsFrom(agg.by_category, true)+'</div>'
    + '<div class="block"><div class="h">per-model hallucination trend</div>'+modelTable(agg.by_model)+'</div>'
    + '<div class="block"><div class="h">feedback themes</div>'+chipsFrom(agg.by_theme)+'</div>'
    + '<div class="block"><div class="h">recent feedback from connectomes</div>'+feedbackList(agg.recent_feedback, true)+'</div>'
    + '</div>';
}

// ── Per-connectome drill-down: what's pulling ITS score down + its own signals ──
function renderDetail(c){
  var live = c.live || {};
  var ded = live.deductions || {};
  var dks = Object.keys(ded).filter(function(k){ return ded[k]>0; }).sort(function(a,b){ return ded[b]-ded[a]; });
  var dedHtml = dks.length
    ? dks.map(function(k){ return '<div class="ded"><span>'+esc(k.replace(/_/g,' '))+'</span><b>-'+ded[k]+'</b></div>'; }).join('')
    : '<span class="muted">no penalties — clean</span>';
  var rd = live.recent_days || [];
  var mx = rd.reduce(function(m,d){ return Math.max(m, d.count||0); }, 1);
  var spark = rd.length
    ? '<div class="spark">'+rd.map(function(d){ return '<i style="height:'+Math.max(1,Math.round((d.count/mx)*34))+'px" title="'+esc(d.day)+': '+d.count+'"></i>'; }).join('')+'</div><div class="spark-lbl">'+rd.length+'-day activity</div>'
    : '<span class="muted">no activity yet</span>';
  var fb = (live.feedback && live.feedback.recent) || [];
  return '<div class="detail">'
    + '<div class="col"><div class="h">score breakdown (points off)</div>'+dedHtml+'</div>'
    + '<div class="col"><div class="h">activity</div>'+spark+'</div>'
    + '<div class="col" style="grid-column:1/-1"><div class="h">per-model on this connectome</div>'+modelTable(live.by_model)+'</div>'
    + '<div class="col" style="grid-column:1/-1"><div class="h">recent feedback</div>'+feedbackList(fb, false)+'</div>'
    + '</div>';
}

var OPEN = {}; // card path → expanded?  (persists across auto-refresh)
function toggleCard(el){ var p = el.getAttribute('data-path'); OPEN[p] = !OPEN[p]; if(LAST) render(LAST); }

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
  // Evidence-trust quarantine: deposits awaiting review — shown whenever the
  // engine reports any, even before effectiveness data exists.
  if (c.running && live.pending_deposits) {
    stats += '<span class="stat" style="color:var(--amber)" title="Quarantined graph deposits awaiting review — accept or reject them on the connectome (GET /api/pending)">pending review <b>'+live.pending_deposits+'</b></span>';
  }
  var action = updateAction(c);
  var hasDetail = c.running && score!=null;
  var isOpen = !!OPEN[c.path];
  var exp = hasDetail
    ? '<span class="expand" data-path="'+esc(c.path)+'" onclick="toggleCard(this)">'+(isOpen?'hide ▴':'details ▾')+'</span>'
    : '';
  var ver = c.running
    ? '<span class="ver">v'+esc(live.version||'?')+' '+action+exp+'</span>'
    : '<span class="ver muted">stopped</span> '+action;
  return '<div class="card'+(isOpen?' open':'')+'">'
    + '<div class="row1"><span class="dot" style="background:'+dotCol+'"></span>'
    + '<span class="cname">'+esc(c.display_name)+'</span> <span class="fname">'+esc(c.name)+'</span>'
    + ver + '</div>'
    + '<div class="row2">'+scoreHtml+stats
    + '<span class="assign"><input placeholder="assign to customer…" data-path="'+esc(c.path)+'" '
    + 'onchange="assign(this)"></span></div>'
    + (isOpen ? renderDetail(c) : '')
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

function sendUpdate(btn){
  btn.disabled=true; btn.textContent='queuing…';
  fetch('/api/launcher/update', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({path:btn.getAttribute('data-path')})})
    .then(function(r){return r.json();}).then(function(){ load(); });
}

var LATEST = { build: 0, version: '?' };

// The per-card action, consent-aware. A pending marker FOR THE CURRENT build shows its
// status (Sent/Pushed/Updated); otherwise a connectome that's behind (or stopped) can be
// sent an update, and one that's current is "up to date". No "Start" — the vendor never
// remotely turns on a client's engine.
function updateAction(c){
  var live = c.live || {};
  var pend = c.pending;
  var forCurrent = pend && pend.target_build === LATEST.build;
  if (forCurrent){
    if (pend.status === 'updated') return '<span class="st-updated">✓ Updated</span>';
    if (pend.status === 'pushed')  return '<span class="st-pushed">Pushed</span> <button class="upd-btn" data-path="'+esc(c.path)+'" onclick="sendUpdate(this)">Re-send</button>';
    return '<span class="st-sent">Sent · awaiting client</span>';
  }
  if (c.running && !live.update_available) return '<span class="uptodate">✓ up to date</span>';
  return '<button class="upd-btn" data-path="'+esc(c.path)+'" onclick="sendUpdate(this)">Send update</button>';
}

function updateAll(){
  fetch('/api/launcher/manager').then(function(r){return r.json();}).then(function(d){
    var latest = d.latest || {}; var paths=[];
    Object.keys(d.customers||{}).forEach(function(o){ (d.customers[o]||[]).forEach(function(c){
      var pend=c.pending, live=c.live||{};
      var forCurrent = pend && pend.target_build === latest.build;
      var needs = !forCurrent && !(c.running && !live.update_available); // not up-to-date, no current pending
      if (needs) paths.push(c.path);
    }); });
    if(!paths.length) return;
    Promise.all(paths.map(function(p){ return fetch('/api/launcher/update',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:p})}); }))
      .then(function(){ load(); });
  });
}

var LAST = null; // last manager payload — lets a card toggle re-render without a refetch

function render(d){
  LATEST = d.latest || LATEST;
  var lv = document.getElementById('latest-ver'); if(lv) lv.textContent = LATEST.version || '?';
  renderFleet(d.aggregate);
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
}

function load(){
  fetch('/api/launcher/manager').then(function(r){return r.json();}).then(function(d){
    LAST = d; render(d);
  }).catch(function(){ document.getElementById('wrap').innerHTML='<div class="muted">Launcher unreachable.</div>'; });
}
load(); setInterval(load, 12000);
</script>
</body></html>`;
