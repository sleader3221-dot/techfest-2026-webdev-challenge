/* SlotWatt — shared simulator engine.
   Sample data, shop settings, the rule reader (keyword matching, not AI), the scheduler and the maths.
   Used live by the dashboard and by the landing page's worked example, so both always show the same numbers.
   No DOM access in this file. */
(function(){
  'use strict';

  /* ---------- helpers ---------- */
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function reEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function fmtH(h){ var hh=Math.floor(h), mm=Math.round((h-hh)*60); var mer=(hh%24)>=12?'PM':'AM'; var d=hh%12; if(d===0) d=12; return d+(mm?':'+(mm<10?'0':'')+mm:'')+' '+mer; }
  function rng(s,n){ var a=fmtH(s), b=fmtH(s+n); return a.slice(-2)===b.slice(-2) ? a.slice(0,-3)+'–'+b : a+'–'+b; }
  function inr(n){ return '₹'+Math.round(n).toLocaleString('en-IN'); }
  function num(n,d){ if(Number.isInteger(n)) return String(n); return n.toFixed(d==null?1:d); }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
  function joinOr(a){ return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' or '+a[a.length-1]; }
  function joinAnd(a){ return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1]; }
  var WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  function word(n){ return WORDS[n]||String(n); }

  /* ---------- shop settings (sample values, editable in the dashboard) ---------- */
  var DEFAULT_SHOP={open:9,close:21,base:2,sanctioned:20,pf:0.80,cut:18,day:7,eve:10};
  var SHOP={}; resetShop();
  function resetShop(){ Object.keys(DEFAULT_SHOP).forEach(function(k){ SHOP[k]=DEFAULT_SHOP[k]; }); }

  /* Validates a full settings object. Returns {ok, errors:{field:message}, shop:clean}. */
  function validateShop(s){
    var e={}, c={};
    function n(k){ var v=typeof s[k]==='string'?s[k].trim():s[k]; var x=v===''||v==null?NaN:Number(v); return x; }
    c.open=n('open'); c.close=n('close'); c.cut=n('cut');
    c.base=n('base'); c.sanctioned=n('sanctioned'); c.pf=n('pf'); c.day=n('day'); c.eve=n('eve');
    if(!Number.isInteger(c.open)||c.open<0||c.open>20) e.open='Opening hour must be between 12 AM and 8 PM.';
    if(!Number.isInteger(c.close)||c.close>24) e.close='Closing hour must be midnight or earlier.';
    else if(!e.open && c.close-c.open<4) e.close='Open for at least 4 hours.';
    if(!isFinite(c.base)||c.base<0||c.base>50) e.base='Base load must be 0–50 kW.';
    if(!isFinite(c.sanctioned)||c.sanctioned<4||c.sanctioned>200) e.sanctioned='Sanctioned load must be 4–200 kW.';
    else if(!e.base && c.base>=c.sanctioned-1) e.base='Base load must be at least 1 kW below the sanctioned load.';
    if(!isFinite(c.pf)||c.pf<0.5||c.pf>0.99) e.pf='Current power factor must be 0.50–0.99.';
    if(!isFinite(c.day)||c.day<=0||c.day>100) e.day='Day rate must be ₹0.1–₹100.';
    if(!isFinite(c.eve)||c.eve<=0||c.eve>100) e.eve='Evening rate must be ₹0.1–₹100.';
    if(!Number.isInteger(c.cut)||(!e.open&&!e.close&&(c.cut<c.open||c.cut>c.close))) e.cut='The evening rate must start within opening hours.';
    if(isFinite(c.pf)) c.pf=Math.round(c.pf*100)/100;
    if(isFinite(c.base)) c.base=Math.round(c.base*10)/10;
    if(isFinite(c.sanctioned)) c.sanctioned=Math.round(c.sanctioned*10)/10;
    return {ok:!Object.keys(e).length,errors:e,shop:c};
  }
  function setShop(s){ var v=validateShop(s); if(v.ok) Object.keys(DEFAULT_SHOP).forEach(function(k){ SHOP[k]=v.shop[k]; }); return v; }
  function span(){ return SHOP.close-SHOP.open; }

  /* rule-control ranges follow the shop settings (defaults give 8–30 kW, 12–8 PM, 0.80–1.00) */
  function limitRange(){ return {min:Math.max(Math.ceil(SHOP.base)+1,Math.round(SHOP.sanctioned*0.4)),max:Math.max(30,Math.ceil(SHOP.sanctioned*1.5))}; }
  function flexRange(){ return {min:Math.min(SHOP.open+3,SHOP.close-1),max:SHOP.close-1}; }
  function pfMin(){ return Math.min(0.80,Math.floor(SHOP.pf*100)/100); }

  /* ---------- machines ---------- */
  var BASE_MACH={
    lathe:{name:'Lathe',short:'lathe',alias:['lathe','turning']},
    welder:{name:'Welder',short:'welder',alias:['welder','welding','weld']},
    oven:{name:'Oven',short:'oven',alias:['oven','powder','coating']},
    compressor:{name:'Compressor',short:'compressor',alias:['compressor','spray']}
  };
  var BASE_ORDER=['lathe','welder','oven','compressor'];
  var MACH={}, MORDER=[];
  function resetMachines(){
    Object.keys(MACH).forEach(function(k){ delete MACH[k]; });
    MORDER.length=0;
    BASE_ORDER.forEach(function(k){ var m=BASE_MACH[k]; MACH[k]={name:m.name,short:m.short,alias:m.alias.slice()}; MORDER.push(k); });
  }
  resetMachines();
  function addMachine(name){
    var n=String(name||'').replace(/\s+/g,' ').trim();
    if(!/^[A-Za-z][A-Za-z0-9 \-]{1,23}$/.test(n)) return {error:'Machine name: 2–24 letters, numbers, spaces or hyphens, starting with a letter.'};
    var low=n.toLowerCase();
    var clash=MORDER.find(function(k){ return MACH[k].name.toLowerCase()===low; });
    if(clash) return {key:clash,existing:true};
    if(MORDER.length>=8) return {error:'This demo supports up to 8 machines.'};
    var key='m_'+low.replace(/[^a-z0-9]+/g,'_');
    while(MACH[key]) key+='_';
    MACH[key]={name:n,short:low,alias:[low],custom:true};
    MORDER.push(key);
    return {key:key};
  }
  var ICON={
    lathe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="12" r="4"/><path d="M11 12h10M7 8V4.5M15 9.5v5M18 10.5v3"/></svg>',
    welder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5 9 15"/><path d="M14.5 3 11 10h5l-6.5 8.5L12 12H7.5z"/></svg>',
    oven:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><rect x="7" y="9.5" width="10" height="7" rx="1"/><path d="M7 6.8h2M11 6.8h2"/></svg>',
    compressor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8.5" width="14" height="9" rx="4.5"/><path d="M17.5 13h3M9 8.5V5.5h3.5v3M7 17.5v2.5M14 17.5v2.5"/></svg>'
  };
  var ICON_GENERIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="12" rx="2.5"/><path d="M8 6.5V4M16 6.5V4M7.5 12.5h3l1.5-2 1.5 4 1.5-2h1.5"/></svg>';
  function icon(k){ return ICON[k]||ICON_GENERIC; }

  /* ---------- sample requests and rules ---------- */
  var DEFAULT_REQUESTS=[
    {id:1,name:'Lathe work',m:'lathe',kw:4,start:10,hours:3,flex:false},
    {id:2,name:'Welding',m:'welder',kw:8,start:18,hours:2,flex:false,price:1800},
    {id:3,name:'Powder-coating oven',m:'oven',kw:12,start:18,hours:2,flex:true},
    {id:4,name:'Spray compressor',m:'compressor',kw:5,start:18,hours:2,flex:true},
    {id:5,name:'Shaft turning',m:'lathe',kw:4,hours:2,flex:true,late:true,lateBy:40/60}
  ];
  function sampleRequests(){ return DEFAULT_REQUESTS.map(function(r){ return Object.assign({},r); }); }
  /* a late message arrives a little after closing, whatever the closing time is */
  function received(r){ return SHOP.close+(r.lateBy||40/60); }
  var DEFAULT_RULES=['Keep total load below 20 kW','Never run the oven and welder together','Move flexible jobs before 6 PM','Keep power factor above 0.95'];
  var EXAMPLES=['Keep total load below 20 kW','Never run the oven and welder together','Move flexible jobs before 6 PM','Keep power factor above 0.95','Hold 2 slots for walk-ins','Offer morning slots after 9 PM'];

  /* ---------- rule reader (keyword matching, not AI) ---------- */
  function findMachines(t){
    var hits=[];
    MORDER.forEach(function(k){ MACH[k].alias.some(function(a){ var i=t.search(new RegExp('\\b'+reEsc(a))); if(i>=0){ hits.push({k:k,i:i}); return true; } return false; }); });
    return hits.sort(function(a,b){return a.i-b.i;}).map(function(h){return h.k;});
  }
  /* pm: a bare hour with no AM/PM is read as evening (used for "after 9" = 9 PM) */
  function timeAfter(t,kw,pm){
    var m=t.match(new RegExp('(?:'+kw+')\\s+(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?'));
    if(!m){ if(new RegExp('(?:'+kw+')\\s+noon').test(t)) return 12; if(new RegExp('(?:'+kw+')\\s+midnight').test(t)) return 24; return null; }
    var h=parseInt(m[1],10), mer=m[3]?m[3].charAt(0):null;
    if(h>24) return null;
    if(mer==='p' && h<12) h+=12;
    if(mer==='a' && h===12) h=0;
    if(!mer){ if(pm && h<12) h+=12; else if(h<=8) h+=12; }
    return h;
  }
  function parseRule(raw){
    var t=String(raw).toLowerCase().replace(/\s+/g,' ').trim();
    if(!t) return null;
    var ms=findMachines(t);
    if(/power factor|\bpf\b/.test(t)){
      var m=t.match(/(\d*\.\d+|\d+(?:\.\d+)?)/);
      if(!m) return {partial:'I found "power factor" but no target number. Try: Keep power factor above 0.95'};
      var v=parseFloat(m[1]); if(v>1) v=v/100;
      if(v<0.5||v>1) return {partial:'A power factor target should be between '+pfMin().toFixed(2)+' and 1.00.'};
      return {type:'PF',v:Math.round(clamp(v,pfMin(),1)*100)/100};
    }
    if(/walk[\s-]?ins?\b/.test(t)){
      var n=t.match(/(\d+)/); var w={one:1,two:2,three:3,four:4}; var wd=t.match(/\b(one|two|three|four)\b/);
      var c=n?parseInt(n[1],10):wd?w[wd[1]]:null;
      if(!c) return {partial:'I found "walk-ins" but not how many slots to hold. Try: Hold 2 slots for walk-ins'};
      return {type:'WALKIN',v:clamp(c,1,4)};
    }
    if(/morning/.test(t) && /\bafter\b/.test(t)){
      var lh=timeAfter(t,'after',true); return {type:'LATE',v:lh==null?21:clamp(lh,17,23)};
    }
    if(/flex/.test(t) && /\b(before|by|until)\b/.test(t)){
      var fh=timeAfter(t,'before|by|until');
      if(fh==null) return {partial:'I found "flexible jobs before" but no time. Try: Move flexible jobs before 6 PM'};
      var fr=flexRange(); return {type:'FLEX',v:clamp(fh,fr.min,fr.max)};
    }
    var apartWords=/\b(apart|separate|separately)\b/.test(t);
    if(apartWords || (/(together|same time|at once|simultaneous|alongside)/.test(t) && /(never|\bnot\b|n't|avoid|\bno\b)/.test(t))){
      if(ms.length<2) return {partial:'I found "never … together" but not two machines I know. Machines: '+MORDER.map(function(k){return MACH[k].name;}).join(', ')+'.'};
      return {type:'APART',a:ms[0],b:ms[1]};
    }
    if(/(\bkw\b|load|power)/.test(t) && /(below|under|max|maximum|limit|less than|within|cap|exceed|over)/.test(t)){
      var k=t.match(/(\d+(?:\.\d+)?)/);
      if(!k) return {partial:'I found a load limit but no number. Try: Keep total load below '+SHOP.sanctioned+' kW'};
      var lr=limitRange(); return {type:'LIMIT',v:clamp(Math.round(parseFloat(k[1])),lr.min,lr.max)};
    }
    return null;
  }
  function canon(r){
    switch(r.type){
      case 'LIMIT': return 'Keep total load below '+r.v+' kW';
      case 'APART': return 'Never run the '+MACH[r.a].short+' and '+MACH[r.b].short+' together';
      case 'FLEX': return 'Move flexible jobs before '+fmtH(r.v);
      case 'PF': return 'Keep power factor above '+r.v.toFixed(2);
      case 'WALKIN': return 'Hold '+r.v+' slot'+(r.v>1?'s':'')+' for walk-ins';
      case 'LATE': return 'Offer morning slots after '+fmtH(r.v);
    }
  }
  function tagOf(r){
    switch(r.type){
      case 'LIMIT': return 'LOAD LIMIT · '+r.v+' kW';
      case 'APART': return 'KEEP APART · '+MACH[r.a].name+' ↔ '+MACH[r.b].name;
      case 'FLEX': return 'FLEXIBLE JOBS · end by '+fmtH(r.v);
      case 'PF': return 'PF TARGET · '+r.v.toFixed(2);
      case 'WALKIN': return 'HOLD FOR WALK-INS · '+r.v+' slot'+(r.v>1?'s':'');
      case 'LATE': return 'LATE REQUESTS · after '+fmtH(r.v)+' → next morning';
    }
  }
  /* active rules → scheduler context */
  function ctx(rules){
    var g=function(t){ return rules.filter(function(r){return r.on&&r.type===t;}); };
    var L=g('LIMIT')[0],F=g('FLEX')[0],W=g('WALKIN')[0],LT=g('LATE')[0],P=g('PF')[0];
    return {limit:L?L.v:null,cut:F?F.v:null,apart:g('APART').map(function(r){return [r.a,r.b];}),walkin:W?W.v:0,late:LT?LT.v:null,pf:P?P.v:null};
  }
  var NO_RULES={limit:null,cut:null,apart:[],walkin:0,late:null,pf:null};
  function effLimit(c){ return c.limit!=null?c.limit:SHOP.sanctioned; }

  /* ---------- scheduler ---------- */
  function inHours(s,n){ return s>=SHOP.open && s+n<=SHOP.close; }
  function plan(jobs,c){
    var day={load:{},run:{}}, at={};
    for(var h=SHOP.open;h<SHOP.close;h++){ day.load[h]=SHOP.base; day.run[h]=[]; }
    function put(j,s){ at[j.id]=s; for(var h=s;h<s+j.hours;h++){ day.load[h]+=j.kw; day.run[h].push(j); } }
    function check(j,s,reserved,isFixed){
      if(!inHours(s,j.hours)) return [{k:'hours'}];
      var f=[], hrs=[]; for(var h=s;h<s+j.hours;h++) hrs.push(h);
      for(var i=0;i<c.apart.length;i++){
        var a=c.apart[i][0], b=c.apart[i][1], p=j.m===a?b:j.m===b?a:null; if(!p) continue;
        var pj=null; hrs.some(function(h){ pj=day.run[h].find(function(x){return x.m===p;})||null; return !!pj; });
        if(pj){ f.push({k:'apart',a:a,b:b,pj:pj,ps:at[pj.id]}); break; }
      }
      if(!isFixed && c.cut!=null && s+j.hours>c.cut) f.push({k:'cut'});
      if(!isFixed){ var held=hrs.filter(function(h){return reserved.indexOf(h)>=0;}); if(held.length) f.push({k:'walkin',held:held}); }
      if(c.limit!=null){ var pk=Math.max.apply(null,hrs.map(function(h){return day.load[h]+j.kw;})); if(pk>c.limit) f.push({k:'limit',peak:pk,s:s,n:j.hours}); }
      return f;
    }
    var out={};
    jobs.filter(function(j){return !j.flex;}).forEach(function(j){
      var f=check(j,j.start,[],true);
      if(f.length && f[0].k==='hours'){ out[j.id]={job:j,status:'flagged',fails:f,kinds:{hours:f[0]}}; return; }
      put(j,j.start); out[j.id]={job:j,status:'fixed',s:j.start,fails:f};
    });
    var reserved=c.walkin?pickHeld(day,c):[];
    jobs.filter(function(j){return j.flex;}).forEach(function(j){
      var req=check(j,j.start,reserved,false);
      if(!req.length){ put(j,j.start); out[j.id]={job:j,status:'asked',s:j.start,fails:[]}; return; }
      var cands=[], kinds={};
      for(var s=SHOP.open;s+j.hours<=SHOP.close;s++){
        var f=check(j,s,reserved,false);
        if(f.length){ f.forEach(function(x){ kinds[x.k]=x; }); continue; }
        var pk=0; for(var h=s;h<s+j.hours;h++) pk=Math.max(pk,day.load[h]+j.kw);
        cands.push({s:s,pk:pk});
      }
      if(!cands.length){ if(j.hours>span()) kinds.hours={k:'hours'}; out[j.id]={job:j,status:'flagged',fails:req,kinds:kinds}; return; }
      cands.sort(function(a,b){return a.pk-b.pk||a.s-b.s;});
      var best=cands[0]; put(j,best.s);
      out[j.id]={job:j,status:'moved',s:best.s,from:j.start,peak:best.pk,fails:req};
    });
    return {day:day,out:out,reserved:reserved};
  }
  function pickHeld(day,c){
    var end=c.cut!=null?c.cut:SHOP.close, hrs=[];
    for(var h=SHOP.open;h<end;h++) hrs.push(h);
    hrs.sort(function(a,b){ return day.load[a]-day.load[b]||a-b; });
    return hrs.slice(0,c.walkin).sort(function(a,b){return a-b;});
  }
  function metrics(day){
    var pk=0,en=0,dk=0,ek=0,ph=SHOP.open;
    for(var h=SHOP.open;h<SHOP.close;h++){ var v=day.load[h]; if(v>pk){pk=v;ph=h;} en+=v; if(h<SHOP.cut) dk+=v; else ek+=v; }
    var n=span(), avg=en/n, e=ph; while(e+1<SHOP.close && day.load[e+1]===pk) e++;
    return {peak:pk,peakH:ph,peakN:e-ph+1,energy:en,avg:avg,lf:pk?avg/pk:0,dayK:dk,eveK:ek,cost:dk*SHOP.day+ek*SHOP.eve};
  }
  /* how many placed jobs fit under the limit, accepted in the given order */
  function fitCount(res,jobs,lim){
    var load={}; for(var h=SHOP.open;h<SHOP.close;h++) load[h]=SHOP.base;
    var n=0;
    jobs.forEach(function(j){
      var o=res.out[j.id]; if(!o||o.status==='flagged') return;
      var ok=true; for(var h=o.s;h<o.s+j.hours;h++) if(load[h]+j.kw>lim) ok=false;
      if(ok){ for(h=o.s;h<o.s+j.hours;h++) load[h]+=j.kw; n++; }
    });
    return n;
  }
  /* power factor correction */
  function pfCalc(P,p1,p2){
    var t1=Math.tan(Math.acos(p1)), t2=Math.tan(Math.acos(p2));
    return {t1:t1,t2:t2,k1:P/p1,k2:P/p2,Q:Math.max(0,P*(t1-t2))};
  }

  window.SWEngine={
    SHOP:SHOP,DEFAULT_SHOP:DEFAULT_SHOP,resetShop:resetShop,validateShop:validateShop,setShop:setShop,span:span,
    limitRange:limitRange,flexRange:flexRange,pfMin:pfMin,
    MACH:MACH,MORDER:MORDER,resetMachines:resetMachines,addMachine:addMachine,icon:icon,
    sampleRequests:sampleRequests,received:received,DEFAULT_RULES:DEFAULT_RULES,EXAMPLES:EXAMPLES,
    parseRule:parseRule,canon:canon,tagOf:tagOf,ctx:ctx,NO_RULES:NO_RULES,effLimit:effLimit,
    inHours:inHours,plan:plan,metrics:metrics,fitCount:fitCount,pfCalc:pfCalc,
    clamp:clamp,esc:esc,fmtH:fmtH,rng:rng,inr:inr,num:num,cap:cap,joinOr:joinOr,joinAnd:joinAnd,word:word
  };
})();
