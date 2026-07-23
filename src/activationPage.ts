// ─── Activation / first-run page (user edition) ──────────────────────────────
// Served at '/' instead of the dashboard until a license exists and is healthy.
// Flow: Terms → invite code → profile → activate. Entitlement before identity:
// no personal data is asked from someone who can't get in anyway. The same page
// renders the INACTIVE states (denied / trial expired / unreachable) — degrade,
// never destroy: brains keep running locally; only the launcher's doors close.
// __ACT_STATE__ is replaced serve-time with {state, reason?, msg?, email?, kind?}.

export const ACTIVATION_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plexus — activate</title>
<style>
  :root{
    --ink0:#07060E; --ink1:rgba(255,255,255,.045); --ink2:rgba(255,255,255,.085);
    --line1:rgba(255,255,255,.09); --line2:rgba(255,255,255,.17);
    --hi:#EDEBF6; --mid:#A8A3BD; --lo:#6B6683; --ghost:#4A4660;
    --gold:#F5C044; --violet:#A78BFA; --ice:#D6D2E8; --crimson:#E5484D; --jade:#5FE3A1;
    --grad:linear-gradient(135deg,#8B5CF6 0%,#C452E8 55%,#EC4899 100%);
    --mono:'SF Mono',ui-monospace,Menlo,monospace; --sans:-apple-system,'Inter',sans-serif;
  }
  @font-face{font-family:'Inter Variable';src:url('/assets/launcher/inter-var.woff2') format('woff2');font-weight:100 1000;font-style:normal;font-display:swap}
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:
      radial-gradient(900px 620px at 10% -6%, rgba(139,92,246,.17), transparent 62%),
      radial-gradient(820px 600px at 96% 14%, rgba(236,72,153,.11), transparent 58%),
      radial-gradient(1000px 720px at 6% 108%, rgba(96,165,250,.10), transparent 62%),
      var(--ink0);
    background-attachment:fixed;color:var(--hi);font:15px/1.5 var(--sans);
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px}
  ::selection{background:rgba(139,92,246,.4)}
  .deco{position:fixed;pointer-events:none;mix-blend-mode:screen;z-index:0;user-select:none;opacity:.5}
  .card{position:relative;z-index:1;width:min(480px,94vw);background:var(--ink1);border:1px solid var(--line1);
    border-radius:20px;padding:34px 36px 26px;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
    box-shadow:0 24px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06)}
  .brand{display:flex;align-items:center;gap:11px;margin-bottom:6px}
  .brand img.icon{width:34px;height:34px;border-radius:8px}
  .brand .word{font:600 21px 'Inter Variable',var(--sans);letter-spacing:.4px}
  .sub{color:var(--mid);font-size:13px;margin-bottom:22px}
  h2{font:600 16.5px var(--sans);margin:0 0 8px}
  p{color:var(--mid);font-size:13.5px;margin:0 0 12px}
  a{color:var(--violet);text-decoration:none}
  a:hover{text-decoration:underline}
  label{display:block;font:600 12px var(--sans);color:var(--ice);margin:14px 0 5px}
  input[type=text],input[type=email],select,textarea{width:100%;background:var(--ink2);border:1px solid var(--line2);
    border-radius:10px;padding:10px 12px;color:var(--hi);font:14px var(--sans);outline:none}
  input:focus,select:focus,textarea:focus{border-color:rgba(167,139,250,.55)}
  input.code{font:600 17px var(--mono);letter-spacing:2.5px;text-transform:uppercase;text-align:center}
  .chk{display:flex;gap:9px;align-items:flex-start;margin:12px 0;color:var(--mid);font-size:12.5px;cursor:pointer}
  .chk input{margin-top:3px;accent-color:#A78BFA}
  button.primary{background:var(--grad);border:none;color:#fff;font:600 14px var(--sans);border-radius:11px;
    padding:11px 18px;cursor:pointer;width:100%;margin-top:16px;
    box-shadow:0 4px 18px rgba(196,82,232,.35), inset 0 1px 0 rgba(255,255,255,.22)}
  button.primary:hover{filter:brightness(1.12)}
  button.primary:disabled{opacity:.45;cursor:default;filter:none}
  button.ghost{background:transparent;border:none;color:var(--lo);font:500 12.5px var(--sans);cursor:pointer;margin-top:10px;width:100%}
  button.ghost:hover{color:var(--ice)}
  .err{color:var(--crimson);font-size:12.5px;margin-top:10px;min-height:16px}
  .ok{color:var(--jade);font-size:12.5px;margin-top:10px}
  .dots{display:flex;gap:7px;justify-content:center;margin:0 0 18px}
  .dots i{width:7px;height:7px;border-radius:50%;background:var(--ghost);transition:all .25s}
  .dots i.on{background:var(--violet);box-shadow:0 0 10px rgba(167,139,250,.6)}
  .foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line1);display:flex;justify-content:space-between;align-items:center}
  .foot span{color:var(--ghost);font-size:11px}
  .foot img{height:14px;opacity:.55}
  .pill{display:inline-block;font:600 10.5px var(--mono);letter-spacing:.8px;color:var(--gold);
    border:1px solid rgba(245,192,68,.4);border-radius:999px;padding:2px 9px;margin-bottom:14px}
  .paused .pill{color:var(--crimson);border-color:rgba(229,72,77,.4)}
  .hide{display:none}
