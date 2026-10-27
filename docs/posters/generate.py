import math, os
OUT=os.path.dirname(os.path.abspath(__file__)); os.makedirs(OUT,exist_ok=True)

def bez(p1x,p1y,p2x,p2y):
    def X(t): return 3*(1-t)**2*t*p1x+3*(1-t)*t*t*p2x+t**3
    def Y(t): return 3*(1-t)**2*t*p1y+3*(1-t)*t*t*p2y+t**3
    def at(x):
        lo,hi=0.0,1.0
        for _ in range(40):
            m=(lo+hi)/2
            if X(m)<x: lo=m
            else: hi=m
        return Y((lo+hi)/2)
    return at

CSS="""
:root{--ink:#e9e9ee;--ink2:rgba(233,233,238,.66);--ink3:rgba(233,233,238,.42);--paper:#0c0c10;--hair:rgba(233,233,238,.16);--fill:rgba(233,233,238,.07);--accent:var(--acc);}
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:#050507;font-family:Manrope,ui-sans-serif,system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}
.stage{height:100%;display:grid;place-items:center;overflow:hidden}
.poster{width:794px;height:1123px;background:var(--paper);padding:20px 32px;display:flex;flex-direction:column;gap:14px;transform-origin:center;position:relative}
h1{font-size:16px;font-weight:500;letter-spacing:-.005em}
.meta{font-size:12px;color:var(--ink3);margin-top:3px}
.fig{border-top:1px solid var(--hair);padding-top:8px}
.cap{font-size:12px;color:var(--ink3);display:flex;justify-content:space-between;margin-bottom:4px}
svg{display:block;overflow:visible}
svg text{font-family:inherit;font-size:12px;fill:var(--ink2);font-variant-numeric:tabular-nums}
svg .n{fill:var(--ink);font-weight:600}
.moments{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:10px;border-top:1px solid var(--hair);padding-top:8px}
.moments div{font-size:12px;line-height:16px;color:var(--ink2)}
.moments b{display:block;color:var(--ink);font-weight:600;font-size:12px}
.foot{display:grid;grid-template-columns:1fr 1fr;gap:28px;border-top:1px solid var(--hair);padding-top:10px}
ol{list-style:none;padding:0;display:grid;gap:9px}
li{font-size:13px;line-height:18px;color:var(--ink2);display:grid;grid-template-columns:20px 1fr}
li i{font-style:normal;font-weight:600;color:var(--ink);border:1px solid var(--hair);border-radius:3px;width:16px;height:16px;display:grid;place-items:center;font-size:11px;margin-top:1px}
li b{color:var(--ink);font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px;line-height:18px}
td{padding:5px 0;border-top:1px solid var(--hair);vertical-align:top}
td:first-child{width:150px;color:var(--ink3)}
td span{color:var(--ink3)}
.title{margin-top:auto;border-top:1px solid var(--ink3);padding-top:6px;display:flex;justify-content:space-between;font-size:11px;color:var(--ink3)}
svg [stroke="var(--accent)"]{stroke:var(--acc)}svg [fill="var(--accent)"]{fill:var(--acc)}
svg [stroke="var(--ink2)"]{stroke:var(--ink2)}svg [stroke="var(--ink3)"]{stroke:var(--ink3)}svg [stroke="var(--hair)"]{stroke:var(--hair)}
svg [fill="var(--ink2)"]{fill:var(--ink2)}svg [fill="var(--paper)"]{fill:var(--paper)}svg [stroke="var(--paper)"]{stroke:var(--paper)}
@media print{html,body{background:#fff}.stage{display:block}.poster{transform:none!important}@page{size:A4;margin:0}}
"""
JS="""<script>(function(){var p=document.querySelector('.poster');function fit(){var s=Math.min(innerWidth/794,innerHeight/1123);p.style.transform='scale('+s+')'}addEventListener('resize',fit);fit()})()</script>"""
def page(title,acc,acc_ink,body,cols):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{CSS}.poster{{--acc:{acc};--accink:{acc_ink};--cols:{cols}}}</style></head><body><div class="stage"><main class="poster" data-poster>{body}</main></div>{JS}</body></html>"""

def curve_svg(w,h,fn,xs_label,held,acc,ylabels=("0","1"),extra=""):
    pts=" ".join(f"{i/80*w:.1f},{h-fn(i/80)*h:.1f}" for i in range(81))
    hx=held*w; hy=h-fn(held)*h
    return f"""<svg width="{w+40}" height="{h+34}" viewBox="-30 -8 {w+40} {h+34}">
