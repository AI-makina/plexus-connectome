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
  /* ── Onboarding wizard (first-run) + app-icon splash ── */
  /* the SAME Inter Variable file the connectome viz bundles — so the wordmark matches 1:1 */
  @font-face{font-family:'Inter Variable';src:url('/assets/launcher/inter-var.woff2') format('woff2');font-weight:100 1000;font-style:normal;font-display:swap}
  .wiz-brand{display:flex;align-items:center;justify-content:center;gap:11px;margin-bottom:20px}
  .wiz-brand img{width:30px;height:30px;border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.45)}
  /* mirror of the viz .wordmark (600 / uppercase / .28em tracking), scaled for a window header */
  .wiz-wordmark{font:600 15px/1 'Inter Variable',Inter,-apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.28em;color:var(--hi);margin-right:-.28em}
  .wiz{position:fixed;inset:0;background:radial-gradient(120% 90% at 50% 0%, #14161c 0%, #08090B 62%);display:none;align-items:center;justify-content:center;z-index:100;padding:24px;overflow:hidden}
  .wiz.show{display:flex}
  /* connectome-art backdrop — fades in once the presentation ends (info windows) */
  .wiz .artbg{position:absolute;inset:0;background:url('/assets/launcher/Connectome_art.png') center/cover no-repeat;opacity:0;transition:opacity .8s ease;pointer-events:none}
  .wiz .artbg::after{content:'';position:absolute;inset:0;background:radial-gradient(110% 85% at 50% 42%, rgba(8,9,11,.42) 0%, rgba(8,9,11,.88) 100%)}
  .wiz.art .artbg{opacity:1}
  .wiz-card{width:100%;max-width:560px;text-align:center;position:relative;z-index:1}
  .wiz.art .wiz-card{background:rgba(10,11,14,.62);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--line1);border-radius:18px;padding:36px 32px;box-shadow:0 26px 80px rgba(0,0,0,.55)}
  .wstep{display:none}
  .wstep.active{display:block;animation:wfade .4s ease}
  @keyframes wfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .appicon{width:132px;height:132px;border-radius:29px;cursor:pointer;display:inline-block;
    box-shadow:0 18px 50px rgba(0,0,0,.6);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s}
  .appicon:hover{transform:translateY(-4px) scale(1.03);box-shadow:0 26px 64px rgba(0,0,0,.72)}
  .appicon:active{transform:scale(.97)}
  .wiz-word{font:600 30px var(--sans);letter-spacing:.02em;margin:22px 0 6px}
  .wiz-sub{color:var(--mid);font-size:14px}
  .wiz-hint{color:var(--lo);font:12px var(--mono);letter-spacing:.06em;margin-top:20px;animation:pulse 2.2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}
  .wiz-vidwrap{position:relative;max-width:560px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid var(--line1);box-shadow:0 18px 50px rgba(0,0,0,.5);background:#000}
  .wiz-vidwrap video{display:block;width:100%}
  .vid-powered{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:30px 0 13px;background:linear-gradient(to top, rgba(0,0,0,.72), transparent);color:#CFD3DA;font:11px var(--mono);letter-spacing:.04em;pointer-events:none}
  .vid-powered img{height:16px;opacity:.92}
  .wiz-h{font:600 22px var(--sans);margin:22px 0 8px}
  .wiz-p{color:var(--mid);font-size:14px;line-height:1.6;max-width:450px;margin:0 auto 22px}
  .wiz-actions{display:flex;gap:14px;justify-content:center;align-items:center;margin-top:8px}
  .wiz-skip{color:var(--lo);font:12px var(--mono);cursor:pointer}
  .wiz-skip:hover{color:var(--mid)}
  .clientrow{display:flex;align-items:center;gap:12px;background:var(--ink1);border:1px solid var(--line1);border-radius:9px;padding:12px 15px;margin:8px 0;text-align:left}
  .clientrow .ci{flex:1;min-width:0}.clientrow .ci b{font-size:14px}
  .clientrow .c-state{font:10px var(--mono);color:var(--lo);margin-left:8px;text-transform:uppercase;letter-spacing:.06em}
  .clientrow .c-hint{font-size:10.5px;color:var(--lo);margin-top:2px;line-height:1.4}
  .opt-label{font:600 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--azure);margin:16px 0 8px;text-align:left}
  .opt-note{font-size:11px;color:var(--lo);text-align:left;margin:8px 0 2px;line-height:1.5}
  .clientrow .ok{color:var(--jade);font-size:16px}
  .wiz-ok{color:var(--jade);font-size:13px;margin:10px 0;background:rgba(115,201,145,.1);border:1px solid rgba(115,201,145,.3);border-radius:8px;padding:9px 12px}
  .wiz-manual{font-size:12px;color:var(--mid);text-align:left;margin:10px 0}
  .wiz-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
  .wiz-choice{background:var(--ink1);border:1px solid var(--line1);border-radius:10px;padding:20px 18px;cursor:pointer;text-align:left;transition:border-color .15s,transform .15s}
  .wiz-choice:hover{border-color:var(--azure);transform:translateY(-1px)}
  .wiz-choice b{display:block;font-size:15px;margin-bottom:5px}
  .wiz-choice span{color:var(--mid);font-size:12px;line-height:1.5}
  .powered{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:26px;color:var(--lo);font:11px var(--mono);letter-spacing:.04em}
  .powered img{height:16px;width:auto;opacity:.85}
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;z-index:90;padding:24px}
  .modal.show{display:flex}
  .modal-card{width:100%;max-width:420px;background:var(--ink1);border:1px solid var(--line2);border-radius:12px;padding:22px}
  .modal-card h3{font-size:16px;margin-bottom:4px}
  .rm-path{font:11px var(--mono);color:var(--lo);word-break:break-all;margin-bottom:14px}
  .rm-clients{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .rm-clients button{width:100%;text-align:left}
  .powered-foot{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:56px;padding-top:22px;border-top:1px solid var(--line1);color:var(--lo);font:11px var(--mono);letter-spacing:.04em}
  .powered-foot img{height:18px;opacity:.8}
</style>
</head>
<body>

<!-- ── ONBOARDING WIZARD (first run) ── -->
<div class="wiz" id="wizard">
  <div class="artbg"></div>
  <div class="wiz-card">
    <!-- step 0 · app icon → click to begin -->
    <div class="wstep active" data-step="0">
      <img class="appicon" src="/assets/launcher/plexus_icon_2_ultrablack.png" alt="Launch Plexus" onclick="startPresentation()">
      <div class="wiz-word">Plexus</div>
      <div class="wiz-sub">The evidence layer for your AI</div>
      <div class="wiz-hint">click the icon to begin</div>
    </div>
    <!-- step 1 · presentation — just the video (plays once via wizStep(1), NEVER autoplay:
         a hidden autoplaying video ends early and its onended would skip the presentation).
         Branding overlays the video itself; nothing below it. -->
    <div class="wstep" data-step="1">
      <div class="wiz-vidwrap">
        <video id="wiz-vid" src="/assets/launcher/plexus_launch_presentation.mp4" muted playsinline preload="auto" onended="vidEnded()"></video>
        <div class="vid-powered"><img src="/assets/launcher/skyfynd_logo.png" alt="SkyFynd"> Powered by SkyFynd</div>
      </div>
    </div>
    <!-- step 2 · connect your AI (one time) -->
    <div class="wstep" data-step="2">
      <div class="wiz-brand"><img src="/assets/launcher/plexus_icon_2_ultrablack.png" alt=""><span class="wiz-wordmark">Plexus</span></div>
      <div class="wiz-h">Connect Plexus to your AI</div>
      <div class="wiz-p">One time. After this, any project you open in a connected AI finds its brain automatically — nothing to point, nothing to pin.</div>
      <div style="text-align:left">
        <div class="opt-label">Option 1 · Connect an app</div>
        <div style="text-align:center;margin:6px 0 4px"><button class="primary" id="wiz-search" onclick="wizSearch(this)">⌕ Search this Mac for AI apps</button></div>
        <div id="wiz-clients"></div>
        <div class="opt-note">Every model a connected app runs — Claude, Gemini, GPT, local — automatically uses the brain of whichever Plexus project you open there.</div>
        <div class="opt-label">Option 2 · Use your terminal instead</div>
        <div class="cmd" id="wiz-global-cmd" onclick="copyGlobal(this)">loading…</div>
        <div class="opt-note">The exact same one-time connection for Claude Code, done by hand. Either way, afterwards you just open your AI inside a project folder and talk.</div>
      </div>
      <div id="wiz-connect-result"></div>
      <div class="wiz-actions">
        <button class="primary" onclick="wizStep(3)">Next</button>
        <span class="wiz-skip" onclick="wizStep(3)">I'll connect later →</span>
      </div>
    </div>
    <!-- step 3 · first project -->
    <div class="wstep" data-step="3">
      <div class="wiz-brand"><img src="/assets/launcher/plexus_icon_2_ultrablack.png" alt=""><span class="wiz-wordmark">Plexus</span></div>
      <div class="wiz-h">Start your first project</div>
      <div class="wiz-choices">
        <div class="wiz-choice" onclick="wizFinish('v-new')"><b>New project</b><span>Start fresh — Plexus builds the brain before the code exists.</span></div>
        <div class="wiz-choice" onclick="wizFinish('v-connect')"><b>I already have a project</b><span>Point at a folder — Plexus maps it, or opens its brain if it has one.</span></div>
      </div>
      <span class="wiz-skip" onclick="wizFinish(null)">Go to dashboard →</span>
    </div>
  </div>
</div>

<!-- ── RESUME WITH AI (per project) ── -->
<div class="modal" id="resume-modal">
  <div class="modal-card">
    <h3>Resume with AI</h3>
    <div class="rm-path" id="rm-path"></div>
    <div class="rm-clients" id="rm-clients"></div>
    <div class="cmd" id="rm-cmd" onclick="copyText(this.textContent,null)"></div>
    <div class="hint" id="rm-note">Opens this project's folder in your editor — the AI resolves its brain and picks up where you left off.</div>
    <div style="margin-top:14px;text-align:right"><button class="ghost" onclick="closeResume()">close</button></div>
  </div>
</div>

<div class="wrap">
  <header>
    <span class="glyph">⬡</span><h1>PLEXUS</h1><span class="tag">launcher · evidence protocol</span>
    <a href="/manager" style="margin-left:auto;color:var(--azure);text-decoration:none;font:500 12px var(--sans)">Manager →</a>
  </header>

  <!-- HOME -->
  <div class="view active" id="v-home">
    <div class="result" style="margin:0 0 18px;border-color:#2A3550">
      <h4 style="color:var(--azure)" id="conn-head">⬡ Checking your AI connections…</h4>
      <p class="hint" id="conn-sub" style="margin:2px 0 6px"></p>
      <div id="home-clients"></div>
      <div id="home-connect-result"></div>
      <p class="hint" style="margin-top:8px"><span class="mono" id="conn-manage" style="cursor:pointer;color:var(--azure)" onclick="toggleConnections(this)">manage connections ▾</span> &nbsp;·&nbsp; Prefer a terminal? <span class="mono" style="cursor:pointer;color:var(--azure)" onclick="copyGlobal(this)">copy the one-time command ⧉</span></p>
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

  <footer class="powered-foot"><img src="/assets/launcher/skyfynd_logo.png" alt="SkyFynd"> Powered by SkyFynd</footer>
</div>

<script>
const REGION_HEX = { frontal_lobe:'#7AA2F7', temporal_lobe:'#E3B341', occipital_lobe:'#E573B7',
  parietal_lobe:'#73C991', cerebellum:'#9D7CD8', brain_stem:'#8B98A9', limbic_system:'#E8795B',
  corpus_callosum:'#C8CFDA' };
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active');if(id==='v-home'){loadProjects();loadConnections();}}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// home
async function loadProjects(){
  const r = await fetch('/api/launcher/projects').then(x=>x.json());
  document.getElementById('np-base').value ||= r.default_base;
  if(r.global_mcp) GLOBAL_MCP = r.global_mcp;
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
      <button onclick="resumeWith('\${esc(p.path)}')" title="open this project in your AI editor — it resumes the brain">Resume with AI</button>
      <button onclick="serveProject('\${esc(p.path)}', \${p.ws_port})">\${p.running?'Open brain':'Start + open'}</button>
      <button class="ghost" title="Advanced: copy a command that PINS this one project to its own MCP entry. Not needed — once your AI is connected (top of page), every project is found by its folder." onclick="copyText(\\\`\${esc(p.mcp_command)}\\\`, this)">pin ⧉</button>
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
      \${connectedNote()}
      <div class="steps">
        <b>1.</b> Open your AI in this project — its first contact receives your brief, it interviews you about anything unclear, then seeds the connectome itself:<br>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">\${openHereButtons(r.path,'np-open-note')}</div>
        <div id="np-open-note"></div>
        <b>2.</b> <button onclick="serveProject('\${esc(r.path)}', \${r.ws_port})">Start + open the brain</button> — watch it grow as you two build.
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
        \${connectedNote()}
        <b>1.</b> Open your AI in this project — its first session receives the catch-up questions above and fills in what scanning can't see:<br>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">\${openHereButtons(r.path,'cx-open-note')}</div>
        <div id="cx-open-note"></div>
        <b>2.</b> <button onclick="serveProject('\${esc(r.path)}', \${r.ws_port})">Start + open the brain</button> — watch it grow as you build.
      </div>
    </div>\`;
  loadProjects();
}

// ── Onboarding wizard ──
var CLIENTS = [];
function checkOnboarding(){
  fetch('/api/launcher/onboarding').then(function(x){return x.json();}).then(function(r){
    if(!r.onboarded){ document.getElementById('wizard').classList.add('show'); }
  }).catch(function(){});
}
function wizStep(n){
  var steps = document.querySelectorAll('.wstep');
  for(var i=0;i<steps.length;i++){ steps[i].classList.toggle('active', parseInt(steps[i].getAttribute('data-step'),10)===n); }
  document.getElementById('wizard').classList.toggle('art', n>=2); // info windows sit over the connectome art
  var v=document.getElementById('wiz-vid');
  if(n===1){ if(v){ try{ v.currentTime=0; v.play(); }catch(e){} } }
  else if(v){ try{ v.pause(); }catch(e){} } // else a hidden video's onended could drag the user back
  if(n===2){ // detection is on-request (the Search button) — only prefill the terminal command
    var g=document.getElementById('wiz-global-cmd');
    if(g){ if(GLOBAL_MCP) g.textContent=GLOBAL_MCP;
      else fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){ GLOBAL_MCP=r.global_mcp||''; if(GLOBAL_MCP) g.textContent=GLOBAL_MCP; }).catch(function(){}); }
  }
}
function wizSearch(btn){
  btn.disabled=true; btn.textContent='searching…';
  renderClients(document.getElementById('wiz-clients'), 'wiz-connect-result').then(function(){
    btn.parentElement.style.display='none';
    var g=document.getElementById('wiz-global-cmd'); if(g && GLOBAL_MCP) g.textContent=GLOBAL_MCP;
  }).catch(function(){ btn.disabled=false; btn.textContent='⌕ Search this Mac for AI apps'; });
}
function startPresentation(){ wizStep(1); }
// advance only if the presentation is actually on screen (guards stray ended events)
function vidEnded(){ var s=document.querySelector('.wstep[data-step="1"]'); if(s && s.classList.contains('active')) wizStep(2); }
// ── ONE source of truth for AI connections — renders the same client rows in the
// wizard (step 2) AND the dashboard panel, so connecting in either place is the
// same act and both surfaces always agree. Returns the installed clients.
var GLOBAL_MCP='';
var INSTALLED=[]; // last detection result (installed clients) — shared by results screens
function copyGlobal(el){ if(!GLOBAL_MCP) return; navigator.clipboard.writeText(GLOBAL_MCP); var o=el.textContent; el.textContent='copied ✓'; setTimeout(function(){el.textContent=o;},1500); }
function renderClients(listEl, resultId){
  listEl.innerHTML = '<div class="hint">detecting your AI tools…</div>';
  return fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){
    GLOBAL_MCP = r.global_mcp || '';
    // Only what's actually ON this machine — an uninstalled app is noise, not a choice.
    var inst = (r.clients || []).filter(function(c){ return c.installed; });
    INSTALLED = inst;
    if(!inst.length){
      listEl.innerHTML = '<div class="hint">No AI tools detected on this machine. Install one (Claude Code, Antigravity, Cursor…), or paste this into any MCP-capable client:</div>'
        + '<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(GLOBAL_MCP)+'</div>';
      return inst;
    }
    listEl.innerHTML = inst.map(function(c){
      var state = c.connected===true ? 'connected' : (c.connected===false ? 'not connected' : 'detected');
      var right = c.connected===true ? '<span class="ok">✓</span>' : '<button data-result="'+resultId+'" onclick="connectClient(\\''+c.id+'\\',this)">Connect</button>';
      return '<div class="clientrow"><div class="ci"><b>'+esc(c.label)+'</b><span class="c-state">'+state+'</span>'+(c.hint?'<div class="c-hint">'+esc(c.hint)+'</div>':'')+'</div>'+right+'</div>';
    }).join('');
    return inst;
  });
}
function loadWizClients(){
  renderClients(document.getElementById('wiz-clients'), 'wiz-connect-result').then(function(){
    var g = document.getElementById('wiz-global-cmd'); if(g && GLOBAL_MCP) g.textContent = GLOBAL_MCP;
  }).catch(function(){ document.getElementById('wiz-clients').innerHTML='<div class="hint">could not detect AI tools</div>'; });
}

// ── Post-create handoff: one-click "open your AI in this project" ──
// The folder IS the pointer — the AI opened here resolves this brain automatically.
function openHereButtons(p, noteId){
  var list = (INSTALLED||[]).filter(function(c){ return c.can_open_folder || c.id==='claude'; });
  if(!list.length) return '<span class="hint">open a terminal in this folder and start your AI</span>';
  return list.map(function(c){
    var lbl = c.id==='claude' ? 'Open Terminal here · Claude Code' : 'Open in '+esc(c.label);
    return '<button data-p="'+esc(p)+'" data-c="'+esc(c.id)+'" data-n="'+esc(noteId)+'" onclick="openProjectIn(this)">'+lbl+'</button>';
  }).join(' ');
}
function openProjectIn(btn){
  var p=btn.getAttribute('data-p'), c=btn.getAttribute('data-c'), n=btn.getAttribute('data-n');
  var orig=btn.textContent; btn.disabled=true; btn.textContent='opening…';
  fetch('/api/launcher/open-editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,client:c})})
    .then(function(x){return x.json();}).then(function(r){
      btn.disabled=false; btn.textContent = r.ok ? 'opened ✓' : orig;
      var note=document.getElementById(n);
      if(note){ var h=''; if(r.note) h+='<div class="hint">'+esc(r.note)+'</div>'; if(r.command) h+='<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(r.command)+'</div>'; note.innerHTML=h; }
    }).catch(function(){ btn.disabled=false; btn.textContent=orig; });
}
function connectedNote(){
  var conn=(INSTALLED||[]).filter(function(c){ return c.connected===true; });
  if(conn.length) return '<div class="hint" style="margin:4px 0 10px">✓ '+esc(conn.map(function(c){return c.label;}).join(', '))+' is connected — opening it in this folder finds the brain automatically. Just talk about your app.</div>';
  return '<div class="hint" style="margin:4px 0 10px">Your AI is not connected yet — do the one-time connect at the top of this page first (or copy its terminal command).</div>';
}
function loadConnections(){
  // Status line only — the client rows appear on request via "manage connections".
  var head = document.getElementById('conn-head'), sub = document.getElementById('conn-sub');
  if(!head) return;
  fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){
    GLOBAL_MCP = r.global_mcp || GLOBAL_MCP;
    var inst = (r.clients||[]).filter(function(c){ return c.installed; });
    INSTALLED = inst;
    var conn = inst.filter(function(c){ return c.connected===true; });
    if(conn.length){
      head.textContent = '⬡ Your AI is connected — ' + conn.map(function(c){return c.label;}).join(', ');
      sub.textContent = 'Open your AI in any project folder and just talk — Plexus finds the right brain automatically. The cards below are optional manual paths; this page is your dashboard.';
    } else if(inst.length){
      head.textContent = '⬡ Connect your AI — one time';
      sub.textContent = 'Use manage connections below to link the AI tools you use. After that, every project works automatically.';
    } else {
      head.textContent = '⬡ Connect your AI';
      sub.textContent = 'No AI tools detected yet — manage connections has the universal command.';
    }
  }).catch(function(){ head.textContent='⬡ Your AI connections'; });
}
function toggleConnections(el){
  var list = document.getElementById('home-clients');
  if(list.innerHTML){ list.innerHTML=''; document.getElementById('home-connect-result').innerHTML=''; el.textContent='manage connections ▾'; return; }
  el.textContent='searching…';
  renderClients(list, 'home-connect-result').then(function(){ el.textContent='hide ▴'; })
    .catch(function(){ el.textContent='manage connections ▾'; });
}
function connectClient(id, btn){
  var box = document.getElementById(btn.getAttribute('data-result'));
  btn.disabled=true; btn.textContent='connecting…';
  fetch('/api/launcher/connect-mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client:id})})
    .then(function(x){return x.json();}).then(function(r){
      if(r.ok && r.ran){ btn.textContent='connected ✓'; if(box) box.innerHTML='<div class="wiz-ok">✓ Connected. Plexus now works in every project for this AI.</div>';
        setTimeout(function(){
          loadConnections();
          // refresh whichever row-lists are actually open (never populate unrequested)
          var wl=document.getElementById('wiz-clients'); if(document.getElementById('wizard').classList.contains('show') && wl && wl.innerHTML) loadWizClients();
          var hl=document.getElementById('home-clients'); if(hl && hl.innerHTML) renderClients(hl,'home-connect-result');
        }, 600); }
      else if(r.ok && r.already){ btn.textContent='already connected ✓'; }
      else if(r.manual){ btn.disabled=false; btn.textContent='Connect';
        var where = r.config_path ? 'Merge this into <span class="mono" style="color:var(--ice)">'+esc(r.config_path)+'</span> — then restart it:' : 'Add this to '+esc(id)+' MCP config, then reopen it:';
        if(box) box.innerHTML='<div class="wiz-manual">'+where+'<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(r.config_json||r.command)+'</div></div>'; }
      else { btn.disabled=false; btn.textContent='Connect'; if(box) box.innerHTML='<div class="wiz-manual">Run this in a terminal:<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(r.command)+'</div>'+(r.error?'<div class="hint">'+esc(r.error)+'</div>':'')+'</div>'; }
    }).catch(function(){ btn.disabled=false; btn.textContent='Connect'; });
}
function wizFinish(view){
  fetch('/api/launcher/onboarding/complete',{method:'POST'}).catch(function(){});
  document.getElementById('wizard').classList.remove('show');
  show(view || 'v-home');
}

// ── Resume with AI (per project) ──
var RESUME_PATH = '';
function resumeWith(pathStr){
  RESUME_PATH = pathStr;
  document.getElementById('rm-path').textContent = pathStr;
  document.getElementById('rm-cmd').textContent = 'cd "'+pathStr+'"';
  document.getElementById('rm-note').textContent = "Opens this project's folder in your editor — the AI resolves its brain and picks up where you left off.";
  document.getElementById('resume-modal').classList.add('show');
  var el = document.getElementById('rm-clients');
  el.innerHTML = '<div class="hint">detecting editors…</div>';
  fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){
    var installed = (r.clients||[]).filter(function(c){return c.installed && (c.can_open_folder || c.id==='claude');});
    var rows = installed.map(function(c){ return '<button onclick="openIn(\\''+c.id+'\\',this)">Open in '+esc(c.label)+'</button>'; }).join('');
    el.innerHTML = (rows || '<div class="hint">No editors detected on PATH — use the command below.</div>') + '<button onclick="openIn(\\'folder\\',this)">Open folder</button>';
  }).catch(function(){ el.innerHTML='<div class="hint">detection failed — use the command below.</div>'; });
}
function openIn(client, btn){
  btn.disabled=true; var orig=btn.textContent; btn.textContent='opening…';
  fetch('/api/launcher/open-editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:RESUME_PATH,client:client})})
    .then(function(x){return x.json();}).then(function(r){
      btn.disabled=false;
      if(r.command) document.getElementById('rm-cmd').textContent=r.command;
      if(r.note) document.getElementById('rm-note').textContent=r.note;
      btn.textContent = r.ok ? 'opened ✓' : orig;
    }).catch(function(){ btn.disabled=false; btn.textContent=orig; });
}
function closeResume(){ document.getElementById('resume-modal').classList.remove('show'); }

loadProjects();
loadConnections();
checkOnboarding();
</script>
</body>
</html>`;
