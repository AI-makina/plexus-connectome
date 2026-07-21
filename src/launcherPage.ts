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
    /* Integration of the connectome-art palette: violet is the identity hue,
       rose/azure/jade/gold are the region accents. Surfaces are TRANSLUCENT
       (glassmorphism): every component that reads ink1/ink2 + line1/line2
       becomes glass automatically. */
    --ink0:#07060E; --ink1:rgba(255,255,255,.045); --ink2:rgba(255,255,255,.085);
    --line1:rgba(255,255,255,.09); --line2:rgba(255,255,255,.17);
    --hi:#EDEBF6; --mid:#A8A3BD; --lo:#6B6683; --ghost:#4A4660;
    --azure:#6FA8FF; --jade:#5FE3A1; --gold:#F5C044; --coral:#FF7E6B; --rose:#F26DC0;
    --violet:#A78BFA; --slate:#8B98A9; --ice:#D6D2E8; --crimson:#E5484D;
    --grad:linear-gradient(135deg,#8B5CF6 0%,#C452E8 55%,#EC4899 100%);
    --mono:'SF Mono',ui-monospace,Menlo,monospace; --sans:-apple-system,'Inter',sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:
      radial-gradient(900px 620px at 10% -6%, rgba(139,92,246,.17), transparent 62%),
      radial-gradient(820px 600px at 96% 14%, rgba(236,72,153,.11), transparent 58%),
      radial-gradient(1000px 720px at 6% 108%, rgba(96,165,250,.10), transparent 62%),
      radial-gradient(700px 520px at 88% 96%, rgba(95,227,161,.05), transparent 60%),
      var(--ink0);
    background-attachment:fixed;
    color:var(--hi);font:15px/1.5 var(--sans);min-height:100vh}
  ::selection{background:rgba(139,92,246,.4)}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:6px;border:2px solid transparent;background-clip:content-box}
  ::-webkit-scrollbar-track{background:transparent}
  /* ambient neon-synapse decorations (pure-black PNG → screen blend = transparent) */
  .deco{position:fixed;pointer-events:none;mix-blend-mode:screen;z-index:0;user-select:none}
  .deco-a{top:-140px;right:-160px;width:520px;opacity:.5;transform:rotate(24deg);filter:saturate(1.15)}
  .deco-b{bottom:-120px;left:-150px;width:380px;opacity:.32;transform:rotate(-142deg);filter:blur(1.5px) saturate(1.1)}
  .wrap{max-width:980px;margin:0 auto;padding:48px 24px 96px;position:relative;z-index:1}
  header{display:flex;align-items:center;gap:13px;margin-bottom:40px}
  /* Brand wordmark — the SAME identity as the connectome viz: Inter Variable,
     600, uppercase, .28em tracking (font-face declared below with the wizard). */
  header h1{font:600 19px/1 'Inter Variable',Inter,-apple-system,system-ui,sans-serif;
    text-transform:uppercase;letter-spacing:.28em;margin-right:-.28em;
    background:linear-gradient(92deg,#E4DCFF 0%,#F3B8E4 55%,#BBD4FF 100%);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  header .glyph{color:var(--violet);font-size:22px;filter:drop-shadow(0 0 10px rgba(167,139,250,.75))}
  /* The app icon as the logo mark — same asset the wizard brand row uses,
     scaled for the dashboard header with a soft violet halo. */
  .brand-icon{width:34px;height:34px;object-fit:contain;border-radius:8px;flex:none;
    box-shadow:0 4px 14px rgba(0,0,0,.5), 0 0 22px rgba(139,92,246,.28);user-select:none}
  header .tag{font:500 10px var(--mono);color:var(--lo);text-transform:uppercase;letter-spacing:.14em}
  .mono{font-family:var(--mono)}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:44px}
  .card{position:relative;background:var(--ink1);border:1px solid var(--line1);border-radius:16px;padding:26px;cursor:pointer;
    backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 10px 34px rgba(0,0,0,.35);
    transition:border-color .18s, transform .18s, box-shadow .18s;overflow:hidden}
  .card::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:radial-gradient(420px 190px at 14% -18%, rgba(139,92,246,.14), transparent 62%)}
  .card.connect::before{background:radial-gradient(420px 190px at 14% -18%, rgba(245,192,68,.11), transparent 62%)}
  .card.new::before{background:radial-gradient(420px 190px at 14% -18%, rgba(95,227,161,.11), transparent 62%)}
  .card:hover{border-color:rgba(167,139,250,.45);transform:translateY(-2px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.09), 0 16px 44px rgba(0,0,0,.45), 0 0 34px rgba(139,92,246,.12)}
  .card h2{font:600 16px var(--sans);margin-bottom:6px}
  .card p{color:var(--mid);font-size:13px}
  .card .k{font:500 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px;display:block}
  .card.new .k{color:var(--jade)} .card.connect .k{color:var(--gold)}
  h3.sect{font:500 11px var(--mono);color:var(--lo);letter-spacing:.14em;text-transform:uppercase;margin:34px 0 12px}
  .proj{background:var(--ink1);border:1px solid var(--line1);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:10px;
    backdrop-filter:blur(16px) saturate(1.25);-webkit-backdrop-filter:blur(16px) saturate(1.25);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 6px 22px rgba(0,0,0,.28);
    transition:border-color .16s, transform .16s, box-shadow .16s}
  .proj:hover{border-color:rgba(167,139,250,.34);transform:translateY(-1px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 10px 28px rgba(0,0,0,.36), 0 0 26px rgba(139,92,246,.10)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--lo);flex:none}
  .dot.on{background:var(--jade);box-shadow:0 0 10px var(--jade), 0 0 22px rgba(95,227,161,.5)}
  .proj .info{flex:1;min-width:0}
  .proj .name{font-weight:600;font-size:14px;display:flex;align-items:center;gap:9px}
  /* Fixed action grid: every button type in its own column, identical across
     cards — labels may change ("Open brain"/"Start + open") but widths never do. */
  .proj .pacts{display:grid;grid-template-columns:116px 116px 122px minmax(30px,auto);gap:8px;align-items:center;flex:none}
  .proj .pacts button{width:100%;text-align:center;white-space:nowrap;padding:7px 4px}
  .proj .pacts .xwrap{display:flex;gap:6px;justify-content:center;align-items:center}
  .proj .pacts .xwrap button{width:auto;padding:7px 9px}
  .proj .path{font:11px var(--mono);color:var(--lo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .proj .ports{font:10px var(--mono);color:var(--mid)}
  button{background:var(--ink2);color:var(--hi);border:1px solid var(--line2);border-radius:9px;padding:7px 14px;font:500 12px var(--sans);cursor:pointer;
    transition:border-color .15s, box-shadow .15s, transform .12s}
  button:hover{border-color:rgba(167,139,250,.5);box-shadow:0 0 16px rgba(139,92,246,.16)}
  button:active{transform:scale(.97)}
  button.primary{background:var(--grad);border:none;color:#fff;font-weight:600;
    box-shadow:0 4px 18px rgba(139,92,246,.35), inset 0 1px 0 rgba(255,255,255,.25)}
  button.primary:hover{filter:brightness(1.12);box-shadow:0 6px 24px rgba(196,82,232,.45), inset 0 1px 0 rgba(255,255,255,.25)}
  button.ghost{background:transparent;border-color:transparent;color:var(--lo);box-shadow:none}
  button.ghost:hover{color:var(--ice);border-color:var(--line1);box-shadow:none}
  button:disabled{opacity:.45;cursor:default;box-shadow:none}
  .view{display:none}.view.active{display:block}
  label{display:block;font:500 10px var(--mono);color:var(--mid);letter-spacing:.12em;text-transform:uppercase;margin:18px 0 6px}
  input[type=text],textarea{width:100%;background:rgba(0,0,0,.28);border:1px solid var(--line1);border-radius:9px;color:var(--hi);padding:10px 12px;font:13px var(--sans);transition:border-color .15s, box-shadow .15s}
  textarea{font-family:var(--mono);font-size:12px;resize:vertical;min-height:56px}
  input:focus,textarea:focus{outline:none;border-color:rgba(167,139,250,.65);box-shadow:0 0 0 3px rgba(139,92,246,.14)}
  .q{border-left:2px solid var(--line2);padding-left:14px;margin-bottom:4px}
  .q .region{font:500 10px var(--mono);letter-spacing:.1em;text-transform:uppercase}
  .hint{font-size:12px;color:var(--lo);margin-top:4px}
  .row{display:flex;gap:10px;align-items:center}
  .grow{flex:1}
  .back{color:var(--lo);font:12px var(--mono);cursor:pointer;margin-bottom:22px;display:inline-block}
  .back:hover{color:var(--mid)}
  .result{background:var(--ink1);border:1px solid var(--line1);border-radius:16px;padding:22px;margin-top:20px;
    backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 10px 30px rgba(0,0,0,.32)}
  .result h4{font-size:14px;margin-bottom:10px}
  .cmd{background:rgba(0,0,0,.42);border:1px solid var(--line1);border-radius:9px;padding:10px 12px;font:11px var(--mono);color:var(--ice);word-break:break-all;cursor:pointer;margin:8px 0;transition:border-color .15s, box-shadow .15s}
  .cmd:hover{border-color:rgba(167,139,250,.5);box-shadow:0 0 14px rgba(139,92,246,.14)}
  .qa{font-size:12px;color:var(--mid);padding:6px 0;border-bottom:1px solid var(--line1)}
  .bar{display:flex;gap:2px;height:10px;border-radius:3px;overflow:hidden;margin:10px 0}
  .bar div{min-width:2px}
  .status{font:12px var(--mono);color:var(--gold);margin:14px 0;min-height:18px}
  /* ── Folder picker (fallback modal — macOS gets the native dialog) ── */
  .picker{width:100%;max-width:560px;background:rgba(16,13,28,.72);border:1px solid var(--line2);border-radius:18px;display:flex;flex-direction:column;max-height:72vh;
    backdrop-filter:blur(26px) saturate(1.35);-webkit-backdrop-filter:blur(26px) saturate(1.35);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 24px 70px rgba(0,0,0,.6), 0 0 60px rgba(139,92,246,.10)}
  .pk-head{padding:14px 16px 10px;border-bottom:1px solid var(--line1)}
  .pk-title{font:600 13px var(--sans);margin-bottom:8px}
  .crumbs{display:flex;flex-wrap:wrap;gap:2px;align-items:center;font:11px var(--mono)}
  .crumb{color:var(--azure);cursor:pointer;padding:2px 5px;border-radius:4px}
  .crumb:hover{background:var(--ink2)}
  .crumb.cur{color:var(--hi);cursor:default}
  .crumb.cur:hover{background:transparent}
  .crumb-sep{color:var(--ghost);padding:0 1px}
  .places{display:flex;gap:6px;padding:9px 16px;border-bottom:1px solid var(--line1);flex-wrap:wrap}
  .place{font:11px var(--sans);color:var(--mid);background:var(--ink2);border:1px solid var(--line1);border-radius:14px;padding:3px 11px;cursor:pointer;transition:border-color .15s,color .15s}
  .place:hover{color:var(--hi);border-color:rgba(167,139,250,.5)}
  .pk-filter{margin:10px 16px 4px}
  .pk-filter input{width:100%;background:var(--ink0);border:1px solid var(--line1);border-radius:6px;color:var(--hi);padding:6px 10px;font:12px var(--sans)}
  .pk-filter input:focus{outline:none;border-color:var(--azure)}
  .pk-list{flex:1;overflow:auto;padding:6px 8px;min-height:180px}
  .pk-row{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:6px;cursor:pointer;font:13px var(--sans);color:var(--mid)}
  .pk-row:hover{background:var(--ink2);color:var(--hi)}
  .pk-empty{color:var(--ghost);font-size:12px;padding:16px}
  .pk-foot{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--line1)}
  .pk-path{flex:1;font:10.5px var(--mono);color:var(--lo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
  .wiz{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100;padding:24px;overflow:hidden;
    background:
      radial-gradient(120% 90% at 50% 0%, rgba(139,92,246,.14) 0%, transparent 55%),
      radial-gradient(90% 70% at 85% 90%, rgba(236,72,153,.08) 0%, transparent 55%),
      radial-gradient(120% 90% at 50% 0%, #120F1E 0%, #07060E 62%)}
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
  .clientrow{display:flex;align-items:center;gap:12px;background:var(--ink1);border:1px solid var(--line1);border-radius:12px;padding:12px 15px;margin:8px 0;text-align:left;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
  .clientrow .ci{flex:1;min-width:0}.clientrow .ci b{font-size:14px}
  .clientrow .c-state{font:10px var(--mono);color:var(--lo);margin-left:8px;text-transform:uppercase;letter-spacing:.06em}
  .clientrow .c-hint{font-size:10.5px;color:var(--lo);margin-top:2px;line-height:1.4}
  .opt-label{font:600 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--azure);margin:16px 0 8px;text-align:left}
  .opt-note{font-size:11px;color:var(--lo);text-align:left;margin:8px 0 2px;line-height:1.5}
  .clientrow .ok{color:var(--jade);font-size:16px}
  .wiz-ok{color:var(--jade);font-size:13px;margin:10px 0;background:rgba(115,201,145,.1);border:1px solid rgba(115,201,145,.3);border-radius:8px;padding:9px 12px}
  .wiz-manual{font-size:12px;color:var(--mid);text-align:left;margin:10px 0}
  .wiz-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
  .wiz-choice{background:var(--ink1);border:1px solid var(--line1);border-radius:14px;padding:20px 18px;cursor:pointer;text-align:left;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    transition:border-color .15s,transform .15s,box-shadow .15s}
  .wiz-choice:hover{border-color:rgba(167,139,250,.55);transform:translateY(-1px);box-shadow:0 0 26px rgba(139,92,246,.14)}
  .wiz-choice b{display:block;font-size:15px;margin-bottom:5px}
  .wiz-choice span{color:var(--mid);font-size:12px;line-height:1.5}
  .powered{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:26px;color:var(--lo);font:11px var(--mono);letter-spacing:.04em}
  .powered img{height:16px;width:auto;opacity:.85}
  .modal{position:fixed;inset:0;background:rgba(5,4,12,.55);display:none;align-items:center;justify-content:center;z-index:90;padding:24px;
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .modal.show{display:flex}
  .modal-card{width:100%;max-width:420px;background:rgba(16,13,28,.74);border:1px solid var(--line2);border-radius:18px;padding:22px;
    backdrop-filter:blur(26px) saturate(1.35);-webkit-backdrop-filter:blur(26px) saturate(1.35);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 24px 70px rgba(0,0,0,.6)}
  .modal-card h3{font-size:16px;margin-bottom:4px}
  .rm-path{font:11px var(--mono);color:var(--lo);word-break:break-all;margin-bottom:14px}
  .rm-clients{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .rm-clients button{width:100%;text-align:left}
  .powered-foot{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:56px;padding-top:22px;border-top:1px solid var(--line1);color:var(--lo);font:11px var(--mono);letter-spacing:.04em}
  .powered-foot img{height:18px;opacity:.8}
  /* Skyfynd.io is a live link in both branding spots (the video overlay is
     pointer-events:none, so the anchor re-enables its own clicks). */
  .powered-foot a,.vid-powered a{color:inherit;text-decoration:none;border-bottom:1px solid rgba(207,211,218,.35);transition:color .15s,border-color .15s}
  .powered-foot a:hover,.vid-powered a:hover{color:var(--violet);border-color:var(--violet)}
  .vid-powered a{pointer-events:auto}
  /* ── Top-right burger menu + Launch Guide ── */
  .burger-wrap{position:relative}
  .burger{cursor:pointer;color:var(--lo);font-size:17px;line-height:1;padding:2px 7px;border-radius:7px;transition:color .15s,background .15s}
  .burger:hover{color:var(--ice);background:var(--ink2)}
  .menu{display:none;position:absolute;right:0;top:27px;min-width:172px;background:rgba(16,13,28,.85);border:1px solid var(--line2);border-radius:12px;padding:6px;z-index:60;
    backdrop-filter:blur(22px) saturate(1.35);-webkit-backdrop-filter:blur(22px) saturate(1.35);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 16px 44px rgba(0,0,0,.55)}
  .menu.show{display:block}
  .menu-item{padding:9px 12px;border-radius:8px;font:500 12.5px var(--sans);color:var(--hi);cursor:pointer;white-space:nowrap}
  .menu-item:hover{background:rgba(139,92,246,.16)}
  .guide{max-width:640px;max-height:82vh;overflow:auto}
  .guide h3{font:600 17px var(--sans);margin-bottom:2px}
  .guide .g-sub{color:var(--mid);font-size:12.5px;margin-bottom:14px}
  .g-rule{background:rgba(139,92,246,.12);border:1px solid rgba(167,139,250,.35);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.55;margin-bottom:14px;color:var(--mid)}
  .g-rule b{color:var(--ice)}
  .g-item{display:flex;gap:12px;padding:11px 2px;border-bottom:1px solid var(--line1);font-size:12.5px;line-height:1.55;color:var(--mid)}
  .g-item:last-of-type{border-bottom:none}
  .g-item .n{flex:none;width:22px;height:22px;border-radius:7px;background:var(--grad);color:#fff;font:600 11px var(--mono);display:flex;align-items:center;justify-content:center;margin-top:1px}
  .g-item b{color:var(--hi)}
  .g-item .mono{font-size:11px;color:var(--ice)}
  .menu-sec{font:600 9.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--lo);padding:7px 12px 2px}
  /* Open-project picker rows: selected = violet ring; disabled = detected but not Plexus-capable */
  .rm-clients button.sel{border-color:rgba(167,139,250,.65);box-shadow:0 0 16px rgba(139,92,246,.22)}
  .rm-clients button.dis{opacity:.45;cursor:default}
  .rm-clients button.dis:hover{border-color:var(--line2);box-shadow:none}
  .rm-sub{float:right;font:10px var(--mono);color:var(--lo);margin-left:10px}
  .rm-sub .warn-a{color:var(--gold);font-weight:600}
  .codexhow{background:var(--ink1);border:1px solid var(--line1);border-radius:12px;padding:11px 13px;font-size:12px;color:var(--mid);line-height:1.55;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
  .codexhow b{color:var(--hi)}
  /* Per-card AI-connection status (mirror of Claude Code's recorded choice) + re-arm */
  .mcpstat{font:10px var(--mono);color:var(--lo);margin-top:2px}
  .mcpstat .ok-j{color:var(--jade);font-weight:600}
  .mcpstat .warn-a{color:var(--gold);font-weight:600}
  .mcpstat .ghosty{color:var(--ghost)}
  .rearm{color:var(--azure);cursor:pointer}
  .rearm:hover{color:var(--violet)}
  .rearmnote{color:var(--gold);font-weight:600;text-shadow:0 0 9px rgba(245,192,68,.65), 0 0 20px rgba(245,192,68,.3);animation:pulse 2.2s ease-in-out infinite}
  .qmark{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:1px solid var(--line2);color:var(--lo);font:600 9px var(--mono);cursor:pointer;vertical-align:middle;transition:background .15s,color .15s,border-color .15s}
  .qmark:hover{color:var(--ice);border-color:rgba(167,139,250,.55)}
  /* click-to-open glass popover; the ? fills violet while open */
  .qwrap{position:relative;display:inline-flex}
  .qwrap.open .qmark{background:var(--violet);color:#0A0714;border-color:var(--violet)}
  .qpop{display:none;position:absolute;left:50%;transform:translateX(-50%);bottom:23px;width:272px;
    background:rgba(16,13,28,.92);border:1px solid rgba(167,139,250,.4);border-radius:11px;padding:10px 12px;
    font:11.5px var(--sans);color:var(--ice);line-height:1.55;z-index:70;text-align:left;letter-spacing:0;text-transform:none;white-space:normal;
    backdrop-filter:blur(20px) saturate(1.3);-webkit-backdrop-filter:blur(20px) saturate(1.3);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 10px 30px rgba(0,0,0,.5), 0 0 24px rgba(139,92,246,.12)}
  .qpop::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(167,139,250,.4)}
  .qwrap.open .qpop{display:block}
</style>
</head>
<body>

<!-- ambient decoration: the neon synapse (pure-black PNG → screen blend melts it into the page) -->
<img class="deco deco-a" src="/assets/launcher/neon_plexus.png" alt="">
<img class="deco deco-b" src="/assets/launcher/neon_plexus.png" alt="">

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
        <div class="vid-powered"><img src="/assets/launcher/skyfynd_logo.png" alt="SkyFynd"> Powered by&nbsp;<a href="https://skyfynd.io" target="_blank" rel="noopener">Skyfynd.io</a></div>
      </div>
    </div>
    <!-- step 2 · how Plexus connects (per project — nothing to install) -->
    <div class="wstep" data-step="2">
      <div class="wiz-brand"><img src="/assets/launcher/plexus_icon_2_ultrablack.png" alt=""><span class="wiz-wordmark">Plexus</span></div>
      <div class="wiz-h">Plexus connects per project</div>
      <div class="wiz-p">Nothing to install — and no AI is ever permanently connected. Every project you create or connect here carries its own Plexus connection inside its folder: open your AI there and it finds the brain automatically, asking your permission once per project. Anywhere else, your AI stays exactly as it is — plexus-free.</div>
      <div style="text-align:left">
        <div style="text-align:center;margin:6px 0 4px"><button class="primary" id="wiz-search" onclick="wizSearch(this)">⌕ See which AI apps this Mac has</button></div>
        <div id="wiz-clients"></div>
      </div>
      <div id="wiz-connect-result"></div>
      <div class="wiz-actions">
        <button class="primary" onclick="wizStep(3)">Next</button>
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

<!-- ── FOLDER PICKER (fallback modal — macOS uses the native dialog) ── -->
<div class="modal" id="picker-modal">
  <div class="picker">
    <div class="pk-head">
      <div class="pk-title" id="pk-title">Choose a folder</div>
      <div class="crumbs" id="pk-crumbs"></div>
      <div class="hint" id="pk-hint" style="margin-top:6px"></div>
    </div>
    <div class="places" id="pk-places"></div>
    <div class="pk-filter"><input id="pk-filter" placeholder="filter folders…" oninput="renderPickerList()"></div>
    <div class="pk-list" id="pk-list"></div>
    <div class="pk-foot">
      <span class="pk-path" id="pk-path"></span>
      <button class="ghost" onclick="closePicker()">Cancel</button>
      <button class="primary" onclick="choosePicker()">Choose this folder</button>
    </div>
  </div>
</div>

<!-- ── RESUME WITH AI (per project) ── -->
<div class="modal" id="resume-modal" onclick="if(event.target===this)closeResume()">
  <div class="modal-card">
    <h3>Open project</h3>
    <div class="rm-path" id="rm-path"></div>
    <div class="opt-label">1 · Code editor</div>
    <div class="rm-clients" id="rm-editors"><div class="hint">detecting editors…</div></div>
    <div class="opt-label">2 · AI to engage</div>
    <div class="rm-clients" id="rm-ais"></div>
    <div style="text-align:center;margin:10px 0 4px"><button class="primary" id="rm-open" onclick="doOpenProject(this)">Open</button></div>
    <div class="cmd" id="rm-cmd" onclick="copyText(this.textContent,null)"></div>
    <div class="hint" id="rm-note">A new editor window opens anchored to this Plexus project — your chosen AI starts automatically in its terminal.</div>
    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center"><span class="wiz-skip" onclick="rescanResume(this)">⌕ search again</span><button class="ghost" onclick="closeResume()">close</button></div>
  </div>
</div>

<!-- ── LAUNCH GUIDE (burger menu) ── -->
<div class="modal" id="guide-modal" onclick="if(event.target===this)closeGuide()">
  <div class="modal-card guide">
    <h3>Launch Guide</h3>
    <div class="g-sub">How projects, windows, and terminals connect.</div>
    <div class="g-rule"><b>The golden rule:</b> the folder a terminal is in when you <b>start</b> the AI decides everything — which Plexus project (if any) the session belongs to and which brain it loads. Move first, then start the AI. A running AI can never be re-pointed to another folder or project. And there is <b>nothing to install</b>: no AI is ever permanently connected to Plexus — every Plexus project carries its own connection inside its folder, and AIs opened anywhere else stay plexus-free.</div>
    <div class="g-item"><span class="n">1</span><span><b>Opening a Plexus project — "Open project".</b> Always opens the Plexus project in its own editor window, never inside an existing window. Pick a detected code editor and the AI to engage: the window opens anchored to that Plexus project with a terminal already running your chosen AI (approve the editor's one-time trust question if it asks). Every terminal you open inside that window starts linked to the project automatically.</span></div>
    <div class="g-item"><span class="n">2</span><span><b>One window per Plexus project.</b> A window is not the same as a terminal: the window is the whole editor frame, and terminals are the command panels that run <b>inside</b> a window. Every Plexus project you open gets its <b>own</b> window — opening a second Plexus project never touches the first. Two projects side by side means two windows, each with its own brain, engine, and terminals, fully independent.</span></div>
    <div class="g-item"><span class="n">3</span><span><b>Working on Plexus project B from inside project A's window.</b> Open a new terminal there (it starts linked to A). Copy B's <b>connect code</b> from its card, paste it in the terminal <b>before engaging the AI</b> — the terminal moves to B and the AI starts already linked to B. Never paste a connect code into an AI chat: it only works in the terminal. When that AI exits, the terminal falls back to A — to return to B, paste the code again, always before engaging the AI.</span></div>
    <div class="g-item"><span class="n">4</span><span><b>Non-Plexus work from inside a Plexus project's window.</b> Open a new terminal (it starts linked to the Plexus project). <b>Before engaging the AI</b>, move the terminal out: type <span class="mono">cd&nbsp;</span>, paste your non-Plexus folder's path, press enter — then engage the AI. That folder must live <b>outside</b> the Plexus project's folder, because anything inside a Plexus project's folder is treated as part of that Plexus project. The window's sidebar will still show the Plexus project — only that terminal points elsewhere.</span></div>
    <div class="g-item"><span class="n">5</span><span><b>The first-time permission question.</b> The first time you engage an AI inside a Plexus project, it asks whether to use the Plexus connection it found in that project's folder. Choose <b>"Use this MCP server"</b> — it approves exactly what you can see, once per project, never asked again. (Skip "all future MCP servers": that pre-approves anything that might appear in the file someday; with the recommended option, a newcomer simply gets its own one-time question — your tripwire.) Changed your mind, or declined by accident? Each project card on the dashboard shows its current answer (approved / declined / awaiting) with a <b>re-arm ⟲</b> action — one click and the question returns on your next session, approving nothing by itself (same as running <span class="mono">claude mcp reset-project-choices</span> inside the project).</span></div>
    <div class="g-item"><span class="n">6</span><span><b>Know which project a session belongs to.</b> Every AI session connected to a Plexus project begins its replies with the badge <span class="mono">⬡ plexus active — name</span>. One glance at any terminal tells you exactly which Plexus project it is working on. No badge means that session is not connected to any Plexus project.</span></div>
    <div class="g-item"><span class="n">7</span><span><b>If you ask for the wrong project.</b> If you start describing work that belongs to a different project while inside the wrong session, Plexus stops before anything is written and shows you how to open the right project instead. Nothing mixes silently.</span></div>
    <div class="g-item"><span class="n">8</span><span><b>Coming back later.</b> To continue a Plexus project tomorrow — or after closing everything — open it the same way as the first time: click <b>Open project</b> on its card, or paste its connect code in a fresh terminal before engaging the AI (codes never expire). The new session automatically finds the project's brain and memory, which live inside the project's folder, and picks up where the last session left off. You never re-explain anything.</span></div>
    <div style="margin-top:14px;text-align:right"><button class="ghost" onclick="closeGuide()">close</button></div>
  </div>
</div>

<!-- ── MANAGE CONNECTIONS (burger menu) ── -->
<div class="modal" id="tools-modal" onclick="if(event.target===this)closeTools()">
  <div class="modal-card guide" style="max-width:560px">
    <h3>Manage connections</h3>
    <div class="g-sub">Plexus never installs itself into an AI or an editor — each Plexus project connects on its own. This is where you see what's on this Mac and add new AI CLIs.</div>
    <div class="opt-label">Code editors</div>
    <div id="tools-editors"></div>
    <div class="opt-label">AIs</div>
    <div id="tools-ais"></div>
    <div class="opt-label">Add an AI (any agent CLI on your PATH)</div>
    <div class="row" style="margin:6px 0"><input type="text" id="addai-bin" placeholder="command, e.g. claude" style="max-width:160px"><input type="text" id="addai-label" placeholder="display name (optional)" style="max-width:180px"></div>
    <label style="display:flex;align-items:center;gap:7px;margin:8px 0;text-transform:none;letter-spacing:0;font:12px var(--sans);color:var(--mid)"><input type="checkbox" id="addai-mcp"> MCP-capable — it reads the project's .mcp.json (required for Plexus work)</label>
    <div class="row"><button class="primary" onclick="addCustomAi(this)">Add</button><span class="hint" id="addai-note"></span></div>
    <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center"><span class="wiz-skip" onclick="rescanTools(this)">⌕ search again</span><button class="ghost" onclick="closeTools()">close</button></div>
  </div>
</div>

<!-- ── AI GUIDELINES (burger menu) ── -->
<div class="modal" id="aiguide-modal" onclick="if(event.target===this)closeAiGuide()">
  <div class="modal-card guide">
    <h3>AI Guidelines</h3>
    <div class="g-sub">Which AIs can do Plexus work, and why.</div>
    <div class="g-rule"><b>The rule:</b> only <b>MCP-capable</b> AIs can use a Plexus brain. MCP (Model Context Protocol) is the open standard an AI uses to talk to tools like Plexus — without it, an AI opened in a Plexus project works <b>blind</b>: no claim checks, no consultations, no memory, no protection. That defeats the purpose of Plexus, so non-MCP AIs are detected and listed, but never selectable for Plexus work.</div>
    <div class="g-item"><span class="n">1</span><span><b>Starting is automatic for every AI.</b> Whichever AI you pick in "Open project" starts by itself in the project window's terminal — Claude, Gemini, an enabled Codex, or any MCP-capable AI you've added. What differs between them is only how each one <b>connects to the Plexus brain</b> (next two points).</span></div>
    <div class="g-item"><span class="n">2</span><span><b>Zero-setup connection: Claude Code and Gemini CLI.</b> Every Plexus project carries their connection files inside its folder, written automatically when the project is created or connected — nothing to configure, ever, including for future projects. Claude asks your permission once per project; for Gemini, the ⬡ badge in its first reply is your confirmation.</span></div>
    <div class="g-item"><span class="n">3</span><span><b>Codex CLI — global-only, connected by YOUR hands.</b> Codex only supports a global, always-on connection (OpenAI's design), and Plexus <b>never connects any AI globally</b>. So when you tap Codex in "Open project", Plexus shows you a statement and a command — <b>you</b> copy it and run it in any terminal, once per machine. From then on Codex is fully automatic in every Plexus project (and dormant everywhere else), and it wears a <b>global</b> tag so the exception stays visible. <b>Disengage</b> (☰ → Manage connections) removes Plexus from Codex on one click — removal only ever shrinks Plexus's reach, which is why a button may do it; reconnecting later is the same one-time paste.</span></div>
    <div class="g-item"><span class="n">4</span><span><b>Built-in editor agents.</b> Copilot, Cursor's agent, and Antigravity's agent live inside their editors and cannot be launched or paired from outside. Choose "None — just open the editor" and use them there. Their per-project Plexus connection also ships later.</span></div>
    <div class="g-item"><span class="n">5</span><span><b>Adding a new or open-source AI.</b> Under ☰ → Manage connections, add any AI by its command name. Mark it MCP-capable only if it reads the project's <span class="mono">.mcp.json</span> — then it becomes selectable for Plexus work. Unmarked AIs stay listed but non-selectable.</span></div>
    <div class="g-item"><span class="n">6</span><span><b>AIs are never "linked" to an editor.</b> AI CLIs are system-wide: any detected AI works with any editor, instantly — Plexus assembles the pairing fresh each time you open a project. Nothing to configure inside the editor's settings.</span></div>
    <div style="margin-top:14px;text-align:right"><button class="ghost" onclick="closeAiGuide()">close</button></div>
  </div>
</div>

<div class="wrap">
  <header>
    <img class="brand-icon" src="/assets/launcher/plexus_icon_1.png" alt=""><h1>PLEXUS</h1><span class="tag">launcher · evidence protocol</span>
    <span style="margin-left:auto;display:flex;gap:16px;align-items:baseline">
      <span onclick="replayIntro()" style="cursor:pointer;color:var(--lo);font:500 11px var(--mono)" title="watch the Plexus intro again">intro ⟲</span>
      <a href="/manager" style="color:var(--azure);text-decoration:none;font:500 12px var(--sans)">Manager →</a>
      <span class="burger-wrap">
        <span class="burger" onclick="toggleMenu(event)" title="menu">☰</span>
        <div class="menu" id="topmenu">
          <div class="menu-sec">Guidelines</div>
          <div class="menu-item" onclick="openGuide()">Launch Guide</div>
          <div class="menu-item" onclick="openAiGuide()">AI Guidelines</div>
          <div class="menu-sec">Connections</div>
          <div class="menu-item" onclick="openTools()">Manage connections</div>
        </div>
      </span>
    </span>
  </header>

  <!-- HOME -->
  <div class="view active" id="v-home">
    <div class="result" style="margin:0 0 18px;border-color:#2A3550">
      <h4 style="color:var(--azure)" id="conn-head">⬡ Checking your AI connections…</h4>
      <p class="hint" id="conn-sub" style="margin:2px 0 6px"></p>
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
      <div class="grow"><label>Create inside</label><div class="row"><input type="text" id="np-base" class="grow"><button onclick="pickFolder('np-base','Choose where to create your project')">browse…</button></div></div>
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
    <div class="row"><input type="text" id="cx-path" class="grow"><button onclick="pickFolder('cx-path','Choose your project folder')">browse…</button></div>
    <div class="status" id="cx-status"></div>
    <button class="primary" id="cx-go" onclick="connectProject()">Connect — map this codebase</button>
    <div id="cx-result"></div>
  </div>

  <footer class="powered-foot"><img src="/assets/launcher/skyfynd_logo.png" alt="SkyFynd"> Powered by&nbsp;<a href="https://skyfynd.io" target="_blank" rel="noopener">Skyfynd.io</a></footer>
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
  PROJECTS = r.projects || [];
  document.getElementById('np-base').value ||= r.default_base;
  const el = document.getElementById('projects');
  if(!r.projects.length){el.innerHTML='<p class="hint">No brains yet — create or connect a project with the cards above; each one carries its own AI connection.</p>';return;}
  el.innerHTML = r.projects.map(p=>\`
    <div class="proj">
      <div class="dot \${p.running?'on':''}"></div>
      <div class="info">
        <div class="name">\${esc(p.name)} <span class="badge \${p.kind==='genesis'?'gen':''}">\${p.kind}</span></div>
        <div class="path">\${esc(p.path)}</div>
        <div class="ports">api :\${p.api_port} · brain :\${p.ws_port}</div>
        <div class="ports" id="pulse-\${p.api_port}"></div>
        <div class="mcpstat" id="mcp-\${p.api_port}" data-path="\${esc(p.path)}">\${mcpStatusHtml(p)}</div>
      </div>
      <div class="pacts">
        <button onclick="resumeWith('\${esc(p.path)}')" title="open this Plexus project in a code editor with your chosen AI already engaged">Open project</button>
        <button onclick="serveProject('\${esc(p.path)}', \${p.ws_port})">\${p.running?'Open brain':'Start + open'}</button>
        <button class="ghost" title="Copy this project's connect code — paste it in a TERMINAL (not into an AI chat) and that terminal becomes this project's AI session, wherever it started." onclick="copyText(\\\`\${esc(p.connect_code||'')}\\\`, this)">connect code ⧉</button>
        <span class="xwrap"><button class="ghost" title="Remove from the launcher list (nothing on disk is touched) — asks to confirm, then offers Undo." onclick="askForget(this,'\${esc(p.path)}')">✕</button></span>
      </div>
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
      // LIVE AI-connection signal: the brain was consulted recently ⇒ engaged —
      // the engine's own activity feed, which cannot lie (Claude's approval
      // record is ambiguous in 2.1.215, so it only ever earns explicit states).
      if(ago!==null && ago<360){
        const ms = document.getElementById('mcp-'+p.api_port);
        if(ms && !REARMED[ms.getAttribute('data-path')] && ms.textContent.indexOf('?')!==-1){
          ms.innerHTML = 'AI connection: <b class="ok-j">active ✓</b> <span class="ghosty">· used '+(ago<1?'just now':(ago<60? ago+'m ago' : Math.round(ago/60)+'h ago'))+'</span> · '+rearmLink(ms.getAttribute('data-path'));
        }
      }
    }).catch(()=>{});
  }
}
async function serveProject(p, uiPort){
  await fetch('/api/launcher/serve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});
  window.open('http://localhost:'+uiPort,'_blank');
  setTimeout(loadProjects,1200);
}
// Two-step confirm for ✕ (inline, no blocking browser dialog): the ✕ arms into
// "forget ✓ / ✗ keep"; untouched for 6s it disarms itself. Confirming runs
// forget(), which still offers the Undo toast afterwards — two layers of guard.
function askForget(btn, p){
  const yes=document.createElement('button'); yes.className='ghost'; yes.textContent='forget ✓';
  yes.style.color='var(--coral)'; yes.style.borderColor='var(--coral)';
  const cancel=document.createElement('button'); cancel.className='ghost'; cancel.textContent='✗ keep';
  const disarm=()=>{ yes.remove(); cancel.remove(); btn.style.display=''; };
  yes.onclick=()=>{ disarm(); forget(p); };
  cancel.onclick=disarm;
  btn.style.display='none';
  btn.after(yes, cancel);
  setTimeout(()=>{ if(document.body.contains(yes)) disarm(); }, 6000);
}
let LAST_FORGOTTEN=null, TOAST_TIMER=null;
async function forget(p){
  const r = await fetch('/api/launcher/forget',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})}).then(x=>x.json());
  LAST_FORGOTTEN = r.removed || null;
  loadProjects();
  if(LAST_FORGOTTEN) showUndoToast(LAST_FORGOTTEN.name);
}
function showUndoToast(name){
  dismissToast();
  const t=document.createElement('div'); t.id='undo-toast';
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#141B2E;border:1px solid var(--azure);border-radius:10px;padding:10px 16px;font:13px var(--mono);color:#E6EDF3;display:flex;gap:14px;align-items:center;z-index:99;box-shadow:0 6px 24px rgba(0,0,0,.5)';
  const s=document.createElement('span'); s.textContent='"'+name+'" removed from the launcher (files untouched)';
  const b=document.createElement('button'); b.textContent='Undo';
  b.style.cssText='background:var(--azure);border:none;color:#0A0F1E;font-weight:600;border-radius:6px;padding:4px 12px;cursor:pointer';
  b.onclick=undoForget;
  t.appendChild(s); t.appendChild(b); document.body.appendChild(t);
  TOAST_TIMER=setTimeout(dismissToast, 8000);
}
function dismissToast(){ if(TOAST_TIMER){clearTimeout(TOAST_TIMER);TOAST_TIMER=null;} const t=document.getElementById('undo-toast'); if(t) t.remove(); }
async function undoForget(){
  if(!LAST_FORGOTTEN) return dismissToast();
  await fetch('/api/launcher/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entry:LAST_FORGOTTEN})});
  LAST_FORGOTTEN=null; dismissToast(); loadProjects();
}
function copyText(t, btn){navigator.clipboard.writeText(t);if(btn){const o=btn.textContent;btn.textContent='copied ✓';setTimeout(()=>btn.textContent=o,1500);}}

// AI-connection status per card: mirrors what Claude Code recorded for this
// project's permission question; re-arm resets it from ANY state (approving
// nothing) so the question returns on the next session.
var REARMED={}; // paths re-armed this page-visit: keep the instruction visible across card re-renders
function rearmLink(path){
  return '<span class="rearm" data-p="'+esc(path)+'" onclick="rearmMcp(this)" title="Resets the recorded choice for this project — approves nothing by itself; the next AI session here shows the permission question again.">re-arm ⟲</span>';
}
function mcpStatusHtml(p){
  if(REARMED[p.path]) return 'AI connection: <span class="rearmnote">re-armed ✓ — close the open terminal(s) for this project; the permission question returns on the next session</span>';
  var re=rearmLink(p.path);
  var s=p.mcp_status;
  // which option was chosen, when the record knows (1 = plexus only, 2 = blanket)
  var optTag = s==='approved' ? ' <b class="ok-j">· Plexus MCP only</b>'
             : s==='approved_all' ? ' <b class="ok-j">· Plexus + ALL future MCPs</b>' : '';
  // ground truth first: a live plexus process anchored in this project right now
  if(p.live_session) return 'AI connection: <b class="ok-j">connected ✓</b> <span class="ghosty">· session open now</span>'+optTag+' · '+re;
  if(s==='approved') return 'AI connection: <b class="ok-j">approved ✓ · Plexus MCP only</b> · '+re;
  if(s==='approved_all') return 'AI connection: <b class="ok-j">approved ✓ · Plexus + ALL future MCPs</b> · '+re+' <span class="ghosty">(re-arm to pick the narrower option)</span>';
  if(s==='declined') return 'AI connection: <b class="warn-a">declined ⚠</b> — sessions here run without Plexus · '+re;
  if(s==='unasked') return 'AI connection: <span class="qwrap"><span class="qmark" onclick="toggleQ(this,event)">?</span><span class="qpop">Awaiting first session — the AI will ask to approve Plexus the first time you open this project. Choose "Use this MCP server".</span></span> · '+re;
  return '';
}
function rearmMcp(el){
  var p=el.getAttribute('data-p');
  el.textContent='re-arming…';
  fetch('/api/launcher/rearm-mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})})
    .then(function(x){return x.json();}).then(function(r){
      if(r.ok){ REARMED[p]=true; loadProjects(); }
      else { el.textContent='re-arm failed'+(r.error?': '+r.error:''); }
    }).catch(function(){ el.textContent='re-arm failed'; });
}

// burger menu + launch guide
function toggleMenu(e){ e.stopPropagation(); document.getElementById('topmenu').classList.toggle('show'); }
document.addEventListener('click', function(e){
  var m=document.getElementById('topmenu');
  if(m && m.classList.contains('show') && !e.target.closest('.burger-wrap')) m.classList.remove('show');
  if(!e.target.closest('.qwrap')) document.querySelectorAll('.qwrap.open').forEach(function(x){ x.classList.remove('open'); });
});
function toggleQ(el, e){
  e.stopPropagation();
  var w=el.parentElement, was=w.classList.contains('open');
  document.querySelectorAll('.qwrap.open').forEach(function(x){ x.classList.remove('open'); });
  if(!was) w.classList.add('open');
}
function openGuide(){ document.getElementById('topmenu').classList.remove('show'); document.getElementById('guide-modal').classList.add('show'); }
function closeGuide(){ document.getElementById('guide-modal').classList.remove('show'); }

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

// ── Folder picking: native macOS dialog first; the in-page modal as fallback ──
async function pickFolder(inputId, title){
  var inp = document.getElementById(inputId);
  var r = await fetch('/api/launcher/pick-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:inp.value, prompt:title})})
    .then(function(x){return x.json();}).catch(function(){return {unsupported:true};});
  if(r.path){ inp.value = r.path; return; }
  if(r.cancelled) return;
  openPicker(inputId, title); // fallback modal
}

var PK = { input:null, path:'', dirs:[], hasPlexus:false, home:'' };
var FOLD = '<svg width="14" height="12" viewBox="0 0 14 12" fill="none" style="flex:none"><path d="M1 2.5C1 1.7 1.7 1 2.5 1h3l1.2 1.5H11.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5h-9C1.7 11 1 10.3 1 9.5v-7z" fill="#E3B341" opacity="0.8"/></svg>';
function openPicker(inputId, title){
  PK.input = inputId;
  document.getElementById('pk-title').textContent = title || 'Choose a folder';
  document.getElementById('pk-filter').value = '';
  document.getElementById('picker-modal').classList.add('show');
  navPicker(document.getElementById(inputId).value || '');
}
function closePicker(){ document.getElementById('picker-modal').classList.remove('show'); }
function choosePicker(){ if(PK.input && PK.path) document.getElementById(PK.input).value = PK.path; closePicker(); }
async function navPicker(p){
  var r = await fetch('/api/launcher/fs?path='+encodeURIComponent(p||'')).then(function(x){return x.json();}).catch(function(){return {error:'unreachable'};});
  if(r.error){ document.getElementById('pk-list').innerHTML = '<div class="pk-empty">'+esc(r.error)+'</div>'; return; }
  PK.path = r.path; PK.dirs = r.dirs || []; PK.hasPlexus = !!r.has_plexus; PK.home = r.home || PK.home;
  document.getElementById('pk-path').textContent = r.path;
  document.getElementById('pk-hint').textContent = (PK.hasPlexus && PK.input==='cx-path') ? '⬡ this folder already has a Plexus brain — connecting will refresh it' : '';
  document.getElementById('pk-filter').value = '';
  renderCrumbs(); renderPlaces(); renderPickerList();
}
function renderCrumbs(){
  var parts = PK.path.split('/').filter(Boolean);
  var html = '<span class="crumb" data-p="/" onclick="navPicker(this.getAttribute(\\'data-p\\'))">/</span>';
  var acc = '';
  parts.forEach(function(seg, i){
    acc += '/' + seg;
    var last = i === parts.length - 1;
    html += '<span class="crumb-sep">›</span>'
      + '<span class="crumb'+(last?' cur':'')+'" data-p="'+esc(acc)+'"'+(last?'':' onclick="navPicker(this.getAttribute(\\'data-p\\'))"')+'>'+esc(seg)+'</span>';
  });
  document.getElementById('pk-crumbs').innerHTML = html;
}
function renderPlaces(){
  if(!PK.home) { document.getElementById('pk-places').innerHTML=''; return; }
  var places = [['Home', PK.home], ['Desktop', PK.home+'/Desktop'], ['Documents', PK.home+'/Documents'], ['PlexusProjects', PK.home+'/PlexusProjects']];
  document.getElementById('pk-places').innerHTML = places.map(function(pl){
    return '<span class="place" data-p="'+esc(pl[1])+'" onclick="navPicker(this.getAttribute(\\'data-p\\'))">'+pl[0]+'</span>';
  }).join('');
}
function renderPickerList(){
  var f = (document.getElementById('pk-filter').value || '').toLowerCase();
  var list = PK.dirs.filter(function(d){ return d.toLowerCase().indexOf(f) >= 0; });
  document.getElementById('pk-list').innerHTML = list.length
    ? list.map(function(d){ return '<div class="pk-row" data-p="'+esc(PK.path+'/'+d)+'" onclick="navPicker(this.getAttribute(\\'data-p\\'))">'+FOLD+'<span>'+esc(d)+'</span></div>'; }).join('')
    : '<div class="pk-empty">no folders here'+(f?' matching “'+esc(f)+'”':'')+' — you can still choose this folder below</div>';
}
document.addEventListener('keydown', function(e){
  if(e.key==='Escape' && document.getElementById('picker-modal').classList.contains('show')) closePicker();
});
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
  if(new URLSearchParams(location.search).has('intro')){ replayIntro(); return; } // ?intro forces the wizard
  fetch('/api/launcher/onboarding').then(function(x){return x.json();}).then(function(r){
    // always_intro = dev/demo pref (replay every launch); real users see the wizard once.
    if(!r.onboarded || r.always_intro){ document.getElementById('wizard').classList.add('show'); }
  }).catch(function(){});
}
function wizStep(n){
  var steps = document.querySelectorAll('.wstep');
  for(var i=0;i<steps.length;i++){ steps[i].classList.toggle('active', parseInt(steps[i].getAttribute('data-step'),10)===n); }
  document.getElementById('wizard').classList.toggle('art', n>=2); // info windows sit over the connectome art
  var v=document.getElementById('wiz-vid');
  if(n===1){ if(v){ try{ v.currentTime=0; v.play(); }catch(e){} } }
  else if(v){ try{ v.pause(); }catch(e){} } // else a hidden video's onended could drag the user back
  if(n>=2){ // reaching the setup windows = pitch seen once — never replay the wizard as a nag
    fetch('/api/launcher/onboarding/complete',{method:'POST'}).catch(function(){});
  }
}
function replayIntro(){ document.getElementById('wizard').classList.add('show'); wizStep(0); }
function wizSearch(btn){
  btn.disabled=true; btn.textContent='searching…';
  renderClients(document.getElementById('wiz-clients')).then(function(){
    btn.parentElement.style.display='none';
  }).catch(function(){ btn.disabled=false; btn.textContent='⌕ See which AI apps this Mac has'; });
}
function startPresentation(){ wizStep(1); }
// advance only if the presentation is actually on screen (guards stray ended events)
function vidEnded(){ var s=document.querySelector('.wstep[data-step="1"]'); if(s && s.classList.contains('active')) wizStep(2); }
// ── AI-tool detection — INFORMATIONAL only (Integration v2): Plexus never
// registers itself into an AI globally. Each project carries its own
// connection; this roster just shows which AI apps live on this Mac.
var INSTALLED=[]; // last detection result (installed clients) — shared by results screens
function renderClients(listEl){
  listEl.innerHTML = '<div class="hint">detecting your AI tools…</div>';
  return fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){
    // Only what's actually ON this machine — an uninstalled app is noise, not a choice.
    var inst = (r.clients || []).filter(function(c){ return c.installed; });
    INSTALLED = inst;
    if(!inst.length){
      listEl.innerHTML = '<div class="hint">No AI tools detected on this machine yet. Install one (Claude Code, Cursor, Antigravity…) — your Plexus projects connect to it automatically, per project.</div>';
      return inst;
    }
    listEl.innerHTML = inst.map(function(c){
      return '<div class="clientrow"><div class="ci"><b>'+esc(c.label)+'</b><span class="c-state">detected</span>'+(c.hint?'<div class="c-hint">'+esc(c.hint)+'</div>':'')+'</div><span class="ok">✓</span></div>';
    }).join('');
    return inst;
  });
}
function loadWizClients(){
  renderClients(document.getElementById('wiz-clients'))
    .catch(function(){ document.getElementById('wiz-clients').innerHTML='<div class="hint">could not detect AI tools</div>'; });
}

// ── Post-create handoff: one button into the same Open-project picker ──
// (editor + AI chosen there; the folder carries plug + brain + auto-start task)
function openHereButtons(p, noteId){
  return '<button class="primary" data-p="'+esc(p)+'" onclick="resumeWith(this.getAttribute(\\'data-p\\'))">Open project</button>';
}
function connectedNote(){
  return '<div class="hint" style="margin:4px 0 10px">✓ This project carries its own Plexus connection — open your AI inside its folder and it finds the brain automatically (it asks your permission once, the first time). Just talk about your app.</div>';
}
function loadConnections(){
  // Status line only — the detected-tools rows appear on request.
  var head = document.getElementById('conn-head'), sub = document.getElementById('conn-sub');
  if(!head) return;
  fetch('/api/launcher/clients').then(function(x){return x.json();}).then(function(r){
    var inst = (r.clients||[]).filter(function(c){ return c.installed; });
    INSTALLED = inst;
    head.textContent = '⬡ Plexus connects per project';
    sub.textContent = inst.length
      ? 'Nothing to install — each project carries its own connection, and AIs opened anywhere else stay plexus-free. Detected on this Mac: ' + inst.map(function(c){return c.label;}).join(', ') + '.'
      : 'Nothing to install — each project carries its own connection. No AI tools detected on this Mac yet.';
  }).catch(function(){ head.textContent='⬡ Plexus connects per project'; });
}
function openTools(){
  document.getElementById('topmenu').classList.remove('show');
  document.getElementById('tools-modal').classList.add('show');
  renderTools(false);
}
function closeTools(){ document.getElementById('tools-modal').classList.remove('show'); }
function openAiGuide(){ document.getElementById('topmenu').classList.remove('show'); document.getElementById('aiguide-modal').classList.add('show'); }
function closeAiGuide(){ document.getElementById('aiguide-modal').classList.remove('show'); }
function renderTools(force){
  var eEl=document.getElementById('tools-editors'), aEl=document.getElementById('tools-ais');
  eEl.innerHTML='<div class="hint">detecting…</div>'; aEl.innerHTML='';
  fetch('/api/launcher/clients'+(force?'?force=1':'')).then(function(x){return x.json();}).then(function(r){
    var cs=r.clients||[];
    INSTALLED=cs.filter(function(c){return c.installed;});
    var eds=cs.filter(function(c){return c.kind==='editor'&&c.installed;});
    eEl.innerHTML=eds.length?eds.map(function(c){
      return '<div class="clientrow"><div class="ci"><b>'+esc(c.label)+'</b><span class="c-state">detected</span>'+(c.hint?'<div class="c-hint">'+esc(c.hint)+'</div>':'')+'</div><span class="ok">✓</span></div>';
    }).join(''):'<div class="hint">No code editors detected — install VS Code, Cursor, or Antigravity, then ⌕ search again.</div>';
    var ais=cs.filter(function(c){return c.kind==='ai'&&(c.installed||c.custom);});
    aEl.innerHTML=ais.length?ais.map(function(c){
      var st=!c.installed?'not on PATH':(c.mcp&&c.project_wired?('Plexus-ready ✓'+(c.global_connection?' · GLOBAL':'')):(c.mcp?'no per-project connection':'not MCP-capable'));
      var right=c.custom?'<button class="ghost" data-bin="'+esc(c.id.slice(7))+'" onclick="removeCustomAi(this)">✕</button>'
        :(c.global_connection?'<button class="ghost" onclick="disengageCodex(this)" title="Removes Plexus\\'s own entry from Codex\\'s settings (via Codex\\'s CLI). Reconnecting later is the same one-time paste.">Disengage</button>'
        :'<span class="ok">'+(c.mcp&&c.project_wired?'✓':'·')+'</span>');
      var extra=(c.connect_command?'<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(c.connect_command)+'</div>':'');
      return '<div class="clientrow"><div class="ci"><b>'+esc(c.label)+'</b><span class="c-state">'+st+'</span>'+(c.hint?'<div class="c-hint">'+esc(c.hint)+'</div>':'')+extra+'</div>'+right+'</div>';
    }).join(''):'<div class="hint">No AI CLIs detected yet.</div>';
  }).catch(function(){ eEl.innerHTML='<div class="hint">detection failed — try ⌕ search again.</div>'; });
}
function rescanTools(el){ el.textContent='searching…'; renderTools(true); setTimeout(function(){el.textContent='⌕ search again';},1400); }
function addCustomAi(btn){
  var bin=document.getElementById('addai-bin').value.trim(), label=document.getElementById('addai-label').value.trim(), mcp=document.getElementById('addai-mcp').checked;
  var note=document.getElementById('addai-note');
  if(!bin){ note.textContent='enter the command name'; return; }
  btn.disabled=true;
  fetch('/api/launcher/custom-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bin:bin,label:label,mcp:mcp})})
    .then(function(x){return x.json();}).then(function(r){
      btn.disabled=false;
      if(r.ok){ note.textContent='added ✓'; document.getElementById('addai-bin').value=''; document.getElementById('addai-label').value=''; document.getElementById('addai-mcp').checked=false; renderTools(false); }
      else note.textContent=r.error||'could not add';
    }).catch(function(){ btn.disabled=false; note.textContent='could not add'; });
}
function toggleCodexHow(btn){ var d=btn.nextElementSibling; if(d) d.style.display = d.style.display==='none' ? 'block' : 'none'; }
function disengageCodex(btn){
  btn.disabled=true; var o=btn.textContent; btn.textContent='disengaging…';
  fetch('/api/launcher/disengage-codex',{method:'POST'}).then(function(x){return x.json();}).then(function(r){
    btn.disabled=false;
    if(r.ok){ renderTools(true); } else { btn.textContent=o; }
  }).catch(function(){ btn.disabled=false; btn.textContent=o; });
}
function removeCustomAi(btn){
  fetch('/api/launcher/custom-ai/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bin:btn.getAttribute('data-bin')})})
    .then(function(){ renderTools(false); }).catch(function(){});
}
function wizFinish(view){
  fetch('/api/launcher/onboarding/complete',{method:'POST'}).catch(function(){});
  document.getElementById('wizard').classList.remove('show');
  show(view || 'v-home');
}

// ── Open project (per project: editor + AI picker) ──
// ── Open project: two-step picker (editor → AI), remembered per project ──
var PROJECTS=[];
var RM={path:null, editor:null, ai:null};
function resumeWith(pathStr){
  RM.path = pathStr;
  var proj=null; for(var i=0;i<PROJECTS.length;i++){ if(PROJECTS[i].path===pathStr) proj=PROJECTS[i]; }
  RM.editor = (proj && proj.preferred_editor) || null;
  RM.ai = (proj && proj.preferred_ai) || null;
  document.getElementById('rm-path').textContent = pathStr;
  document.getElementById('rm-cmd').textContent = (proj && proj.connect_code) || ('cd "'+pathStr+'"');
  document.getElementById('rm-note').textContent = 'A new editor window opens anchored to this Plexus project — your chosen AI starts automatically in its terminal.';
  document.getElementById('resume-modal').classList.add('show');
  renderResume(false);
}
function renderResume(force){
  var eEl=document.getElementById('rm-editors'), aEl=document.getElementById('rm-ais');
  eEl.innerHTML='<div class="hint">detecting…</div>'; aEl.innerHTML='';
  fetch('/api/launcher/clients'+(force?'?force=1':'')).then(function(x){return x.json();}).then(function(r){
    var cs=r.clients||[]; INSTALLED=cs.filter(function(c){return c.installed;});
    var editors=cs.filter(function(c){return c.kind==='editor'&&c.installed;});
    var ais=cs.filter(function(c){return c.kind==='ai'&&c.installed;});
    if(!editors.length){
      RM.editor=null;
      eEl.innerHTML='<div class="hint">No code editors detected. Install VS Code, Cursor, or Antigravity, then ⌕ search again — or paste the connect code below in any terminal, before engaging the AI.</div>';
    } else {
      if(!RM.editor || !editors.some(function(c){return c.id===RM.editor;})) RM.editor=editors[0].id;
      eEl.innerHTML=editors.map(function(c){
        return '<button class="'+(RM.editor===c.id?'sel':'')+'" onclick="pickEditor(\\''+c.id+'\\')">'+esc(c.label)+(c.builtin_agent?'<span class="rm-sub">has a built-in agent</span>':'')+'</button>';
      }).join('');
    }
    var rows='';
    ais.forEach(function(c){
      var ready=c.mcp&&c.project_wired;
      if(ready){ rows+='<button class="'+(RM.ai===c.id?'sel':'')+'" onclick="pickAi(\\''+c.id+'\\')">'+esc(c.label)+'<span class="rm-sub">Plexus-ready ✓'+(c.global_connection?' <b class="warn-a">· global</b>':'')+'</span></button>'; }
      else if(c.connect_command){
        rows+='<button onclick="toggleCodexHow(this)">'+esc(c.label)+'<span class="rm-sub">global-only — tap to see how to connect</span></button>'
          +'<div class="codexhow" style="display:none">Codex only supports a global connection (OpenAI\\'s design), and Plexus never connects an AI globally — <b>you</b> do it: copy this, paste it in <b>any</b> terminal, press enter. One time per machine; undo anytime with the Disengage button (☰ → Manage connections).'
          +'<div class="cmd" onclick="copyText(this.textContent,null)">'+esc(c.connect_command)+'</div>'
          +'<span class="wiz-skip" onclick="renderResume(true)">I ran it — ⌕ search again</span></div>';
      }
      else{ rows+='<button class="dis" disabled title="Only MCP-capable, Plexus-connected AIs can use the brain — see AI Guidelines (☰).">'+esc(c.label)+'<span class="rm-sub">'+(c.mcp?'no per-project connection':'not MCP-capable')+'</span></button>'; }
    });
    if(RM.ai!=='none' && !ais.some(function(c){return c.id===RM.ai&&c.mcp&&c.project_wired;})){
      var first=ais.filter(function(c){return c.mcp&&c.project_wired;})[0];
      RM.ai=first?first.id:'none';
    }
    rows+='<button class="'+(RM.ai==='none'?'sel':'')+'" onclick="pickAi(\\'none\\')">None — just open the editor<span class="rm-sub">use its built-in agent if it has one</span></button>';
    aEl.innerHTML=rows;
  }).catch(function(){ eEl.innerHTML='<div class="hint">detection failed — try ⌕ search again.</div>'; });
}
function pickEditor(id){ RM.editor=id; renderResume(false); }
function pickAi(id){ RM.ai=id; renderResume(false); }
function rescanResume(el){ el.textContent='searching…'; renderResume(true); setTimeout(function(){ el.textContent='⌕ search again'; }, 1400); }
function doOpenProject(btn){
  if(!RM.editor){ document.getElementById('rm-note').textContent='Pick a code editor first (install one if none are detected), or use the connect code below.'; return; }
  btn.disabled=true; var orig=btn.textContent; btn.textContent='opening…';
  fetch('/api/launcher/open-editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:RM.path,client:RM.editor,ai:RM.ai||'none'})})
    .then(function(x){return x.json();}).then(function(r){
      btn.disabled=false; btn.textContent = r.ok ? 'opened ✓' : orig;
      if(r.command) document.getElementById('rm-cmd').textContent=r.command;
      var msg = r.error || r.note; if(msg) document.getElementById('rm-note').textContent=msg;
      loadProjects();
    }).catch(function(){ btn.disabled=false; btn.textContent=orig; });
}
function closeResume(){ document.getElementById('resume-modal').classList.remove('show'); }

loadProjects();
loadConnections();
checkOnboarding();
</script>
</body>
</html>`;