<line x1="0" y1="{h}" x2="{w}" y2="{h}" stroke="var(--ink3)" stroke-width=".75"/><line x1="0" y1="0" x2="0" y2="{h}" stroke="var(--ink3)" stroke-width=".75"/>
<line x1="0" y1="0" x2="{w}" y2="0" stroke="var(--ink3)" stroke-width=".5" stroke-dasharray="1 3"/>
<polyline points="{pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
<line x1="{hx:.1f}" y1="{hy:.1f}" x2="{hx:.1f}" y2="{h}" stroke="var(--accent)" stroke-width=".75" stroke-dasharray="3 2 1 2"/><line x1="0" y1="{hy:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="var(--accent)" stroke-width=".75" stroke-dasharray="3 2 1 2"/>
<circle cx="{hx:.1f}" cy="{hy:.1f}" r="3.5" fill="var(--accent)"/>
<text x="-6" y="{h+4}" text-anchor="end">{ylabels[0]}</text><text x="-6" y="4" text-anchor="end">{ylabels[1]}</text>
{xs_label}{extra}</svg>"""

# ======================= Poster 1: approval card =======================
ease=bez(0,0,0.58,1)          # CSS keyword ease-out
held=60/160; prog=ease(held)
def card(x,y,w,state,scale=1.0,labels=False,stripe="#fb923c"):
    # sizes read from source: stripe 3, head min-h 48, body p-3 (12), well r-xl 12, panel r-6xl 26, footer min-h 48, buttons h-8 (32)
    s=scale; H=int(212*s); r=26*s
    g=[f'<g transform="translate({x},{y})">']
    g.append(f'<rect width="{w*s}" height="{H}" rx="{r}" fill="rgba(233,233,238,.06)" stroke="var(--hair)"/>')
    g.append(f'<path d="M0 {r} a{r} {r} 0 0 1 {r} -{r} h0 v{H} h0 a{r} {r} 0 0 1 -{r} -{r} z" fill="none"/>')
    g.append(f'<rect x="0" y="{r}" width="{3*s}" height="{H-2*r}" fill="{stripe}"/>')
    g.append(f'<text x="{16*s}" y="{29*s}" class="n" style="font-size:{15*s}px">{"Needs approval" if state!="resolved" and state!="policy" else ("Approved" )}</text>')
    g.append(f'<text x="{(w-16)*s}" y="{29*s}" text-anchor="end" style="font-size:{10*s}px;letter-spacing:.04em">MEDIUM RISK</text>')
    g.append(f'<rect x="{12*s}" y="{48*s}" width="{(w-24)*s}" height="{86*s}" rx="{12*s}" fill="rgba(0,0,0,.35)"/>')
    g.append(f'<text x="{24*s}" y="{72*s}" class="n" style="font-size:{14*s}px">Send summary to #growth</text>')
    g.append(f'<text x="{24*s}" y="{96*s}" style="font-size:{12*s}px">To #growth · send_message</text>')
    g.append(f'<text x="{24*s}" y="{116*s}" style="font-size:{12*s}px">Checkout conversion fell 4.5 pts on Oct 14…</text>')
    fy=150*s
    if state in("pending","tray"):
        bx=(w-12)*s
        for label,bw,fillc in (("Approve",84,"var(--accent)"),("Approve & always allow",168,"rgba(233,233,238,.12)"),("Reject with a note",132,"none")):
            bx-=bw*s; g.append(f'<rect x="{bx}" y="{fy}" width="{bw*s}" height="{32*s}" rx="{16*s}" fill="{fillc}" stroke="{"var(--hair)" if fillc=="none" else "none"}"/><text x="{bx+bw*s/2}" y="{fy+20*s}" text-anchor="middle" style="font-size:{12*s}px;{"fill:#0b1a10;font-weight:700" if label=="Approve" else "fill:var(--ink)"}">{label}</text>'); bx-=8*s
    else:
        msg="Approved by you · 4.2s after the request · always allow saved" if state=="resolved" else "Approved by policy · 0.0s after the request"
        g.append(f'<text x="{24*s}" y="{fy+20*s}" style="font-size:{12*s}px;fill:var(--ink)">✓ {msg}</text>')
    g.append('</g>'); return "".join(g)

def dim_vl(x,y1,y2,label):
    return f'<g stroke="var(--ink2)" stroke-width=".75"><line x1="{x-4}" y1="{y1}" x2="{x+4}" y2="{y1}"/><line x1="{x-4}" y1="{y2}" x2="{x+4}" y2="{y2}"/><line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}"/></g><text x="{x-8}" y="{(y1+y2)/2+4}" text-anchor="end" class="n">{label}</text>'
def dim_h(x1,x2,y,label,ext=0):
    return f'<g stroke="var(--ink2)" stroke-width=".75"><line x1="{x1}" y1="{y-4}" x2="{x1}" y2="{y+4}"/><line x1="{x2}" y1="{y-4}" x2="{x2}" y2="{y+4}"/><line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}"/></g><text x="{(x1+x2)/2}" y="{y-6}" text-anchor="middle" class="n">{label}</text>'
def dim_v(x,y1,y2,label):
    return f'<g stroke="var(--ink2)" stroke-width=".75"><line x1="{x-4}" y1="{y1}" x2="{x+4}" y2="{y1}"/><line x1="{x-4}" y1="{y2}" x2="{x+4}" y2="{y2}"/><line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}"/></g><text x="{x+8}" y="{(y1+y2)/2+4}" class="n">{label}</text>'
def nb(x,y,n): return f'<g><circle cx="{x}" cy="{y}" r="8" fill="var(--paper)" stroke="var(--accent)"/><text x="{x}" y="{y+4}" text-anchor="middle" class="n" style="font-size:11px">{n}</text></g>'

fig1=f"""<svg width="730" height="300" viewBox="0 0 730 300">
{card(120,34,460,"pending",1.0)}
{dim_vl(100,34+26,34+186,"B2 stripe = 3 px")}
{dim_h(120,580,22,"460 · card, radius R6 = 26")}
{dim_v(600,34,34+48,"48 · head")}
{dim_v(600,34+150,34+182,"H4 = 32 · button")}
{nb(124,34+196,1)}{nb(120+300,34+4,2)}{nb(120+472,34+98,3)}{nb(120+232,34+226,4)}
</svg>"""
mom=lambda st,x,lbl:f'<svg width="165" height="118" viewBox="0 0 165 118" style="overflow:hidden"><rect width="165" height="118" fill="none"/>{card(0,6,460,st,0.358)}</svg>'
moments="".join(f'<div>{mom(st,0,t)}<b>{t}</b>{d}</div>' for st,t,d in (("pending","1 · Pending","Stripe, payload well, three actions. Waits."),("tray","2 · Tray slides in","160 ms ease-out, 8 px rise, fades in above the composer."),("resolved","3 · Resolved","Buttons leave; stamp row fades in (120 ms)."),("policy","4 · Run 2","Policy line honored: stamped by policy, no wait.")))
curve=curve_svg(250,120,ease,f'<text x="0" y="146">0</text><text x="{250*held:.0f}" y="146" text-anchor="middle" class="n">60 ms</text><text x="250" y="146" text-anchor="end">160 ms</text>',held,"x",("1","0"),
  f'<text x="{250*held+8:.0f}" y="{120-ease(held)*120-8:.0f}" class="n">{prog*100:.0f}% of the 8 px rise</text>')
notes="""<ol><li><i>1</i><span><b>The stripe is the risk.</b> 3 px, mint low, orange medium, red high. Nothing else on the card carries colour.</span></li>
<li><i>2</i><span><b>The head says what it needs.</b> "Needs approval" becomes "Approved" or "Rejected" when resolved.</span></li>
<li><i>3</i><span><b>The payload well shows the exact action</b>, not a summary of it: channel, kind and text.</span></li>
<li><i>4</i><span><b>Three exits.</b> Approve; Approve &amp; always allow, which writes <code>allow: send_message to #growth for this workstream</code> into SKILL.md for the next run; Reject with a note, which the orchestrator reads.</span></li></ol>"""
spec="""<table><tr><td>Trigger</td><td>An <code>approval.request</code> event. The run waits until a decision arrives.</td></tr>
<tr><td>Properties</td><td>tray: opacity 0 → 1, translateY 8 → 0 px · resolved stamp: opacity 0 → 1 · stripe colour by risk (static)</td></tr>
<tr><td>Duration</td><td>tray 160 ms · stamp 120 ms · buttons leave with the card state (cut)</td></tr>
<tr><td>Easing</td><td>tray <code>ease-out</code> (cubic-bezier 0, 0, .58, 1) · stamp <code>ease-out</code></td></tr>
<tr><td>Reduced motion</td><td>Both animations are removed (<code>animation: none</code>); the card appears and resolves with a cut.</td></tr></table>"""
body1=f"""<header><h1>Approval card</h1><p class="meta">src/components/nimbus/transcript.tsx · approval-tray.tsx · the gate that keeps every side effect asking first</p></header>
<p style="font-size:16px;line-height:22px;font-weight:500;color:var(--ink)">The gate asks once and remembers: <span style="color:var(--accink)">Approve &amp; always allow</span> writes one policy line the next run reads.</p>
<section class="fig"><div class="cap"><span>Figure 1 · the card, pending</span><span>drawn at 1× (layout px)</span></div>{fig1}</section>
<section class="moments">{moments}</section>
<section class="foot"><div>{notes}</div><div class="cap" style="display:block"><div class="cap"><span>Figure 2 · tray entrance, rise vs time</span></div>{curve}</div></section>
<section>{spec}</section>
<footer class="title"><span>Units: px and ms. Scale: figure 1 at 1×, moments at 0.5×. Values are read from source, not measured in a browser.</span><span>—— now &nbsp; - - - held &nbsp; ·–· reference</span></footer>"""
open(f"{OUT}/approval-card.html","w").write(page("Approval card · interface spec","oklch(0.78 0.15 150)","oklch(0.52 0.12 150)".replace("0.52","0.8"),body1,4))

