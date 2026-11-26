/* SlotWatt — demo login. Nothing leaves the browser and passwords are never stored.
   "Remember me" keeps the session in localStorage; otherwise it lasts until the tab closes. */
(function(){
  'use strict';
  var KEY='slotwatt.user', LAST='slotwatt.last', mem={};

  function store(kind){
    try{ var s=window[kind]; var t='__sw'; s.setItem(t,t); s.removeItem(t); return s; }catch(e){ return null; }
  }
  var LS=store('localStorage'), SS=store('sessionStorage');
  function read(s,k){ try{ return s?JSON.parse(s.getItem(k)||'null'):null; }catch(e){ return null; } }
  function write(s,k,v){ try{ if(s) s.setItem(k,JSON.stringify(v)); else mem[k]=v; }catch(e){ mem[k]=v; } }
  function drop(s,k){ try{ if(s) s.removeItem(k); }catch(e){} delete mem[k]; }

  function clean(str,max){ return String(str||'').replace(/\s+/g,' ').trim().slice(0,max||60); }

  var Auth={
    user:function(){ return read(SS,KEY)||read(LS,KEY)||mem[KEY]||null; },
    login:function(u,remember){
      var user={
        name:clean(u.name,40)||'Demo user',
        email:clean(u.email,80).toLowerCase(),
        workshop:clean(u.workshop,50)||'Sample workshop',
        since:Date.now(),
        remember:!!remember
      };
      drop(LS,KEY); drop(SS,KEY);
      write(remember?LS:SS,KEY,user);
      if(remember) write(LS,LAST,{name:user.name,email:user.email,workshop:user.workshop});
      else drop(LS,LAST);
      return user;
    },
    logout:function(){ drop(LS,KEY); drop(SS,KEY); },
    last:function(){ return read(LS,LAST); },
    first:function(u){ u=u||Auth.user(); return u?u.name.split(' ')[0]:''; },
    initials:function(u){ u=u||Auth.user(); if(!u) return ''; var p=u.name.split(' ').filter(Boolean); return ((p[0]||'')[0]+((p[1]||'')[0]||'')).toUpperCase(); },
    greeting:function(){ var h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; },
    /* per-user simulator memory */
    loadSim:function(u){ u=u||Auth.user(); return u?read(LS,'slotwatt.sim.'+(u.email||u.name)):null; },
    saveSim:function(data,u){ u=u||Auth.user(); if(u) write(LS,'slotwatt.sim.'+(u.email||u.name),data); },
    clearSim:function(u){ u=u||Auth.user(); if(u) drop(LS,'slotwatt.sim.'+(u.email||u.name)); },
    safeNext:function(n){ return /^(dashboard|index)\.html(#[\w-]*)?$/.test(n||'')?n:'dashboard.html'; }
  };
  window.SWAuth=Auth;
})();
