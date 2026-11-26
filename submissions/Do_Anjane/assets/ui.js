/* SlotWatt — small shared motion helpers (no libraries, works offline).
   - SWUI.countTo(el, value, format): eases a number from its last value to the new one
   - page transitions: a short fade between SlotWatt pages
   Everything respects prefers-reduced-motion. */
(function(){
  'use strict';
  var reduce=!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* count a number up or down; format(v) returns the HTML to show */
  function countTo(el,to,format,dur){
    if(!el) return;
    if(el._swRaf) cancelAnimationFrame(el._swRaf);
    clearTimeout(el._swEnd);
    var from=el._swV;
    el._swV=to;
    /* hidden tabs pause animation frames, so set the final value straight away */
    if(reduce || document.hidden || from==null || from===to || !isFinite(from) || !isFinite(to)){ el.innerHTML=format(to); return; }
    var d=dur||650, t0=null;
    function step(t){
      if(t0==null) t0=t;
      var p=Math.min(1,(t-t0)/d), e=1-Math.pow(1-p,3);
      el.innerHTML=format(from+(to-from)*e);
      if(p<1) el._swRaf=requestAnimationFrame(step); else { el._swRaf=null; el.innerHTML=format(to); }
    }
    el._swRaf=requestAnimationFrame(step);
    /* safety net: a throttled or slow machine still lands on the exact final value */
    el._swEnd=setTimeout(function(){ if(el._swRaf){ cancelAnimationFrame(el._swRaf); el._swRaf=null; } el.innerHTML=format(to); },d+150);
  }

  /* page transitions between SlotWatt pages */
  var css=document.createElement('style');
  css.textContent=
    /* opacity only: a transform on <body> would break the fixed/sticky headers mid-fade */
    'html.sw-in body{animation:swPageIn .36s ease both}'+
    '@keyframes swPageIn{from{opacity:0}to{opacity:1}}'+
    'html.sw-out body{opacity:0;transition:opacity .15s ease}'+
    '@media (prefers-reduced-motion:reduce){html.sw-in body{animation:none}html.sw-out body{opacity:1}}';
  document.head.appendChild(css);
  if(!reduce && document.documentElement.dataset.pageIn!=='off') document.documentElement.classList.add('sw-in');

  document.addEventListener('click',function(e){
    if(reduce || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a=e.target.closest && e.target.closest('a[href]'); if(!a || a.target==='_blank' || a.hasAttribute('download')) return;
    var url=new URL(a.href,location.href);
    if(url.origin!==location.origin) return;
    if(url.pathname===location.pathname && url.search===location.search) return; /* same-page anchors scroll as normal */
    e.preventDefault();
    document.documentElement.classList.add('sw-out');
    setTimeout(function(){ location.href=url.href; },150);
  });
  window.addEventListener('pageshow',function(){ document.documentElement.classList.remove('sw-out'); });

  window.SWUI={countTo:countTo,reduce:reduce};
})();