# ======================= Poster 2: timeline strip =======================
def lane_row(i,label,model,segs,extra=""):
    return ""
fig2_strip=f"""<svg width="730" height="330" viewBox="0 0 730 330">
<defs><pattern id="h" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--accent)" opacity=".16"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--accent)" stroke-width="2.5" opacity=".6"/></pattern></defs>
<!-- legend W2 = 240 | plot -->
<g stroke="var(--hair)"><line x1="0" y1="0" x2="720" y2="0"/><line x1="240" y1="0" x2="240" y2="230"/><line x1="0" y1="198" x2="720" y2="198"/><line x1="0" y1="230" x2="720" y2="230"/></g>
<g><circle cx="12" cy="18" r="4" fill="var(--ink2)"/><text x="24" y="22" class="n">Orchestrator</text><text x="24" y="40">▣ Nemotron 3 Ultra</text><text x="24" y="56" style="font-size:11px">20,360 tok · $0.011</text>
<circle cx="12" cy="84" r="4" fill="oklch(.72 .15 305)"/><text x="24" y="88" class="n">Researcher</text><text x="24" y="106">▣ ↓ Nemotron 3 Nano</text><text x="24" y="122" style="font-size:11px">5,940 tok · $0.000</text>
<circle cx="12" cy="150" r="4" fill="oklch(.78 .15 60)"/><text x="24" y="154" class="n">Analyst</text><text x="24" y="172" >▣ ↓ Nemotron 3 Super</text><text x="24" y="188" style="font-size:11px">12,840 tok · $0.004</text></g>
<!-- tick grid -->
<g stroke="var(--ink3)" stroke-dasharray="3 4" stroke-width=".6" opacity=".6"><line x1="252" y1="0" x2="252" y2="198"/><line x1="440" y1="0" x2="440" y2="198"/><line x1="628" y1="0" x2="628" y2="198"/></g>
<!-- orchestrator lane: think, wait (hatched) -->
<rect x="252" y="14" width="64" height="26" rx="13" fill="oklch(.87 .006 286)" opacity=".95"/>
<rect x="320" y="14" width="300" height="26" rx="13" fill="url(#h)" stroke="var(--accent)"/><text x="470" y="31" text-anchor="middle" style="font-size:11px;fill:var(--ink)">Waiting on Researcher, Analyst</text>
<!-- spawn dot + dotted connectors -->
<circle cx="338" cy="48" r="4" fill="var(--accent)"/><line x1="338" y1="48" x2="338" y2="96" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3"/><line x1="338" y1="96" x2="352" y2="96" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3"/>
<line x1="338" y1="48" x2="338" y2="162" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3" opacity=".5"/>
<!-- researcher -->
<rect x="352" y="80" width="130" height="26" rx="13" fill="oklch(.72 .15 305)"/><text x="374" y="97" style="font-size:11px;font-weight:700;fill:#1b1424">Reading the brief</text>
<g><circle cx="354" cy="79" r="7" fill="#f4f4f6" stroke="#1b1b20" stroke-width=".75"/><text x="354" y="83" text-anchor="middle" style="font-size:10px;font-weight:800;fill:#1b1b20">↓</text></g>
<!-- analyst: failed -->
<rect x="352" y="146" width="40" height="26" rx="13" fill="none" stroke="oklch(.68 .21 25)" stroke-width="1.75"/><text x="372" y="164" text-anchor="middle" style="font-size:14px;font-weight:700;fill:oklch(.68 .21 25)">✕</text>
<rect x="396" y="146" width="150" height="26" rx="13" fill="oklch(.78 .15 60)" opacity=".8"/><text x="418" y="163" style="font-size:11px;font-weight:700;fill:#2a1a05">run_code · funnel.py</text>
<!-- playhead -->
<line x1="600" y1="0" x2="600" y2="230" stroke="#fff"/><circle cx="600" cy="204" r="5" fill="var(--paper)" stroke="#fff" stroke-width="1.75"/>
<!-- axis row H7 = 32 -->
<g stroke="var(--ink3)" stroke-width=".75"><line x1="252" y1="198" x2="252" y2="204"/><line x1="440" y1="198" x2="440" y2="204"/><line x1="628" y1="198" x2="628" y2="204"/></g>
<g stroke="var(--ink3)" stroke-width=".6" opacity=".7"><line x1="289.6" y1="198" x2="289.6" y2="202"/><line x1="327.2" y1="198" x2="327.2" y2="202"/><line x1="364.8" y1="198" x2="364.8" y2="202"/><line x1="402.4" y1="198" x2="402.4" y2="202"/></g>
<text x="252" y="218" text-anchor="middle">0s</text><text x="440" y="218" text-anchor="middle">30s</text><text x="628" y="218" text-anchor="middle">1:00</text>
{dim_v(500,80,106,"H3 = 26 · segment")}
{dim_v(8,198,230,"H7 = 32 · axis row")}
<g>{dim_h(338,352,66,"").replace('class="n"','class="n" style="font-size:10px"')}</g>
<text x="0" y="262">lane pitch P1 = 66 · legend W2 = 240 · playhead dot Z4 = 10 · spawn dot Z5 = 8</text>
{nb(560,60,1)}{nb(326,126,2)}{nb(578,206,3)}{nb(560,128,4)}{nb(334,66,5)}
</svg>"""
# moments: tiny drawings
def m_dot():
    return '<svg width="150" height="82" viewBox="0 0 150 82"><rect x="20" y="8" width="90" height="24" rx="12" fill="oklch(.87 .006 286)"/><circle cx="60" cy="46" r="6" fill="var(--accent)" opacity=".4"/><circle cx="60" cy="46" r="4" fill="var(--accent)"/><circle cx="60" cy="46" r="8.4" fill="none" stroke="var(--accent)" stroke-dasharray="3 2 1 2" stroke-width=".7"/><text x="72" y="50" style="font-size:10px">r 0.8 → 4.2 → 4</text></svg>'
