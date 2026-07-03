// The launcher window — served inline so dist stays self-contained.
// Visual language matches the 3D instrument: graphite void, mono labels,
// region-hex accents, no decoration that doesn't inform.

export const LAUNCHER_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plexus — Launcher</title>
<style>
  :root {
    --ink0:#08090B; --ink1:#0D0E10; --ink2:#131417;
    --line1:#1E2026; --line2:#2A2D35; --hi:#E7E9EC; --mid:#9BA3AF; --lo:#5C6470;
    --azure:#7AA2F7; --jade:#73C991; --gold:#E3B341; --coral:#E8795B; --rose:#E573B7;
    --violet:#9D7CD8; --slate:#8B98A9; --ice:#C8CFDA; --crimson:#E5484D;
    --mono:'SF Mono',ui-monospace,Menlo,monospace; --sans:-apple-system,'Inter',sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--ink0);color:var(--hi);font:15px/1.5 var(--sans);min-height:100vh}
  .wrap{max-width:980px;margin:0 auto;padding:48px 24px 96px}
  header{display:flex;align-items:baseline;gap:14px;margin-bottom:40px}
  header h1{font:600 20px var(--sans);letter-spacing:.02em}
  header .glyph{color:var(--azure);font-size:22px}
  header .tag{font:500 10px var(--mono);color:var(--lo);text-transform:uppercase;letter-spacing:.14em}
  .mono{font-family:var(--mono)}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:44px}
  .card{background:var(--ink1);border:1px solid var(--line1);border-radius:10px;padding:26px;cursor:pointer;transition:border-color .15s, transform .15s}
  .card:hover{border-color:var(--line2);transform:translateY(-1px)}
  .card h2{font:600 16px var(--sans);margin-bottom:6px}
  .card p{color:var(--mid);font-size:13px}
  .card .k{font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px;display:block}
  .card.new .k{color:var(--jade)} .card.connect .k{color:var(--gold)}
  h3.sect{font:500 11px var(--mono);color:var(--lo);letter-spacing:.14em;text-transform:uppercase;margin:34px 0 12px}
  .proj{background:var(--ink1);border:1px solid var(--line1);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:8px}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--lo);flex:none}
  .dot.on{background:var(--jade);box-shadow:0 0 8px var(--jade)}
  .proj .info{flex:1;min-width:0}
  .proj .name{font-weight:600;font-size:14px}
  .proj .path{font:11px var(--mono);color:var(--lo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .proj .ports{font:10px var(--mono);color:var(--mid)}
  button{background:var(--ink2);color:var(--hi);border:1px solid var(--line2);border-radius:6px;padding:7px 14px;font:500 12px var(--sans);cursor:pointer}
  button:hover{border-color:var(--slate)}
  button.primary{background:var(--azure);border-color:var(--azure);color:#0A0F1E;font-weight:600}
  button.ghost{background:transparent;border-color:transparent;color:var(--lo)}
  button:disabled{opacity:.45;cursor:default}
  .view{display:none}.view.active{display:block}
  label{display:block;font:500 10px var(--mono);color:var(--mid);letter-spacing:.12em;text-transform:uppercase;margin:18px 0 6px}
  input[type=text],textarea{width:100%;background:var(--ink1);border:1px solid var(--line1);border-radius:6px;color:var(--hi);padding:10px 12px;font:13px var(--sans)}
  textarea{font-family:var(--mono);font-size:12px;resize:vertical;min-height:56px}
  input:focus,textarea:focus{outline:none;border-color:var(--azure)}
  .q{border-left:2px solid var(--line2);padding-left:14px;margin-bottom:4px}
  .q .region{font:500 10px var(--mono);letter-spacing:.1em;text-transform:uppercase}
  .hint{font-size:12px;color:var(--lo);margin-top:4px}
  .row{display:flex;gap:10px;align-items:center}
  .grow{flex:1}
  .back{color:var(--lo);font:12px var(--mono);cursor:pointer;margin-bottom:22px;display:inline-block}
  .back:hover{color:var(--mid)}
  .result{background:var(--ink1);border:1px solid var(--line1);border-radius:10px;padding:22px;margin-top:20px}
  .result h4{font-size:14px;margin-bottom:10px}
  .cmd{background:var(--ink0);border:1px solid var(--line1);border-radius:6px;padding:10px 12px;font:11px var(--mono);color:var(--ice);word-break:break-all;cursor:pointer;margin:8px 0}
  .cmd:hover{border-color:var(--slate)}
  .qa{font-size:12px;color:var(--mid);padding:6px 0;border-bottom:1px solid var(--line1)}
  .bar{display:flex;gap:2px;height:10px;border-radius:3px;overflow:hidden;margin:10px 0}
  .bar div{min-width:2px}
  .status{font:12px var(--mono);color:var(--gold);margin:14px 0;min-height:18px}
  .fsrow{font:12px var(--mono);color:var(--mid);padding:5px 10px;border-radius:5px;cursor:pointer;display:flex;gap:8px}
  .fsrow:hover{background:var(--ink2);color:var(--hi)}
  .fsbox{background:var(--ink1);border:1px solid var(--line1);border-radius:8px;max-height:230px;overflow:auto;padding:8px;margin-top:8px}
  .badge{font:9px var(--mono);letter-spacing:.08em;padding:2px 7px;border-radius:9px;border:1px solid var(--line2);color:var(--mid)}
  .badge.gen{color:var(--jade);border-color:var(--jade)}
  .steps{color:var(--mid);font-size:13px;line-height:1.9}
  .steps b{color:var(--hi)}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="glyph">⬡</span><h1>PLEXUS</h1><span class="tag">launcher · evidence protocol</span>
  </header>

  <!-- HOME -->
  <div class="view active" id="v-home">
    <div class="result" style="margin:0 0 18px;border-color:#2A3550">
      <h4 style="color:var(--azure)">⬡ The plug-and-play way: register once, then just talk to your AI</h4>
      <p class="hint" style="margin:2px 0 6px">Paste this in a terminal one time. After that, open Claude Code anywhere and say what you want to build — the AI creates the brain, seeds the plan from your own words, and starts every reply with <span class="mono" style="color:var(--ice)">⬡ plexus active</span> so you know it's engaged. The cards below are optional manual paths; this page is your dashboard.</p>
      <div class="cmd" id="global-mcp" onclick="copyText(this.textContent,null)">loading…</div>
    </div>
    <div class="cards">
      <div class="card new" onclick="show('v-new')">
        <span class="k">Genesis</span>
        <h2>Create a new project</h2>
        <p>Answer nine questions about the app you're imagining. Plexus builds the brain <i>before the code exists</i> — your AI builds against the plan.</p>
      </div>
      <div class="card connect" onclick="show('v-connect')">
        <span class="k">Graft</span>
        <h2>Connect an existing project</h2>
        <p>Point at a folder. Plexus maps every function, component, service and secret in seconds, mines the git history, and asks your AI to fill in the rest.</p>
      </div>
    </div>
    <h3 class="sect">Your brains</h3>
    <div id="projects"><div class="hint">loading…</div></div>
  </div>

  <!-- NEW PROJECT -->
  <div class="view" id="v-new">
    <span class="back" onclick="show('v-home')">← back</span>
    <h2 style="margin-bottom:4px">New project</h2>
    <p class="hint">Describe it in your own words — your AI and the librarian turn this into the brain. You never file anything into lobes.</p>
    <div class="row" style="margin-top:18px">
      <div class="grow"><label>Project name</label><input type="text" id="np-name" placeholder="my-app"></div>
      <div class="grow"><label>Create inside</label><input type="text" id="np-base"></div>
    </div>
    <label>What are you imagining?</label>
    <textarea id="np-desc" style="min-height:130px;font-family:var(--sans);font-size:14px" placeholder="Write it like you'd tell a friend. What it does, who it's for, what the user sees, what it talks to, anything that should happen on its own…"></textarea>
    <label>What must never go wrong? <span style="color:var(--lo);text-transform:none;letter-spacing:0">(optional — these become standing guards your AI is warned about forever)</span></label>
    <textarea id="np-risks" placeholder="e.g. never double-charge a customer · never lose a draft"></textarea>
    <div class="status" id="np-status"></div>
    <button class="primary" id="np-create" onclick="createProject()">Create project + brain</button>
    <div id="np-result"></div>
  </div>

  <!-- CONNECT -->
  <div class="view" id="v-connect">
    <span class="back" onclick="show('v-home')">← back</span>
    <h2 style="margin-bottom:4px">Connect an existing project</h2>
    <p class="hint">Browse to the app's root folder (where its package.json / source lives).</p>
    <label>Folder</label>
    <div class="row"><input type="text" id="cx-path" class="grow"><button onclick="browse(document.getElementById('cx-path').value)">browse</button></div>
    <div class="fsbox" id="fsbox" style="display:none"></div>
    <div class="status" id="cx-status"></div>
    <button class="primary" id="cx-go" onclick="connectProject()">Connect — map this codebase</button>
    <div id="cx-result"></div>
  </div>
</div>

<script>
const REGION_HEX = { frontal_lobe:'#7AA2F7', temporal_lobe:'#E3B341', occipital_lobe:'#E573B7',
  parietal_lobe:'#73C991', cerebellum:'#9D7CD8', brain_stem:'#8B98A9', limbic_system:'#E8795B',
  corpus_callosum:'#C8CFDA' };
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active');if(id==='v-home')loadProjects();}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// home
async function loadProjects(){
  const r = await fetch('/api/launcher/projects').then(x=>x.json());
  document.getElementById('np-base').value ||= r.default_base;
  if(r.global_mcp) document.getElementById('global-mcp').textContent = r.global_mcp;
  const el = document.getElementById('projects');
  if(!r.projects.length){el.innerHTML='<p class="hint">No brains yet — talk to your AI (after the one-time command above), or use the cards.</p>';return;}
  el.innerHTML = r.projects.map(p=>\`
    <div class="proj">
      <div class="dot \${p.running?'on':''}"></div>
      <div class="info">
        <div class="name">\${esc(p.name)} <span class="badge \${p.kind==='genesis'?'gen':''}">\${p.kind}</span></div>
        <div class="path">\${esc(p.path)}</div>
        <div class="ports">api :\${p.api_port} · brain :\${p.ws_port}</div>
        <div class="ports" id="pulse-\${p.api_port}"></div>
      </div>
      <button onclick="serveProject('\${esc(p.path)}', \${p.ws_port})">\${p.running?'Open brain':'Start + open'}</button>
      <button class="ghost" title="copy the MCP command for Claude Code" onclick="copyText(\\\`\${esc(p.mcp_command)}\\\`, this)">MCP ⧉</button>
      <button class="ghost" onclick="forget('\${esc(p.path)}')">✕</button>
    </div>\`).join('');
  // Reassurance pulse: proof the AI is actually leaning on each brain
  for(const p of r.projects){
    if(!p.running) continue;
    fetch('http://localhost:'+p.api_port+'/api/activity').then(x=>x.json()).then(a=>{
      const el2 = document.getElementById('pulse-'+p.api_port);
      if(!el2) return;
      const ago = a.last_consultation ? Math.round((Date.now()-new Date(a.last_consultation))/60000) : null;
      el2.innerHTML = '<span style="color:var(--jade)">◉</span> ' +
        a.consultations_24h + ' consultation'+(a.consultations_24h===1?'':'s')+' today' +
        (ago!==null ? ' · last '+(ago<1?'just now':ago+'m ago') : '') +
        ' · '+a.active_nodes+' nodes · '+a.amygdala_entries+' memor'+(a.amygdala_entries===1?'y':'ies');
    }).catch(()=>{});
  }
}
async function serveProject(p, uiPort){
  await fetch('/api/launcher/serve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});
  window.open('http://localhost:'+uiPort,'_blank');
  setTimeout(loadProjects,1200);
}
async function forget(p){
  await fetch('/api/launcher/forget',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});
  loadProjects();
}
function copyText(t, btn){navigator.clipboard.writeText(t);if(btn){const o=btn.textContent;btn.textContent='copied ✓';setTimeout(()=>btn.textContent=o,1500);}}

// new project
async function createProject(){
  const name = document.getElementById('np-name').value.trim();
  const status = document.getElementById('np-status');
  if(!name){status.textContent='name the project first';return;}
  document.getElementById('np-create').disabled = true;
  status.textContent = 'creating project · initializing brain · writing the genesis brief…';
  const r = await fetch('/api/launcher/create',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name,
      base_dir: document.getElementById('np-base').value,
      description: document.getElementById('np-desc').value,
      risks: document.getElementById('np-risks').value,
    })}).then(x=>x.json());
  document.getElementById('np-create').disabled = false;
  if(r.error){status.textContent='✗ '+r.error;return;}
  status.textContent='';
  document.getElementById('np-result').innerHTML = \`
    <div class="result">
      <h4>⬡ \${esc(name)} is ready — your brief is in the brain, waiting for your AI.</h4>
      <div class="steps">
        <b>1.</b> Plug your AI in (paste in a terminal, once): <div class="cmd" onclick="copyText(this.textContent,null)">\${esc(r.mcp_command)}</div>
        <b>2.</b> Open a Claude Code session in <span class="mono">\${esc(r.path)}</span>. Its first contact receives your brief — it interviews you conversationally about anything unclear, then seeds the connectome itself. The librarian places every element; the relationships are what matter.<br>
        <b>3.</b> <button onclick="serveProject('\${esc(r.path)}', \${r.ws_port})">Start + open the brain</button> — watch it grow as you two build.
      </div>
    </div>\`;
  loadProjects();
}

// connect existing
async function browse(p){
  const box = document.getElementById('fsbox');
  const r = await fetch('/api/launcher/fs?path='+encodeURIComponent(p||'')).then(x=>x.json());
  if(r.error){box.style.display='block';box.innerHTML='<div class="hint">'+esc(r.error)+'</div>';return;}
  document.getElementById('cx-path').value = r.path;
  box.style.display='block';
  box.innerHTML =
    '<div class="fsrow" onclick="browse(\\''+esc(r.parent)+'\\')">↑ ..</div>' +
    r.dirs.map(d=>'<div class="fsrow" onclick="browse(\\''+esc(r.path+'/'+d)+'\\')">▸ '+esc(d)+'</div>').join('') +
    (r.has_plexus?'<div class="hint" style="padding:6px 10px">⬡ this folder already has a Plexus brain — connecting will refresh it</div>':'');
}
async function connectProject(){
  const p = document.getElementById('cx-path').value.trim();
  const status = document.getElementById('cx-status');
  if(!p){status.textContent='pick a folder first';return;}
  document.getElementById('cx-go').disabled = true;
  status.textContent = 'mapping the codebase · parsing artifacts · mining git history… (larger repos take longer)';
  const r = await fetch('/api/launcher/connect',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:p})}).then(x=>x.json());
  document.getElementById('cx-go').disabled = false;
  if(r.error){status.textContent='✗ '+r.error;return;}
  status.textContent='';
  const rep = r.report || {};
  const bar = (rep.regions||[]).map(x=>'<div style="flex:'+Math.max(1,Math.round(x.share*100))+';background:'+(REGION_HEX[x.region]||'#333')+(x.node_count===0?'22':'')+'" title="'+x.region+': '+x.node_count+'"></div>').join('');
  document.getElementById('cx-result').innerHTML = \`
    <div class="result">
      <h4>⬡ Brain built — utilization \${rep.utilization_score??'—'} · map \${(rep.maturity||'').toUpperCase()} · \${r.mined_proposals} mined proposal\${r.mined_proposals===1?'':'s'} from git history</h4>
      <div class="bar">\${bar}</div>
      \${(rep.enrichment_questions||[]).slice(0,5).map(q=>'<div class="qa">? '+esc(q)+'</div>').join('')}
      <div class="steps" style="margin-top:14px">
        <b>1.</b> <button onclick="serveProject('\${esc(r.path)}', \${r.ws_port})">Start + open the brain</button><br>
        <b>2.</b> Plug your AI in: <div class="cmd" onclick="copyText(this.textContent,null)">\${esc(r.mcp_command)}</div>
        <b>3.</b> In its first session the AI receives the catch-up questions above and fills in what scanning can't see.
      </div>
    </div>\`;
  loadProjects();
}

loadProjects();
</script>
</body>
</html>`;