</style></head><body>
<img class="deco" src="/assets/launcher/neon_plexus.png" style="width:340px;right:-60px;bottom:-70px" alt="">
<div class="card" id="card">
  <div class="brand"><img class="icon" src="/assets/launcher/plexus_icon_2_ultrablack.png" alt=""><span class="word">plexus</span></div>
  <div class="sub">the connectome brain for your projects — runs entirely on your computer</div>

  <!-- ── step 1 · terms ── -->
  <div id="s-terms" class="hide">
    <div class="dots"><i class="on"></i><i></i><i></i></div>
    <h2>Before we begin</h2>
    <p>Plexus is licensed, not sold. Your projects, code, and connectomes stay on your computer — the only things that ever leave are your license check and whatever you choose to send us.</p>
    <p>Please review the <a href="https://skyfynd.io/terms" target="_blank" rel="noopener">Skyfynd Terms</a>, the <a href="https://skyfynd.io/privacy" target="_blank" rel="noopener">Privacy Policy</a>, and the <a href="/legal" target="_blank">Plexus License Agreement</a>.</p>
    <label class="chk"><input type="checkbox" id="agree"><span>I have read and accept the Terms, Privacy Policy, and Plexus License Agreement.</span></label>
    <button class="primary" id="b-terms" disabled onclick="toStep('code')">Continue</button>
  </div>

  <!-- ── step 2 · invite code ── -->
  <div id="s-code" class="hide">
    <div class="dots"><i class="on"></i><i class="on"></i><i></i></div>
    <h2>Enter your access code</h2>
    <p>Your invitation email contains a one-time code. It proves this copy of Plexus is yours.</p>
    <input type="text" class="code" id="code" maxlength="24" placeholder="XXXX-XXXX-XXXX" autocomplete="off">
    <div class="err" id="e-code"></div>
    <button class="primary" onclick="toStep('profile')">Continue</button>
    <button class="ghost" onclick="toStep('terms')">back</button>
  </div>

  <!-- ── step 3 · profile ── -->
  <div id="s-profile" class="hide">
    <div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <h2>Almost there</h2>
    <label>Your name</label><input type="text" id="name" autocomplete="name">
    <label>Email</label><input type="email" id="email" autocomplete="email" placeholder="the address your invitation was sent to">
    <label>Where did you hear about Plexus? <span style="color:var(--ghost);font-weight:400">(optional)</span></label>
    <select id="heard"><option value="">—</option><option>A friend or coworker</option><option>Skyfynd</option><option>Social media</option><option>Search</option><option>Other</option></select>
    <label class="chk"><input type="checkbox" id="mkt"><span>Keep me posted about Plexus and Skyfynd apps (no spam, unsubscribe anytime).</span></label>
    <label class="chk"><input type="checkbox" id="shareai" checked><span>Share the AI questionnaire's product feedback with Skyfynd — product answers only, never your code or project content.</span></label>
    <div class="err" id="e-act"></div>
    <button class="primary" id="b-act" onclick="doActivate()">Activate Plexus</button>
    <button class="ghost" onclick="toStep('code')">back</button>
  </div>

  <!-- ── inactive states ── -->
  <div id="s-inactive" class="hide paused">
    <span class="pill" id="p-pill">LICENSE PAUSED</span>
    <h2 id="p-head">Your Plexus access is paused</h2>
    <p id="p-msg"></p>
    <p style="color:var(--ghost);font-size:12px">Your connectomes and evidence are untouched on your computer — nothing is ever held hostage. Reactivating restores everything instantly.</p>
    <label>Have a new code?</label>
    <input type="text" class="code" id="re-code" maxlength="24" placeholder="XXXX-XXXX-XXXX" autocomplete="off">
    <div class="err" id="e-re"></div>
    <button class="primary" onclick="reActivate()">Reactivate</button>
    <button class="ghost" onclick="recheck(this)">re-check my license ⟲</button>
    <button class="ghost" onclick="toggleMsg()">message support</button>
    <div id="sup" class="hide">
      <label>What's going on?</label><textarea id="sup-body" rows="3" style="font-family:var(--sans);font-size:13px"></textarea>
      <button class="primary" style="margin-top:10px" onclick="sendSupport()">Send to Skyfynd</button>
      <div class="ok hide" id="sup-ok">sent ✓ — we'll reply to your email</div>
    </div>
  </div>

  <div class="foot"><span>Powered by <a href="https://skyfynd.io" target="_blank" rel="noopener" style="color:var(--ghost)">Skyfynd.io</a></span><img src="/assets/launcher/skyfynd_logo.png" alt=""></div>