def m_conn():
    return '<svg width="150" height="82" viewBox="0 0 150 82"><rect x="20" y="4" width="90" height="20" rx="10" fill="oklch(.87 .006 286)"/><circle cx="48" cy="30" r="4" fill="var(--accent)"/><line x1="48" y1="30" x2="48" y2="58" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3"/><line x1="48" y1="58" x2="48" y2="72" stroke="var(--accent)" stroke-width=".75" stroke-dasharray="1 3" opacity=".4"/><text x="58" y="50" style="font-size:10px">scaleY 0 → 1</text></svg>'
def m_hatch():
    return '<svg width="150" height="82" viewBox="0 0 150 82"><defs><pattern id="h2" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--accent)" opacity=".16"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--accent)" stroke-width="2.5" opacity=".6"/></pattern></defs><rect x="10" y="14" width="120" height="24" rx="12" fill="url(#h2)" stroke="var(--accent)"/><line x1="10" y1="52" x2="31" y2="52" stroke="var(--ink2)" stroke-width="1"/><text x="38" y="56" style="font-size:10px">7 px / 1.2 s</text></svg>'
def m_rescale():
    return '<svg width="150" height="82" viewBox="0 0 150 82"><g stroke="var(--ink3)" stroke-width=".6"><line x1="10" y1="40" x2="140" y2="40"/>'+"".join(f'<line x1="{10+i*26}" y1="36" x2="{10+i*26}" y2="44"/>' for i in range(6))+'</g><g stroke="var(--accent)" stroke-width="1"><line x1="10" y1="62" x2="85" y2="62"/><line x1="10" y1="58" x2="10" y2="66"/><line x1="85" y1="58" x2="85" y2="66"/></g><text x="12" y="80" style="font-size:10px">80 % → window × 1.25</text><circle cx="108" cy="40" r="4" fill="var(--paper)" stroke="#fff"/></svg>'
def m_fail():
    return '<svg width="150" height="82" viewBox="0 0 150 82"><rect x="20" y="14" width="60" height="26" rx="13" fill="none" stroke="oklch(.68 .21 25)" stroke-width="1.75"/><text x="50" y="33" text-anchor="middle" style="font-size:14px;font-weight:700;fill:oklch(.68 .21 25)">✕</text><text x="20" y="62" style="font-size:10px">flash 300 ms · ✕ +300 ms</text></svg>'
moments2="".join(f'<div>{m()}<b>{t}</b>{d}</div>' for m,t,d in ((m_dot,"1 · Spawn dot","Pops on the parent lane: 160 ms spring, overshoot 1.05."),(m_conn,"2 · Connector","Draws top to bottom: 220 ms linear, dotted 2 3."),(m_hatch,"3 · Waiting","Hatch drifts 7 px per 1.2 s, linear, forever."),(m_rescale,"4 · Axis rescale","Window × 1.25 at 80 %; eases 300 ms in-out."),(m_fail,"5 · Failed","Outline flashes once, then ✕ fades in.")))
# figure 2: hatch sawtooth + rescale step
saw="".join(f"{i/60*180:.1f},{70-(i/60)*7*5:.1f} " for i in range(61))
fig2b=f"""<svg width="360" height="190" viewBox="-30 -8 360 190">
<text x="0" y="6" class="n">a · the hatch, one 1.2 s cycle</text>
<line x1="0" y1="82" x2="180" y2="82" stroke="var(--ink3)" stroke-width=".75"/><line x1="0" y1="42" x2="0" y2="82" stroke="var(--ink3)" stroke-width=".75"/>
<polyline points="{" ".join(f"{i/60*180:.1f},{82-(i/60)*35:.1f}" for i in range(61))}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
<text x="-6" y="86" text-anchor="end">0</text><text x="-6" y="46" text-anchor="end">7 px</text><text x="0" y="98">0</text><text x="180" y="98" text-anchor="end">1.2 s</text>
<text x="0" y="122" class="n">b · the window, against elapsed time</text>
<line x1="0" y1="176" x2="300" y2="176" stroke="var(--ink3)" stroke-width=".75"/><line x1="0" y1="132" x2="0" y2="176" stroke="var(--ink3)" stroke-width=".75"/>
<polyline points="0,164 100,164 100,150 170,150 170,142 240,142 240,134 300,134" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
<line x1="100" y1="176" x2="100" y2="150" stroke="var(--accent)" stroke-width=".75" stroke-dasharray="3 2 1 2"/>
<text x="-6" y="168" text-anchor="end">25 s</text><text x="104" y="190">20 s = 80 % of 25</text><text x="300" y="190" text-anchor="end">elapsed →</text>
</svg>"""
notes2="""<ol><li><i>1</i><span><b>The playhead is the clock.</b> It sits at elapsed time with no easing; while running it follows the wall clock, when done it freezes at <code>run.end</code>.</span></li>
<li><i>2</i><span><b>A spawn is one dot and one dotted line.</b> The dot sits under the parent's segment (8 px); the line runs down to the child lane's first segment.</span></li>
<li><i>3</i><span><b>Dot on the axis row (10 px)</b> marks the playhead's time on the ruler.</span></li>
<li><i>4</i><span><b>Hatched means waiting.</b> The orchestrator waits on its children; the same hatch marks a question or an approval.</span></li>
<li><i>5</i><span><b>↓ and ↻ on a segment's cap:</b> the router chose a cheaper tier, or a fallback happened.</span></li></ol>"""
spec2="""<table><tr><td>Trigger</td><td>Time itself; <code>agent.spawn</code>, <code>segment.wait</code>, <code>agent.error</code> and <code>route</code> events add marks.</td></tr>
<tr><td>Properties</td><td>segment width = time × pxPerSec · pxPerSec = (plot − 24) ÷ max(25, elapsed × 1.25) · connector scaleY · dot scale · hatch translate</td></tr>
<tr><td>Duration</td><td>dot 160 ms · connector 220 ms · hatch 1.2 s loop · rescale 300 ms · fail flash 300 ms · ✕ fade 120 ms after 300 ms</td></tr>
<tr><td>Easing</td><td>none on segments and playhead · dot spring (cubic-bezier .34, 1.56, .64, 1) · connector linear · rescale ease-in-out</td></tr>
<tr><td>Reduced motion</td><td>Dot, connector and flash are cut; the playhead steps once per second; the hatch keeps drifting (it reports waiting).</td></tr></table>"""
body2=f"""<header><h1>Timeline strip: playhead and spawn connector</h1><p class="meta">src/components/nimbus/timeline.tsx · src/app/globals.css · the strip that shows what each agent is doing, live</p></header>
<p style="font-size:16px;line-height:22px;font-weight:500;color:var(--ink)">Time is the only easing: bars grow with the clock, the playhead follows it, and a spawn draws <span style="color:var(--accink)">one dotted line</span> down.</p>
<section class="fig"><div class="cap"><span>Figure 1 · three lanes, a spawn, a failure, the playhead</span><span>drawn at 1× (layout px)</span></div>{fig2_strip}</section>
<section class="moments">{moments2}</section>
<section class="foot"><div>{notes2}</div><div>{fig2b}</div></section>
<section>{spec2}</section>
<footer class="title"><span>Units: px and ms. Scale: figure 1 at 1×. Values are read from source, not measured in a browser.</span><span>—— now &nbsp; - - - held &nbsp; dotted: spawn link</span></footer>"""
open(f"{OUT}/timeline-strip.html","w").write(page("Timeline strip · interface spec","oklch(0.72 0.14 250)","oklch(0.8 0.1 250)",body2,5))
print("ok")