</div>
<script>
var ST = __ACT_STATE__;
function el(id){return document.getElementById(id)}
function show(id){['s-terms','s-code','s-profile','s-inactive'].forEach(function(s){el(s).classList.add('hide')});el(id).classList.remove('hide')}
function toStep(s){
  if(s==='profile'){
    var c=el('code').value.trim(); if(c.length<6){el('e-code').textContent='that code looks too short';return}
    el('e-code').textContent='';
  }
  show('s-'+s);
}
el('agree').addEventListener('change',function(){el('b-terms').disabled=!this.checked});
function doActivate(){
  var b=el('b-act'); b.disabled=true; b.textContent='activating…'; el('e-act').textContent='';
  fetch('/api/launcher/license/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    code:el('code').value.trim(), name:el('name').value.trim(), email:el('email').value.trim(),
    heard_from:el('heard').value, marketing_ok:el('mkt').checked, share_ai_ok:el('shareai').checked, terms_accepted:true
  })}).then(function(r){return r.json()}).then(function(j){
    if(j&&j.ok){ b.textContent='welcome to Plexus ✓'; setTimeout(function(){location.href='/'},700) }
    else{ el('e-act').textContent=(j&&j.error)||'activation failed — check the code and try again'; b.disabled=false; b.textContent='Activate Plexus' }
  }).catch(function(){ el('e-act').textContent='could not reach the activation service — check your connection'; b.disabled=false; b.textContent='Activate Plexus' });
}
function reActivate(){
  var c=el('re-code').value.trim(); if(c.length<6){el('e-re').textContent='that code looks too short';return}
  fetch('/api/launcher/license/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    code:c, name:(ST.name||''), email:(ST.email||''), terms_accepted:true, rejoin:true
  })}).then(function(r){return r.json()}).then(function(j){
    if(j&&j.ok){location.href='/'} else{el('e-re').textContent=(j&&j.error)||'that code did not work'}
  }).catch(function(){el('e-re').textContent='could not reach the activation service'});
}
function recheck(btn){
  btn.textContent='checking…';
  fetch('/api/launcher/license/recheck',{method:'POST'}).then(function(r){return r.json()}).then(function(j){
    if(j&&j.state==='active'){location.href='/'} else{btn.textContent='still paused — re-check again ⟲'}
  }).catch(function(){btn.textContent='no connection — re-check again ⟲'});
}
function toggleMsg(){el('sup').classList.toggle('hide')}
function sendSupport(){
  fetch('/api/launcher/support',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    subject:'License question', body:el('sup-body').value, include_log:false
  })}).then(function(){el('sup-ok').classList.remove('hide')}).catch(function(){el('sup-ok').textContent='could not send — email support@skyfynd.io';el('sup-ok').classList.remove('hide')});
}
(function boot(){
  if(ST.state==='inactive'){
    show('s-inactive');
    if(ST.reason==='expired'){ el('p-pill').textContent='TRIAL ENDED'; el('p-head').textContent='Your trial has ended';
      el('p-msg').textContent=ST.msg||'Thanks for trying Plexus. Enter your purchase code to keep going — everything is exactly where you left it.'; }
    else if(ST.reason==='unreachable'){ el('p-pill').textContent='LICENSE UNVERIFIED'; el('p-head').textContent="We couldn't verify your license";
      el('p-msg').textContent='Plexus could not reach the license service for over two weeks. One successful check restores everything.'; }
    else { el('p-msg').textContent=ST.msg||'Your license is currently paused. If you think this is a mistake, message us below.'; }
  } else show('s-terms');
})();
</script>
</body></html>`;
