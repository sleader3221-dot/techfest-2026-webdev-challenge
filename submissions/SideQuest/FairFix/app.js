/* ============================================================
   FairFix – app.js
   Sections:
   1. STORE   – localStorage wrapper, seed data, BroadcastChannel sync
   2. STATS   – pure, testable functions: median, percentile, outliers, overcharge
   3. UI      – shared helpers: toast, render range bar, format INR, etc.
   4. LANDING – landing page, role picker, overcharge checker, CTA
   5. CUSTOMER – Price Check, Request & Bargain, Report & Review, Yearly Ledger
   6. PROVIDER – Job Board, My Price Profile
   7. BOOT    – init, routing, nav, demo controls
   ============================================================ */

'use strict';

/* ============================================================
   SECTION 1 – STORE
   ============================================================ */
const Store = (() => {
  const PREFIX = 'fairfix:';
  let _mem = {}; // in-memory fallback

  function _key(k) { return PREFIX + k; }

  function get(k) {
    try {
      const raw = localStorage.getItem(_key(k));
      return raw ? JSON.parse(raw) : (_mem[k] ?? null);
    } catch (e) {
      return _mem[k] ?? null;
    }
  }

  function set(k, v) {
    try {
      localStorage.setItem(_key(k), JSON.stringify(v));
    } catch (e) {
      _mem[k] = v;
    }
  }

  function getReports() { return get('reports') || []; }
  function setReports(r) { set('reports', r); }
  function getRequests() { return get('requests') || []; }
  function setRequests(r) { set('requests', r); }
  function getEmails() { return get('emails') || []; }
  function setEmails(e) { set('emails', e); }

  function addReport(r) {
    const reports = getReports();
    reports.push(r);
    setReports(reports);
    broadcast({ type: 'REPORT_ADDED', payload: r });
  }

  function addRequest(r) {
    const requests = getRequests();
    requests.push(r);
    setRequests(requests);
    broadcast({ type: 'REQUEST_ADDED', payload: r });
  }

  function updateRequest(id, patch) {
    const requests = getRequests();
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) return;
    Object.assign(requests[idx], patch);
    setRequests(requests);
    broadcast({ type: 'REQUEST_UPDATED', payload: requests[idx] });
  }

  function isSeeded() { return get('seeded') === true; }
  function markSeeded() { set('seeded', true); }
  function clearAll() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch (e) { _mem = {}; }
  }

  // ── BroadcastChannel / storage event sync ──
  let _bc = null;
  const _listeners = [];

  function onSync(fn) { _listeners.push(fn); }

  function broadcast(msg) {
    try {
      if (_bc) _bc.postMessage(msg);
    } catch (e) { /* ignore */ }
  }

  function _dispatch(msg) {
    _listeners.forEach(fn => { try { fn(msg); } catch (e) {} });
  }

  function initSync() {
    try {
      _bc = new BroadcastChannel('fairfix-sync');
      _bc.onmessage = e => _dispatch(e.data);
    } catch (e) {
      // Fallback: storage event
      window.addEventListener('storage', ev => {
        if (ev.key && ev.key.startsWith(PREFIX) && ev.newValue) {
          try { _dispatch({ type: 'STORAGE', key: ev.key }); } catch (e) {}
        }
      });
    }
  }

  return { get, set, getReports, setReports, getRequests, setRequests, getEmails, setEmails, addReport, addRequest, updateRequest, isSeeded, markSeeded, clearAll, onSync, initSync, broadcast };
})();

/* ── JOB CATALOGUE ── */
const CATALOGUE = {
  Plumber: ['Tap Leak', 'Flush Tank Repair', 'Geyser Install', 'Pipe Replacement'],
  Electrician: ['MCB Swap', 'Fan Wiring', 'Switchboard Repair', 'Geyser Point Wiring'],
  Carpenter: ['Door Lock Fix', 'Bed Repair', 'Wardrobe Hinge', 'Modular Shelf'],
  'AC Repair': ['General Service', 'Gas Refill', 'PCB Fix', 'Installation']
};
const SERVICES = Object.keys(CATALOGUE);

const PROVIDERS = {
  Plumber:      ['Ravi Plumbing Works', 'Kumar & Sons Plumbers', 'Suresh Pipe Experts', 'Ali Plumbing Co.'],
  Electrician:  ['Bright Spark Electrics', 'Pandey Electricals', 'VJ Wiring Solutions', 'Nair Electrical Works'],
  Carpenter:    ['Mahesh Carpentry', 'SK Wood Craft', 'Sharma Interiors', 'Arjun Furniture Fixes'],
  'AC Repair':  ['CoolTech AC Services', 'FrostFix HVAC', 'Arctic Breeze Repairs', 'Sunil AC & Fridge']
};

/* ── SEED DATA ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function seedData() {
  if (Store.isSeeded()) return;

  const reports = [];

  const templates = [
    // Plumber
    { service:'Plumber', job:'Tap Leak', provider:'Ravi Plumbing Works', total:280, labour:200, material:60, visit:20, days:1, held:true, again:true },
    { service:'Plumber', job:'Tap Leak', provider:'Kumar & Sons Plumbers', total:350, labour:250, material:80, visit:20, days:1, held:true, again:true },
    { service:'Plumber', job:'Tap Leak', provider:'Suresh Pipe Experts', total:320, labour:230, material:70, visit:20, days:2, held:true, again:false },
    { service:'Plumber', job:'Tap Leak', provider:'Ali Plumbing Co.', total:420, labour:300, material:100, visit:20, days:1, held:true, again:true },
    { service:'Plumber', job:'Tap Leak', provider:'Ravi Plumbing Works', total:290, labour:210, material:60, visit:20, days:1, held:true, again:true },
    { service:'Plumber', job:'Tap Leak', provider:'Kumar & Sons Plumbers', total:1200, labour:900, material:250, visit:50, days:1, held:false, again:false }, // outlier
    { service:'Plumber', job:'Flush Tank Repair', provider:'Suresh Pipe Experts', total:450, labour:300, material:120, visit:30, days:2, held:true, again:true },
    { service:'Plumber', job:'Flush Tank Repair', provider:'Ravi Plumbing Works', total:500, labour:350, material:120, visit:30, days:1, held:true, again:true },
    { service:'Plumber', job:'Flush Tank Repair', provider:'Ali Plumbing Co.', total:480, labour:330, material:120, visit:30, days:2, held:null, again:true },
    { service:'Plumber', job:'Flush Tank Repair', provider:'Kumar & Sons Plumbers', total:550, labour:380, material:140, visit:30, days:3, held:true, again:false },
    { service:'Plumber', job:'Flush Tank Repair', provider:'Suresh Pipe Experts', total:470, labour:320, material:120, visit:30, days:2, held:true, again:true },
    { service:'Plumber', job:'Geyser Install', provider:'Ravi Plumbing Works', total:1200, labour:600, material:500, visit:100, days:3, held:true, again:true },
    { service:'Plumber', job:'Geyser Install', provider:'Kumar & Sons Plumbers', total:1400, labour:700, material:600, visit:100, days:2, held:true, again:true },
    { service:'Plumber', job:'Geyser Install', provider:'Ali Plumbing Co.', total:1350, labour:650, material:600, visit:100, days:3, held:true, again:true },
    { service:'Plumber', job:'Pipe Replacement', provider:'Suresh Pipe Experts', total:2200, labour:1200, material:900, visit:100, days:5, held:true, again:true },
    { service:'Plumber', job:'Pipe Replacement', provider:'Ravi Plumbing Works', total:2500, labour:1400, material:1000, visit:100, days:4, held:true, again:false },
    // Electrician
    { service:'Electrician', job:'MCB Swap', provider:'Bright Spark Electrics', total:350, labour:250, material:80, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'MCB Swap', provider:'Pandey Electricals', total:380, labour:280, material:80, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'MCB Swap', provider:'VJ Wiring Solutions', total:400, labour:300, material:80, visit:20, days:1, held:true, again:false },
    { service:'Electrician', job:'MCB Swap', provider:'Nair Electrical Works', total:320, labour:230, material:70, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'MCB Swap', provider:'Bright Spark Electrics', total:1100, labour:800, material:250, visit:50, days:1, held:false, again:false }, // outlier
    { service:'Electrician', job:'Fan Wiring', provider:'Pandey Electricals', total:500, labour:380, material:100, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'Fan Wiring', provider:'VJ Wiring Solutions', total:480, labour:360, material:100, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'Fan Wiring', provider:'Nair Electrical Works', total:550, labour:420, material:110, visit:20, days:2, held:true, again:true },
    { service:'Electrician', job:'Fan Wiring', provider:'Bright Spark Electrics', total:460, labour:340, material:100, visit:20, days:1, held:null, again:true },
    { service:'Electrician', job:'Switchboard Repair', provider:'Pandey Electricals', total:300, labour:240, material:40, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'Switchboard Repair', provider:'VJ Wiring Solutions', total:280, labour:220, material:40, visit:20, days:1, held:true, again:true },
    { service:'Electrician', job:'Switchboard Repair', provider:'Nair Electrical Works', total:320, labour:260, material:40, visit:20, days:1, held:true, again:false },
    { service:'Electrician', job:'Geyser Point Wiring', provider:'Bright Spark Electrics', total:1800, labour:1200, material:500, visit:100, days:3, held:true, again:true },
    { service:'Electrician', job:'Geyser Point Wiring', provider:'Pandey Electricals', total:2000, labour:1300, material:600, visit:100, days:2, held:true, again:true },
    // Carpenter
    { service:'Carpenter', job:'Door Lock Fix', provider:'Mahesh Carpentry', total:400, labour:300, material:80, visit:20, days:1, held:true, again:true },
    { service:'Carpenter', job:'Door Lock Fix', provider:'SK Wood Craft', total:380, labour:280, material:80, visit:20, days:1, held:true, again:true },
    { service:'Carpenter', job:'Door Lock Fix', provider:'Sharma Interiors', total:420, labour:320, material:80, visit:20, days:1, held:true, again:false },
    { service:'Carpenter', job:'Door Lock Fix', provider:'Arjun Furniture Fixes', total:360, labour:260, material:80, visit:20, days:1, held:true, again:true },
    { service:'Carpenter', job:'Bed Repair', provider:'Mahesh Carpentry', total:800, labour:600, material:160, visit:40, days:2, held:true, again:true },
    { service:'Carpenter', job:'Bed Repair', provider:'SK Wood Craft', total:900, labour:680, material:180, visit:40, days:2, held:true, again:true },
    { service:'Carpenter', job:'Bed Repair', provider:'Sharma Interiors', total:850, labour:640, material:170, visit:40, days:3, held:null, again:true },
    { service:'Carpenter', job:'Wardrobe Hinge', provider:'Arjun Furniture Fixes', total:200, labour:160, material:20, visit:20, days:1, held:true, again:true },
    { service:'Carpenter', job:'Wardrobe Hinge', provider:'Mahesh Carpentry', total:220, labour:180, material:20, visit:20, days:1, held:true, again:true },
    { service:'Carpenter', job:'Wardrobe Hinge', provider:'SK Wood Craft', total:180, labour:140, material:20, visit:20, days:1, held:true, again:false },
    { service:'Carpenter', job:'Modular Shelf', provider:'Sharma Interiors', total:2800, labour:1800, material:900, visit:100, days:5, held:true, again:true },
    { service:'Carpenter', job:'Modular Shelf', provider:'Arjun Furniture Fixes', total:3200, labour:2000, material:1100, visit:100, days:6, held:true, again:true },
    // AC Repair
    { service:'AC Repair', job:'General Service', provider:'CoolTech AC Services', total:600, labour:450, material:100, visit:50, days:1, held:true, again:true },
    { service:'AC Repair', job:'General Service', provider:'FrostFix HVAC', total:650, labour:500, material:100, visit:50, days:1, held:true, again:true },
    { service:'AC Repair', job:'General Service', provider:'Arctic Breeze Repairs', total:580, labour:430, material:100, visit:50, days:1, held:null, again:true },
    { service:'AC Repair', job:'General Service', provider:'Sunil AC & Fridge', total:700, labour:550, material:100, visit:50, days:2, held:true, again:false },
    { service:'AC Repair', job:'General Service', provider:'CoolTech AC Services', total:620, labour:470, material:100, visit:50, days:1, held:true, again:true },
    { service:'AC Repair', job:'General Service', provider:'FrostFix HVAC', total:1800, labour:1400, material:300, visit:100, days:1, held:false, again:false }, // outlier
    { service:'AC Repair', job:'Gas Refill', provider:'Arctic Breeze Repairs', total:1800, labour:800, material:900, visit:100, days:1, held:true, again:true },
    { service:'AC Repair', job:'Gas Refill', provider:'Sunil AC & Fridge', total:2000, labour:900, material:1000, visit:100, days:1, held:true, again:true },
    { service:'AC Repair', job:'Gas Refill', provider:'CoolTech AC Services', total:1900, labour:850, material:950, visit:100, days:2, held:true, again:false },
    { service:'AC Repair', job:'Gas Refill', provider:'FrostFix HVAC', total:2100, labour:950, material:1050, visit:100, days:1, held:true, again:true },
    { service:'AC Repair', job:'PCB Fix', provider:'Arctic Breeze Repairs', total:2500, labour:1500, material:900, visit:100, days:3, held:true, again:true },
    { service:'AC Repair', job:'PCB Fix', provider:'Sunil AC & Fridge', total:2800, labour:1700, material:1000, visit:100, days:4, held:true, again:true },
    { service:'AC Repair', job:'PCB Fix', provider:'CoolTech AC Services', total:2600, labour:1600, material:900, visit:100, days:3, held:null, again:true },
    { service:'AC Repair', job:'Installation', provider:'FrostFix HVAC', total:3500, labour:2000, material:1300, visit:200, days:4, held:true, again:true },
    { service:'AC Repair', job:'Installation', provider:'Arctic Breeze Repairs', total:3800, labour:2200, material:1400, visit:200, days:5, held:true, again:true },
  ];

  // Spread across last 12 months
  const len = templates.length;
  templates.forEach((t, i) => {
    const daysBack = Math.round((i / len) * 365);
    reports.push({
      id: uid(),
      service: t.service,
      job: t.job,
      provider: t.provider,
      total: t.total,
      labour: t.labour,
      material: t.material,
      visit: t.visit,
      daysTaken: t.days,
      heldAfter30: t.held,
      wouldCallAgain: t.again,
      verified: false,
      date: daysAgo(daysBack),
      author: 'neighbour',
      sample: true
    });
  });

  Store.setReports(reports);

  // Seed 2 open requests
  const seedRequests = [
    {
      id: uid(),
      service: 'AC Repair',
      job: 'General Service',
      description: 'Split AC in bedroom not cooling well, last serviced 8 months ago.',
      preferredTime: 'Weekend morning',
      offer: 550,
      status: 'open',
      counterPrice: null,
      providerName: null,
      note: null,
      createdAt: daysAgo(1),
      history: [{ event: 'posted', at: daysAgo(1) }],
      author: 'neighbour-A'
    },
    {
      id: uid(),
      service: 'Plumber',
      job: 'Tap Leak',
      description: 'Kitchen tap dripping constantly, need same-day fix.',
      preferredTime: 'Weekday afternoon',
      offer: 300,
      status: 'open',
      counterPrice: null,
      providerName: null,
      note: null,
      createdAt: daysAgo(2),
      history: [{ event: 'posted', at: daysAgo(2) }],
      author: 'neighbour-B'
    }
  ];

  Store.setRequests(seedRequests);
  Store.markSeeded();
}

/* ============================================================
   SECTION 2 – STATS (pure, testable)
   ============================================================ */
const Stats = (() => {
  // Local formatter so Stats has no dependency on UI
  function _fmt(n) {
    try { return Number(n).toLocaleString('en-IN'); } catch(e) { return String(n); }
  }

  function sorted(arr) {
    return [...arr].sort((a, b) => a - b);
  }

  function median(values) {
    if (!values || values.length === 0) return null;
    const s = sorted(values);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  }

  function percentile(values, p) {
    if (!values || values.length === 0) return null;
    const s = sorted(values);
    const idx = (p / 100) * (s.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  }

  function mean(values) {
    if (!values || values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Compute stats for a job. Returns:
   * { n, hasEnough, median, low, high, outliers, clean, p20 }
   */
  function jobStats(reports) {
    const totals = reports.map(r => r.total);
    const n = totals.length;

    if (n < 3) {
      return { n, hasEnough: false, median: null, low: null, high: null, outliers: [], clean: reports, p20: null };
    }

    const med = median(totals);

    // separate outliers (>50% from median)
    const outliers = reports.filter(r => Math.abs(r.total - med) / med > 0.50);
    const clean = reports.filter(r => Math.abs(r.total - med) / med <= 0.50);

    // recalculate on clean set
    const cleanTotals = clean.map(r => r.total);
    const finalMedian = median(cleanTotals) ?? med;
    const low = percentile(cleanTotals, 10) ?? Math.min(...cleanTotals);
    const high = percentile(cleanTotals, 90) ?? Math.max(...cleanTotals);
    const p20 = percentile(cleanTotals, 20);

    return { n, hasEnough: true, median: Math.round(finalMedian), low: Math.round(low), high: Math.round(high), outliers, clean, p20: Math.round(p20) };
  }

  /**
   * Overcharge assessment: quote vs median
   * Returns { level: 'fair'|'high'|'very-high', label, ratio, diff, rangeText, script }
   */
  function overchargeLevel(quote, stats) {
    if (!stats.hasEnough) return null;
    const ratio = quote / stats.median;
    let level, label;
    if (ratio <= 1.15) { level = 'fair'; label = 'Fair ✓'; }
    else if (ratio <= 1.40) { level = 'high'; label = 'High ⚠'; }
    else { level = 'very-high'; label = 'Very High ⚡'; }

    const diff = Math.round(quote - stats.median);
    const rangeText = `₹${_fmt(stats.low)} – ₹${_fmt(stats.high)}`;
    const script = level === 'fair'
      ? `Looks fair! Neighbours paid ${rangeText} for this.`
      : `Neighbours paid ${rangeText} for this. Can you break down labour and material? Most neighbours paid around ₹${_fmt(stats.median)}.`;

    return { level, label, ratio, diff, rangeText, script };
  }

  /**
   * Offer position for the fair-offer marker
   * Returns { pct: 0-100 position on range bar, zone: 'low'|'fair'|'high', percentileRank }
   */
  function offerPosition(offer, stats) {
    if (!stats.hasEnough) return null;
    const { low, high, p20, median: med } = stats;
    const range = high - low;
    if (range === 0) return { pct: 50, zone: 'fair', percentileRank: 50 };
    const pct = Math.max(0, Math.min(100, ((offer - low) / range) * 100));
    const zone = offer < p20 ? 'low' : offer > high * 1.1 ? 'high' : 'fair';
    // approx percentile rank
    const rank = Math.max(0, Math.min(100, pct));
    return { pct, zone, percentileRank: Math.round(rank) };
  }

  /** Provider trust stats for a given provider name */
  function providerStats(reports, name) {
    const mine = reports.filter(r => r.provider === name);
    if (mine.length === 0) return { n: 0, againPct: null, heldPct: null, avgPrice: null };
    const againPct = Math.round((mine.filter(r => r.wouldCallAgain).length / mine.length) * 100);
    const withHeld = mine.filter(r => r.heldAfter30 !== null);
    const heldPct = withHeld.length > 0 ? Math.round((withHeld.filter(r => r.heldAfter30).length / withHeld.length) * 100) : null;
    const avgPrice = Math.round(mean(mine.map(r => r.total)));
    return { n: mine.length, againPct, heldPct, avgPrice };
  }

  return { median, percentile, mean, jobStats, overchargeLevel, offerPosition, providerStats };
})();

/* ============================================================
   SECTION 3 – UI HELPERS
   ============================================================ */
const UI = (() => {
  function fmt(n) {
    try { return Number(n).toLocaleString('en-IN'); } catch (e) { return String(n); }
  }
  function fmtRs(n) { return '₹' + fmt(n); }

  // ── Toast ──
  const toastContainer = document.getElementById('toast-container');
  function toast(msg, type = '', duration = 3500) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => { el.classList.add('show'); });
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  // ── Range bar renderer ──
  function renderRangeBar(container, { low, high, marker, markerLabel, showFair = true, min = null, max = null }) {
    const lo = min ?? low * 0.7;
    const hi = max ?? high * 1.3;
    const range = hi - lo;
    if (range <= 0) { container.innerHTML = ''; return; }
    const toPct = v => Math.max(0, Math.min(100, ((v - lo) / range) * 100));

    const fairLeft = toPct(low);
    const fairWidth = toPct(high) - fairLeft;
    const markerPct = marker != null ? toPct(marker) : null;

    let markerClass = '';
    if (markerPct !== null) {
      if (marker < low * 0.8) markerClass = 'danger';
      else if (marker < low) markerClass = 'warning';
    }

    container.innerHTML = `
      <div class="range-bar-label">
        <span>Low: ${fmtRs(Math.round(lo))}</span>
        ${markerLabel ? `<span style="color:var(--accent);font-weight:600">${markerLabel}</span>` : ''}
        <span>High: ${fmtRs(Math.round(hi))}</span>
      </div>
      <div class="range-bar">
        ${showFair ? `<div class="range-bar-fair" style="left:${fairLeft}%;width:${fairWidth}%"></div>` : ''}
        <div class="range-bar-track" style="left:${toPct(low)}%;width:${toPct(high)-toPct(low)}%"></div>
        ${markerPct !== null ? `<div class="range-bar-marker ${markerClass}" style="left:${markerPct}%" title="${markerLabel || ''}"></div>` : ''}
      </div>
      <div class="range-bar-values">
        <span>${fmtRs(Math.round(low))}</span>
        <span style="color:var(--accent);font-weight:700">Median: ${fmtRs(Math.round((low+high)/2))}</span>
        <span>${fmtRs(Math.round(high))}</span>
      </div>
    `;
  }

  // ── Populate a <select> from an array ──
  function populateSelect(el, options, placeholder = '— select —') {
    const prev = el.value;
    el.innerHTML = `<option value="">${placeholder}</option>` + options.map(o => `<option value="${o}">${o}</option>`).join('');
    if (prev && options.includes(prev)) el.value = prev;
  }

  // ── Show inline error ──
  function showError(inputEl, msg) {
    inputEl.classList.add('error');
    let err = inputEl.parentElement.querySelector('.form-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'form-error';
      inputEl.parentElement.appendChild(err);
    }
    err.textContent = msg;
  }
  function clearError(inputEl) {
    inputEl.classList.remove('error');
    const err = inputEl.parentElement.querySelector('.form-error');
    if (err) err.remove();
  }

  // ── Empty state ──
  function emptyState(msg, detail = '') {
    return `<div class="empty-state fade-in">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"/>
      </svg>
      <h3>${msg}</h3>
      ${detail ? `<p>${detail}</p>` : ''}
    </div>`;
  }

  // ── Status badge ──
  function statusBadge(status) {
    const map = {
      open: ['badge-info', 'Pending'],
      countered: ['badge-warning', 'Countered'],
      accepted: ['badge-success', 'Accepted'],
      declined: ['badge-neutral', 'Declined']
    };
    const [cls, label] = map[status] || ['badge-neutral', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ── Date format ──
  function relDate(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const m = Math.floor(d / 30);
    return `${m}mo ago`;
  }

  // ── Read select or custom typing field ──
  function val(selId, customId) {
    const c = customId ? document.getElementById(customId)?.value.trim() : '';
    if (c) return c;
    return document.getElementById(selId)?.value || '';
  }

  function bindCustom(selId, customId, onChange) {
    const sel = document.getElementById(selId);
    const cus = document.getElementById(customId);
    if (!sel || !cus) return;
    sel.addEventListener('change', () => {
      if (sel.value) cus.value = '';
      if (onChange) onChange();
    });
    cus.addEventListener('input', () => {
      if (cus.value.trim()) sel.value = '';
      if (onChange) onChange();
    });
  }

  return { fmt, fmtRs, toast, renderRangeBar, populateSelect, showError, clearError, emptyState, statusBadge, relDate, val, bindCustom };
})();

/* ============================================================
   SECTION 4 – LANDING
   ============================================================ */
const Landing = (() => {
  let heroCountDone = false;

  function init() {
    document.getElementById('btn-customer').addEventListener('click', () => App.setRole('customer'));
    document.getElementById('btn-provider').addEventListener('click', () => App.setRole('provider'));
    initCheckerForm();
    initCTA();
    animateHero();
  }

  function initCheckerForm() {
    const svcSel = document.getElementById('lc-service');
    const jobSel = document.getElementById('lc-job');
    const quoteInput = document.getElementById('lc-quote');
    const checkBtn = document.getElementById('lc-check');
    const resultDiv = document.getElementById('lc-result');

    UI.populateSelect(svcSel, SERVICES, '— Service —');
    svcSel.addEventListener('change', () => {
      const jobs = CATALOGUE[svcSel.value] || [];
      UI.populateSelect(jobSel, jobs, '— Job —');
      resultDiv.innerHTML = '';
    });
    UI.bindCustom('lc-service', 'lc-service-custom', () => { resultDiv.innerHTML = ''; });
    UI.bindCustom('lc-job', 'lc-job-custom', () => { resultDiv.innerHTML = ''; });

    checkBtn.addEventListener('click', () => {
      UI.clearError(quoteInput);
      const service = UI.val('lc-service', 'lc-service-custom');
      const job = UI.val('lc-job', 'lc-job-custom');
      const quote = parseFloat(quoteInput.value);

      if (!service) { UI.showError(svcSel, 'Pick or type a service'); return; }
      if (!job) { UI.showError(jobSel, 'Pick or type a job'); return; }
      if (!quote || quote <= 0) { UI.showError(quoteInput, 'Enter a valid quote'); return; }

      const reports = Store.getReports().filter(r => r.service === service && r.job === job);
      const stats = Stats.jobStats(reports);

      if (!stats.hasEnough) {
        resultDiv.innerHTML = `<div class="card" style="margin-top:12px">
          <p style="color:var(--text-muted)">Not enough data yet (n = ${stats.n}). We need at least 3 reports for this job.</p>
        </div>`;
        return;
      }

      const oc = Stats.overchargeLevel(quote, stats);
      resultDiv.innerHTML = renderOCResult(oc, stats, quote);
      resultDiv.querySelector('.copy-script')?.addEventListener('click', e => {
        navigator.clipboard?.writeText(oc.script).then(() => UI.toast('Counter script copied!', 'success'));
      });
    });
  }

  function renderOCResult(oc, stats, quote) {
    const diff = oc.diff > 0 ? `+₹${UI.fmt(oc.diff)} above median` : `₹${UI.fmt(Math.abs(oc.diff))} below median`;
    return `<div class="checker-result ${oc.level} animate-in" style="margin-top:12px">
      <div class="checker-verdict ${oc.level}">${oc.label}</div>
      <div style="font-size:0.875rem">
        You were quoted <span class="font-mono font-bold">${UI.fmtRs(quote)}</span>.
        Neighbours paid <span class="font-mono font-bold">${oc.rangeText}</span> (median ${UI.fmtRs(stats.median)}).
        That's <strong>${diff}</strong>.
      </div>
      ${oc.level !== 'fair' ? `
        <div class="counter-script">
          <span class="counter-script-text">${oc.script}</span>
        </div>
        <button class="btn btn-secondary btn-sm copy-script">📋 Copy counter script</button>
      ` : `<p style="color:var(--success)">This quote aligns with what your neighbours paid. ✓</p>`}
    </div>`;
  }

  function initCTA() {
    const form = document.getElementById('cta-form');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = form.querySelector('input[type=email]').value.trim();
      if (!email) return;
      const emails = Store.getEmails();
      if (!emails.includes(email)) { emails.push(email); Store.setEmails(emails); }
      form.innerHTML = '<p style="color:white;font-weight:600">🎉 You\'re on the list! We\'ll reach out soon.</p>';
    });
  }

  function animateHero() {
    if (heroCountDone) return;
    heroCountDone = true;
    // count-up animation for hero stat
    const els = document.querySelectorAll('[data-countup]');
    els.forEach(el => {
      const target = parseInt(el.dataset.countup);
      let cur = 0;
      const step = target / 40;
      const timer = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = UI.fmt(Math.round(cur));
        if (cur >= target) clearInterval(timer);
      }, 30);
    });
  }

  // Expose renderOCResult for reuse
  return { init, renderOCResult };
})();

/* ============================================================
   SECTION 5 – CUSTOMER
   ============================================================ */
const Customer = (() => {

  /* ── 5A. Price Check ── */
  const PriceCheck = (() => {
    let currentStats = null;
    let currentService = '', currentJob = '';

    function init() {
      const svcSel = document.getElementById('pc-service');
      const jobSel = document.getElementById('pc-job');
      UI.populateSelect(svcSel, SERVICES, '— Service —');
      svcSel.addEventListener('change', () => {
        UI.populateSelect(jobSel, CATALOGUE[svcSel.value] || [], '— Job —');
        currentService = UI.val('pc-service', 'pc-service-custom');
        currentJob = '';
        renderRateCard(null, null);
      });
      UI.bindCustom('pc-service', 'pc-service-custom', () => {
        currentService = UI.val('pc-service', 'pc-service-custom');
        currentJob = UI.val('pc-job', 'pc-job-custom');
        if (currentService && currentJob) loadRateCard();
        else renderRateCard(null, null);
      });
      UI.bindCustom('pc-job', 'pc-job-custom', () => {
        currentService = UI.val('pc-service', 'pc-service-custom');
        currentJob = UI.val('pc-job', 'pc-job-custom');
        if (currentService && currentJob) loadRateCard();
      });
      initOverchargeChecker();
    }

    function loadRateCard() {
      const reports = Store.getReports().filter(r => r.service === currentService && r.job === currentJob);
      const stats = Stats.jobStats(reports);
      currentStats = stats;
      renderRateCard(stats, reports);
      refreshOverchargeCheckerStats();
    }

    function renderRateCard(stats, reports) {
      const el = document.getElementById('pc-rate-card');
      if (!currentService || !currentJob) { el.innerHTML = ''; return; }

      if (!stats || !stats.hasEnough) {
        const n = stats ? stats.n : 0;
        el.innerHTML = `<div class="card fade-in">
          <h3>${currentJob} <span class="text-muted">· ${currentService}</span></h3>
          <p class="text-muted mt-8">Not enough data yet (n = ${n}). We need at least 3 reports to show a rate card.</p>
          ${n > 0 ? `<p class="text-muted" style="font-size:0.8rem">${n} report${n>1?'s':''} so far — be the first to add more!</p>` : ''}
        </div>`;
        return;
      }

      // Avg labour/material/visit split
      const cleanReports = stats.clean;
      const avgL = Stats.mean(cleanReports.map(r => r.labour)) || 0;
      const avgM = Stats.mean(cleanReports.map(r => r.material)) || 0;
      const avgV = Stats.mean(cleanReports.map(r => r.visit)) || 0;
      const total = avgL + avgM + avgV || 1;
      const pL = Math.round((avgL / total) * 100);
      const pM = Math.round((avgM / total) * 100);
      const pV = 100 - pL - pM;

      // Provider trust
      const allProviders = [...new Set(reports.map(r => r.provider))];
      const providerHTML = allProviders.map(name => {
        const ps = Stats.providerStats(reports, name);
        const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return `<div class="provider-row">
          <div class="provider-avatar">${initials}</div>
          <div class="provider-info">
            <div class="provider-name">${name}</div>
            <div class="provider-meta">${ps.n} report${ps.n > 1 ? 's' : ''} · avg ${UI.fmtRs(ps.avgPrice)}</div>
          </div>
          <div class="provider-stats">
            ${ps.againPct !== null ? `<span class="badge badge-success">👍 ${ps.againPct}% again</span>` : ''}
            ${ps.heldPct !== null ? `<span class="badge badge-accent">🛡 ${ps.heldPct}% held 30d</span>` : ''}
          </div>
        </div>`;
      }).join('');

      // Outlier rows
      const outlierHTML = stats.outliers.length > 0 ? `
        <div>
          <h4 class="mb-8">Unusual Reports (outliers, excluded from stats)</h4>
          <div class="outlier-list">
            ${stats.outliers.map(r => `
              <div class="outlier-row">
                <span class="amount">${UI.fmtRs(r.total)}</span>
                <span class="text-muted" style="margin-left:8px">by ${r.provider} · ${UI.relDate(r.date)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      el.innerHTML = `<div class="rate-card fade-in">
        <div class="rate-card-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div>
              <h3>${currentJob}</h3>
              <div style="opacity:0.85;font-size:0.875rem;margin-top:2px">${currentService} · RAMAIAH-BLK-A</div>
            </div>
            <span class="badge">${stats.n} reports</span>
          </div>
        </div>
        <div class="rate-card-body">
          <div>
            <div class="card-title">Neighbour Median</div>
            <div class="median-price">${UI.fmtRs(stats.median)} <small>/ job</small></div>
          </div>

          <div id="pc-range-bar"></div>

          <div>
            <div class="card-title mb-8">Average Labour vs Material Split</div>
            <div class="split-bar">
              <div class="split-bar-labour" style="width:${pL}%" title="Labour ${pL}%"></div>
              <div class="split-bar-material" style="width:${pM}%" title="Material ${pM}%"></div>
              <div class="split-bar-visit" style="width:${pV}%" title="Visit ${pV}%"></div>
            </div>
            <div class="split-legend mt-8">
              <span class="split-legend-item"><span class="split-dot" style="background:var(--accent)"></span>Labour ${pL}% (avg ${UI.fmtRs(Math.round(avgL))})</span>
              <span class="split-legend-item"><span class="split-dot" style="background:var(--accent-light)"></span>Material ${pM}% (avg ${UI.fmtRs(Math.round(avgM))})</span>
              <span class="split-legend-item"><span class="split-dot" style="background:var(--border-strong)"></span>Visit ${pV}% (avg ${UI.fmtRs(Math.round(avgV))})</span>
            </div>
          </div>

          ${outlierHTML}

          <div>
            <h4 class="mb-12">Provider Trust</h4>
            <div class="provider-list">${providerHTML || '<p class="text-muted">No providers recorded yet.</p>'}</div>
          </div>
        </div>
      </div>`;

      // Render range bar inside the card
      UI.renderRangeBar(document.getElementById('pc-range-bar'), { low: stats.low, high: stats.high, marker: stats.median, markerLabel: 'Median' });
    }

    function initOverchargeChecker() {
      const quoteInput = document.getElementById('pc-quote');
      const checkBtn = document.getElementById('pc-check-btn');
      const resultDiv = document.getElementById('pc-oc-result');

      checkBtn.addEventListener('click', () => {
        UI.clearError(quoteInput);
        if (!currentStats || !currentStats.hasEnough) {
          UI.toast('Select a job with enough data first.', 'warning'); return;
        }
        const quote = parseFloat(quoteInput.value);
        if (!quote || quote <= 0) { UI.showError(quoteInput, 'Enter your quote'); return; }
        const oc = Stats.overchargeLevel(quote, currentStats);
        resultDiv.innerHTML = Landing.renderOCResult(oc, currentStats, quote);
        resultDiv.querySelector('.copy-script')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(oc.script).then(() => UI.toast('Copied!', 'success'));
        });
      });
    }

    function refreshOverchargeCheckerStats() {
      // Update the OC checker section visibility
      const wrap = document.getElementById('pc-checker-wrap');
      if (wrap) wrap.style.display = currentStats && currentStats.hasEnough ? '' : 'none';
    }

    function refresh() {
      if (currentService && currentJob) loadRateCard();
    }

    return { init, refresh };
  })();

  /* ── 5B. Request & Bargain ── */
  const RequestBargain = (() => {
    function init() {
      const svcSel = document.getElementById('rb-service');
      const jobSel = document.getElementById('rb-job');
      UI.populateSelect(svcSel, SERVICES, '— Service —');
      svcSel.addEventListener('change', () => UI.populateSelect(jobSel, CATALOGUE[svcSel.value] || [], '— Job —'));
      UI.bindCustom('rb-service', 'rb-service-custom', updateOfferMarker);
      UI.bindCustom('rb-job', 'rb-job-custom', updateOfferMarker);

      const offerInput = document.getElementById('rb-offer');
      offerInput.addEventListener('input', updateOfferMarker);

      document.getElementById('rb-submit').addEventListener('click', submitRequest);
      renderMyRequests();
    }

    function getJobStats() {
      const svc = UI.val('rb-service', 'rb-service-custom');
      const job = UI.val('rb-job', 'rb-job-custom');
      if (!svc || !job) return null;
      const reports = Store.getReports().filter(r => r.service === svc && r.job === job);
      return Stats.jobStats(reports);
    }

    function updateOfferMarker() {
      const offer = parseFloat(document.getElementById('rb-offer').value);
      const barWrap = document.getElementById('rb-offer-bar');
      const hint = document.getElementById('rb-offer-hint');
      const stats = getJobStats();

      if (!stats || !stats.hasEnough || !offer || isNaN(offer)) {
        barWrap.innerHTML = '';
        hint.className = 'offer-hint';
        hint.textContent = '';
        return;
      }

      UI.renderRangeBar(barWrap, { low: stats.low, high: stats.high, marker: offer, markerLabel: `Your offer: ${UI.fmtRs(offer)}` });

      const pos = Stats.offerPosition(offer, stats);
      if (pos) {
        const floor = Math.round(stats.median * 0.7);
        if (offer < floor) {
          hint.className = 'offer-hint danger';
          hint.textContent = `Offers this low push good providers out. Pick at least ${UI.fmtRs(floor)}.`;
        } else if (pos.zone === 'low') {
          hint.className = 'offer-hint warning';
          hint.textContent = `Only ~${pos.percentileRank}% of neighbours paid this little — expect a counter offer.`;
        } else {
          hint.className = 'offer-hint info';
          hint.textContent = `Your offer is in the fair zone (neighbours paid ${UI.fmtRs(stats.low)}–${UI.fmtRs(stats.high)}).`;
        }
      }
    }

    function submitRequest() {
      const fields = {
        service: document.getElementById('rb-service'),
        job: document.getElementById('rb-job'),
        description: document.getElementById('rb-description'),
        preferredTime: document.getElementById('rb-time'),
        offer: document.getElementById('rb-offer')
      };

      let valid = true;
      Object.values(fields).forEach(f => UI.clearError(f));

      const svcVal = UI.val('rb-service', 'rb-service-custom');
      const jobVal = UI.val('rb-job', 'rb-job-custom');
      if (!svcVal) { UI.showError(fields.service, 'Select or type a service'); valid = false; }
      if (!jobVal) { UI.showError(fields.job, 'Select or type a job type'); valid = false; }
      if (!fields.description.value.trim()) { UI.showError(fields.description, 'Describe the job'); valid = false; }
      if (!fields.offer.value) { UI.showError(fields.offer, 'Enter your offer'); valid = false; }

      const offer = parseFloat(fields.offer.value);
      if (offer <= 0 || isNaN(offer)) { UI.showError(fields.offer, 'Enter a valid amount'); valid = false; }

      if (valid) {
        const stats = getJobStats();
        if (stats && stats.hasEnough) {
          const floor = Math.round(stats.median * 0.7);
          if (offer < floor) {
            UI.showError(fields.offer, `Minimum offer is ${UI.fmtRs(floor)} (70% of median). Offers this low push good providers out.`);
            return;
          }
        }
      }

      if (!valid) return;

      const req = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        service: svcVal,
        job: jobVal,
        description: fields.description.value.trim(),
        preferredTime: fields.preferredTime.value.trim() || 'Flexible',
        offer,
        status: 'open',
        counterPrice: null,
        providerName: null,
        note: null,
        createdAt: new Date().toISOString(),
        history: [{ event: 'posted', at: new Date().toISOString() }],
        author: 'You'
      };

      Store.addRequest(req);
      UI.toast('Request posted! Waiting for providers.', 'success');

      // Reset form
      ['rb-service', 'rb-service-custom', 'rb-job', 'rb-job-custom', 'rb-description', 'rb-time', 'rb-offer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('rb-offer-bar').innerHTML = '';
      document.getElementById('rb-offer-hint').className = 'offer-hint';
      UI.populateSelect(document.getElementById('rb-job'), [], '— Job —');

      renderMyRequests();
    }

    function renderMyRequests() {
      const container = document.getElementById('rb-my-requests');
      const requests = Store.getRequests().filter(r => r.author === 'You');
      if (requests.length === 0) {
        container.innerHTML = UI.emptyState('No requests yet', 'Post a request above to get quotes from providers.');
        return;
      }
      container.innerHTML = [...requests].reverse().map(r => renderRequestCard(r)).join('');
      // Attach event handlers
      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', handleRequestAction);
      });
    }

    function renderRequestCard(r) {
      const reports = Store.getReports().filter(rep => rep.service === r.service && rep.job === r.job);
      const stats = Stats.jobStats(reports);
      const medTxt = stats.hasEnough ? `Neighbour median: ${UI.fmtRs(stats.median)}` : '';

      if (r.status === 'countered') {
        const above = stats.hasEnough ? (r.counterPrice >= stats.median ? '✓ At or above fair' : '⚠ Below fair') : '';
        return `<div class="counter-card animate-in" id="rc-${r.id}">
          <div class="request-card-header">
            <div class="request-card-title">
              <h4>${r.job} · ${r.service}</h4>
              <span>${r.description}</span>
            </div>
            ${UI.statusBadge(r.status)}
          </div>
          <div>
            <strong>${r.providerName || 'Provider'}</strong> countered at
            <span class="font-mono font-bold" style="font-size:1.1rem;color:var(--warning)">${UI.fmtRs(r.counterPrice)}</span>
            ${medTxt ? `<span class="text-muted" style="font-size:0.8rem"> · ${medTxt} ${above}</span>` : ''}
            ${r.note ? `<div class="text-secondary" style="font-size:0.875rem;margin-top:6px;font-style:italic">"${r.note}"</div>` : ''}
          </div>
          <div class="counter-actions">
            <button class="btn btn-success btn-sm" data-action="accept" data-id="${r.id}">Accept</button>
            <button class="btn btn-secondary btn-sm" data-action="walkaway" data-id="${r.id}">Walk Away</button>
          </div>
          <div class="counter-input-row" id="cb-row-${r.id}" style="display:none">
            <div class="form-group">
              <label class="form-label">Your Counter (₹)</label>
              <input type="number" class="form-control" id="cb-price-${r.id}" placeholder="e.g. 580" min="1">
            </div>
            <button class="btn btn-primary btn-sm" data-action="counterback" data-id="${r.id}">Send Counter</button>
          </div>
          <button class="btn btn-ghost btn-sm" data-action="showcounter" data-id="${r.id}">Counter back ↩</button>
        </div>`;
      }

      if (r.status === 'accepted') {
        return `<div class="deal-confirmed animate-in" id="rc-${r.id}">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--success)">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <h3>Deal Confirmed! 🎉</h3>
          <p><strong>${r.providerName}</strong> accepted your request for <strong>${r.job}</strong> at <span class="font-mono font-bold">${UI.fmtRs(r.counterPrice || r.offer)}</span></p>
          <button class="btn btn-primary btn-sm" data-action="log-report" data-id="${r.id}">Log this as a Report →</button>
        </div>`;
      }

      return `<div class="request-card" id="rc-${r.id}">
        <div class="request-card-header">
          <div class="request-card-title">
            <h4>${r.job} · ${r.service}</h4>
            <span>${UI.relDate(r.createdAt)}</span>
          </div>
          ${UI.statusBadge(r.status)}
        </div>
        <div class="flex gap-12 flex-wrap">
          <span>Offer: <span class="font-mono font-bold">${UI.fmtRs(r.offer)}</span></span>
          ${medTxt ? `<span class="text-muted" style="font-size:0.85rem">${medTxt}</span>` : ''}
        </div>
        <div class="text-secondary" style="font-size:0.85rem">${r.description}</div>
        ${r.status === 'declined' ? `<div class="text-muted" style="font-size:0.8rem">Provider declined this request.</div>` : ''}
      </div>`;
    }

    function handleRequestAction(e) {
      const { action, id } = e.target.dataset;
      if (!id) return;
      const req = Store.getRequests().find(r => r.id === id);
      if (!req) return;

      if (action === 'accept') {
        Store.updateRequest(id, {
          status: 'accepted',
          history: [...(req.history||[]), { event: 'customer-accepted', at: new Date().toISOString() }]
        });
        UI.toast('Deal accepted!', 'success');
        renderMyRequests();
      } else if (action === 'walkaway') {
        Store.updateRequest(id, {
          status: 'declined',
          history: [...(req.history||[]), { event: 'customer-walked-away', at: new Date().toISOString() }]
        });
        UI.toast('Request closed.', '');
        renderMyRequests();
      } else if (action === 'showcounter') {
        document.getElementById(`cb-row-${id}`).style.display = 'flex';
        e.target.style.display = 'none';
      } else if (action === 'counterback') {
        const price = parseFloat(document.getElementById(`cb-price-${id}`)?.value);
        if (!price || price <= 0) { UI.toast('Enter a valid price', 'error'); return; }
        Store.updateRequest(id, {
          status: 'countered',
          offer: price,
          counterPrice: price,
          history: [...(req.history||[]), { event: `customer-countered-${price}`, at: new Date().toISOString() }]
        });
        UI.toast('Counter sent!', 'success');
        renderMyRequests();
      } else if (action === 'log-report') {
        // Prefill report form
        const req2 = Store.getRequests().find(r => r.id === id);
        if (req2) {
          document.getElementById('rr-service').value = req2.service;
          document.getElementById('rr-service').dispatchEvent(new Event('change'));
          setTimeout(() => {
            document.getElementById('rr-job').value = req2.job;
            if (req2.providerName) document.getElementById('rr-provider').value = req2.providerName;
          }, 50);
        }
        App.navigate('customer', 'report');
        UI.toast('Report form pre-filled from your deal!', 'success');
      }
    }

    function refresh() { renderMyRequests(); }
    return { init, refresh, renderMyRequests };
  })();

  /* ── 5C. Report & Review ── */
  const Report = (() => {
    function init() {
      const svcSel = document.getElementById('rr-service');
      const jobSel = document.getElementById('rr-job');
      UI.populateSelect(svcSel, SERVICES, '— Service —');
      svcSel.addEventListener('change', () => {
        UI.populateSelect(jobSel, CATALOGUE[svcSel.value] || [], '— Job —');
        populateProviders();
      });
      UI.bindCustom('rr-service', 'rr-service-custom', populateProviders);
      UI.bindCustom('rr-job', 'rr-job-custom', populateProviders);
      UI.bindCustom('rr-provider', 'rr-provider-custom');

      // Auto-calculate total
      ['rr-labour', 'rr-material', 'rr-visit'].forEach(id => {
        document.getElementById(id).addEventListener('input', autoCalcTotal);
      });

      // Receipt preview
      const receiptInput = document.getElementById('rr-receipt');
      if (receiptInput) {
        receiptInput.addEventListener('change', () => {
          const preview = document.getElementById('rr-receipt-preview');
          if (receiptInput.files && receiptInput.files[0]) {
            const url = URL.createObjectURL(receiptInput.files[0]);
            preview.innerHTML = `<img src="${url}" alt="Receipt preview">`;
            preview.style.display = 'block';
          }
        });
      }

      document.getElementById('rr-submit').addEventListener('click', submitReport);
    }

    function populateProviders() {
      const svc = UI.val('rr-service', 'rr-service-custom');
      const existing = Store.getReports()
        .filter(r => r.service === svc)
        .map(r => r.provider);
      const seeded = PROVIDERS[svc] || Object.values(PROVIDERS).flat();
      const all = [...new Set([...seeded, ...existing])].filter(Boolean).sort();
      const sel = document.getElementById('rr-provider');
      sel.innerHTML = `<option value="">— Select or type below —</option>` + all.map(p => `<option>${p}</option>`).join('');
    }

    function autoCalcTotal() {
      const l = parseFloat(document.getElementById('rr-labour').value) || 0;
      const m = parseFloat(document.getElementById('rr-material').value) || 0;
      const v = parseFloat(document.getElementById('rr-visit').value) || 0;
      document.getElementById('rr-total').value = (l + m + v) || '';
    }

    function submitReport() {
      const fields = {
        service: document.getElementById('rr-service'),
        job: document.getElementById('rr-job'),
        providerSel: document.getElementById('rr-provider'),
        providerCustom: document.getElementById('rr-provider-custom'),
        total: document.getElementById('rr-total'),
        labour: document.getElementById('rr-labour'),
        material: document.getElementById('rr-material'),
        visit: document.getElementById('rr-visit'),
        days: document.getElementById('rr-days'),
        held: document.querySelector('[name="rr-held"]:checked'),
        again: document.getElementById('rr-again')
      };

      let valid = true;
      [fields.service, fields.job, fields.total, fields.labour, fields.material, fields.visit].forEach(f => {
        if (f) UI.clearError(f);
      });

      const svcVal = UI.val('rr-service', 'rr-service-custom');
      const jobVal = UI.val('rr-job', 'rr-job-custom');
      if (!svcVal) { UI.showError(fields.service, 'Select or type a service'); valid = false; }
      if (!jobVal) { UI.showError(fields.job, 'Select or type a job type'); valid = false; }

      const provider = UI.val('rr-provider', 'rr-provider-custom');
      if (!provider) { UI.showError(fields.providerSel, 'Provider name required'); valid = false; }

      const labour = parseFloat(fields.labour.value) || 0;
      const material = parseFloat(fields.material.value) || 0;
      const visit = parseFloat(fields.visit.value) || 0;
      const total = parseFloat(fields.total.value) || 0;

      if (total <= 0) { UI.showError(fields.total, 'Enter total paid'); valid = false; }
      if (Math.abs((labour + material + visit) - total) > 1) {
        UI.showError(fields.total, `Labour (${UI.fmtRs(labour)}) + Material (${UI.fmtRs(material)}) + Visit (${UI.fmtRs(visit)}) = ${UI.fmtRs(labour+material+visit)}, must equal Total (${UI.fmtRs(total)})`);
        valid = false;
      }
      if (!valid) return;

      const heldMap = { yes: true, no: false, early: null };
      const heldVal = fields.held ? heldMap[fields.held.value] : null;

      const receiptInput = document.getElementById('rr-receipt');
      const hasReceipt = receiptInput && receiptInput.files && receiptInput.files.length > 0;

      const report = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        service: svcVal,
        job: jobVal,
        provider,
        total,
        labour,
        material,
        visit,
        daysTaken: parseInt(fields.days.value) || 1,
        heldAfter30: heldVal,
        wouldCallAgain: fields.again ? fields.again.checked : false,
        verified: hasReceipt,
        date: new Date().toISOString(),
        author: 'You',
        sample: false
      };

      Store.addReport(report);
      UI.toast('Report submitted! Rate card updated.', 'success');

      // Reset form
      ['rr-service', 'rr-service-custom', 'rr-job', 'rr-job-custom', 'rr-total', 'rr-labour', 'rr-material', 'rr-visit', 'rr-days'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('rr-provider').innerHTML = '<option value="">— Select or type below —</option>';
      document.getElementById('rr-provider-custom').value = '';
      document.getElementById('rr-receipt-preview').innerHTML = '';
      document.getElementById('rr-receipt-preview').style.display = 'none';
      const againEl = document.getElementById('rr-again');
      if (againEl) againEl.checked = false;
      const heldEls = document.querySelectorAll('[name="rr-held"]');
      heldEls.forEach(el => el.checked = false);

      PriceCheck.refresh();
    }

    return { init };
  })();

  /* ── 5D. Yearly Ledger ── */
  const Ledger = (() => {
    let monthlyChart = null, serviceChart = null;

    function init() {
      document.getElementById('ledger-load-sample').addEventListener('click', loadSampleYear);
      document.getElementById('ledger-print').addEventListener('click', () => window.print());
      render();
    }

    function getMyReports() {
      return Store.getReports().filter(r => r.author === 'You');
    }

    function getSampleReports() {
      // Project seeded sample reports across all 12 months of the current year
      const thisYear = new Date().getFullYear();
      const seeded = Store.getReports().filter(r => r.sample === true);
      // Pick a realistic subset (~18 jobs across the 12 months) so numbers look like a real household year
      const subset = seeded.filter((_, idx) => idx % 3 === 0);
      return subset.map((r, idx) => {
        const month = idx % 12;
        const day = 5 + (idx * 3) % 20;
        return {
          ...r,
          date: new Date(thisYear, month, day).toISOString()
        };
      });
    }

    function loadSampleYear() {
      _render(getSampleReports(), true);
      UI.toast('Sample year loaded!', 'success');
    }

    function render() { _render(getMyReports(), false); }

    function _render(reports, isSample) {
      const now = new Date();
      const thisYear = now.getFullYear();
      const yearReports = reports.filter(r => new Date(r.date).getFullYear() === thisYear);

      const totalSpend = yearReports.reduce((s, r) => s + r.total, 0);
      document.getElementById('ledger-total').textContent = UI.fmtRs(totalSpend);

      // Savings vs median
      let totalMedian = 0;
      yearReports.forEach(r => {
        const all = Store.getReports().filter(rep => rep.service === r.service && rep.job === r.job);
        const stats = Stats.jobStats(all);
        if (stats.hasEnough) totalMedian += stats.median;
      });
      const savings = totalMedian - totalSpend;
      const savingsEl = document.getElementById('ledger-savings');
      savingsEl.textContent = (savings >= 0 ? '+' : '') + UI.fmtRs(Math.abs(Math.round(savings)));
      savingsEl.className = 'amount ' + (savings >= 0 ? 'positive' : 'negative');
      document.getElementById('ledger-savings-label').textContent = savings >= 0 ? 'Saved vs median' : 'Overpaid vs median';

      document.getElementById('ledger-jobs').textContent = yearReports.length;

      // Monthly spend
      const monthly = Array(12).fill(0);
      yearReports.forEach(r => { monthly[new Date(r.date).getMonth()] += r.total; });
      renderMonthlyChart(monthly);

      // By service
      const byService = {};
      SERVICES.forEach(s => { byService[s] = 0; });
      yearReports.forEach(r => { byService[r.service] = (byService[r.service] || 0) + r.total; });
      renderServiceChart(byService);

      // By provider
      const byProvider = {};
      yearReports.forEach(r => {
        byProvider[r.provider] = (byProvider[r.provider] || 0) + r.total;
      });
      const providerRows = Object.entries(byProvider).sort((a, b) => b[1] - a[1]).map(([name, amt]) =>
        `<div class="profile-job-row"><span>${name}</span><span class="font-mono font-bold">${UI.fmtRs(amt)}</span></div>`
      ).join('');
      document.getElementById('ledger-providers').innerHTML = providerRows || '<p class="text-muted">No data</p>';

      // Repeat repair flags
      const countByService = {};
      yearReports.forEach(r => { countByService[r.service] = (countByService[r.service] || 0) + 1; });
      const flags = Object.entries(countByService)
        .filter(([, c]) => c >= 3)
        .map(([s, c]) => `<div class="repeat-flag">⚠ ${c} ${s} fixes this year — consider a maintenance contract</div>`)
        .join('');
      document.getElementById('ledger-flags').innerHTML = flags || '<p class="text-muted">No repeat repairs this year.</p>';

      // Biggest category
      const topService = Object.entries(byService).sort((a, b) => b[1] - a[1])[0];
      document.getElementById('ledger-insight').innerHTML = topService && topService[1] > 0
        ? `💡 Biggest spend: <strong>${topService[0]}</strong> (${UI.fmtRs(topService[1])}). ${topService[1] > 3000 ? 'Consider an annual maintenance plan to reduce costs.' : 'Reasonable for the year.'}`
        : '<p class="text-muted">No spending data for insights.</p>';

      // Suggestions panel
      renderSuggestions(yearReports, byService, byProvider, countByService, savings);

      if (yearReports.length === 0 && !isSample) {
        document.getElementById('ledger-empty').style.display = 'block';
      } else {
        document.getElementById('ledger-empty').style.display = 'none';
      }
    }

    function renderSuggestions(yearReports, byService, byProvider, countByService, savings) {
      const el = document.getElementById('ledger-suggestions');
      if (!el) return;
      if (yearReports.length === 0) {
        el.innerHTML = '<p class="text-muted">Log repairs or click "Load sample year" to get personalised cost-saving suggestions.</p>';
        return;
      }

      const tips = [];

      // 1. Overpay / savings tip
      if (savings < 0) {
        tips.push(`💸 <strong>Price Check before booking:</strong> You paid ${UI.fmtRs(Math.abs(Math.round(savings)))} above neighbourhood medians this year. Always run a quick Price Check or post a Request with a fair offer first.`);
      } else if (savings > 0) {
        tips.push(`🎉 <strong>Great bargaining:</strong> You saved ${UI.fmtRs(Math.round(savings))} compared to neighbourhood medians. Keep posting requests with fair-zone offers!`);
      }

      // 2. Repeat service / AMC suggestion
      const repeatSvcs = Object.entries(countByService).filter(([, c]) => c >= 3);
      if (repeatSvcs.length > 0) {
        repeatSvcs.forEach(([svc, c]) => {
          tips.push(`🔧 <strong>Bundle ${svc} visits:</strong> You had ${c} separate ${svc} jobs. Bundling small fixes into a single visit saves ~₹50–₹100 per trip on visit charges.`);
        });
      }

      // 3. Top-rated provider recommendation from circle
      const allReports = Store.getReports();
      const topProv = Object.keys(byProvider)
        .map(name => ({ name, ...Stats.providerStats(allReports, name) }))
        .filter(p => p.n >= 2 && p.againPct !== null)
        .sort((a, b) => b.againPct - a.againPct)[0];
      if (topProv) {
        tips.push(`⭐ <strong>Trusted local pick:</strong> <strong>${topProv.name}</strong> has a ${topProv.againPct}% "would call again" rating across ${topProv.n} neighbour reports.`);
      }

      // 4. AC preventive maintenance tip
      if ((byService['AC Repair'] || 0) > 1500) {
        tips.push(`❄️ <strong>Seasonal AC tip:</strong> Schedule an AC General Service (~₹600) before peak summer to avoid costly Gas Refill or PCB repairs.`);
      }

      el.innerHTML = tips.map(t => `<div style="padding:10px 12px;background:var(--accent-bg);border-radius:var(--radius-sm);color:var(--text)">${t}</div>`).join('');
    }

    function renderMonthlyChart(monthly) {
      const ctx = document.getElementById('ledger-monthly-chart');
      if (!ctx || typeof Chart === 'undefined') return;
      if (monthlyChart) monthlyChart.destroy();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: 'Spend (₹)',
            data: monthly,
            backgroundColor: 'rgba(45, 90, 67, 0.78)',
            borderColor: '#2d5a43',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { callback: v => '₹' + UI.fmt(v), color: isDark ? '#b5aea4' : '#57534e' }, grid: { color: isDark ? '#2f2b25' : '#e6e1d8' } },
            x: { ticks: { color: isDark ? '#b5aea4' : '#57534e' }, grid: { display: false } }
          }
        }
      });
    }

    function renderServiceChart(byService) {
      const ctx = document.getElementById('ledger-service-chart');
      if (!ctx || typeof Chart === 'undefined') return;
      if (serviceChart) { serviceChart.destroy(); serviceChart = null; }
      const wrap = ctx.parentElement;
      let emptyMsg = wrap.querySelector('.chart-empty-msg');
      const labels = Object.keys(byService).filter(k => byService[k] > 0);
      const data = labels.map(k => byService[k]);
      if (data.length === 0) {
        ctx.style.display = 'none';
        if (!emptyMsg) {
          emptyMsg = document.createElement('p');
          emptyMsg.className = 'text-muted text-center chart-empty-msg';
          emptyMsg.style.padding = '20px';
          emptyMsg.textContent = 'No spend data yet.';
          wrap.appendChild(emptyMsg);
        }
        return;
      }
      if (emptyMsg) emptyMsg.remove();
      ctx.style.display = '';
      const colors = ['#2d5a43', '#5e8b71', '#b47b44', '#8c9a84'];
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      serviceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderColor: isDark ? '#1c1a17' : '#ffffff',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: isDark ? '#f2efe9' : '#1c1917', padding: 12, font: { family: 'Inter' } } },
            tooltip: { callbacks: { label: ctx => ` ${UI.fmtRs(ctx.raw)}` } }
          }
        }
      });
    }

    return { init, render, loadSampleYear };
  })();

  function init() {
    PriceCheck.init();
    RequestBargain.init();
    Report.init();
    Ledger.init();
  }

  function refresh() {
    PriceCheck.refresh();
    RequestBargain.refresh();
    Ledger.render();
  }

  return { init, refresh, PriceCheck, RequestBargain, Report, Ledger };
})();

/* ============================================================
   SECTION 6 – PROVIDER
   ============================================================ */
const Provider = (() => {

  /* ── 6A. Job Board ── */
  const JobBoard = (() => {
    function init() {
      const filterSvc = document.getElementById('pb-filter-service');
      const filterFair = document.getElementById('pb-filter-fair');
      UI.populateSelect(filterSvc, SERVICES, 'All Services');
      UI.bindCustom('pb-filter-service', 'pb-filter-service-custom', renderBoard);
      filterFair.addEventListener('change', renderBoard);
      renderBoard();
    }

    function renderBoard() {
      const container = document.getElementById('pb-job-list');
      const histContainer = document.getElementById('pb-history');
      const filterSvc = UI.val('pb-filter-service', 'pb-filter-service-custom');
      const filterFair = document.getElementById('pb-filter-fair').value;

      let requests = Store.getRequests().filter(r => r.status === 'open' || r.status === 'countered');
      if (filterSvc) requests = requests.filter(r => r.service.toLowerCase().includes(filterSvc.toLowerCase()));

      const open = requests.filter(r => r.status === 'open');
      const myProvider = UI.val('pb-provider-select', 'pb-provider-custom');

      // Filter by fair if needed
      let filtered = open;
      if (filterFair === 'above') {
        filtered = open.filter(r => {
          const stats = getStats(r);
          return stats.hasEnough && r.offer >= stats.median;
        });
      } else if (filterFair === 'below') {
        filtered = open.filter(r => {
          const stats = getStats(r);
          return stats.hasEnough && r.offer < stats.median;
        });
      }

      if (filtered.length === 0) {
        container.innerHTML = UI.emptyState('No open requests', 'All jobs have been handled or no requests match your filter.');
      } else {
        container.innerHTML = [...filtered].reverse().map(r => renderJobCard(r, myProvider)).join('');
        container.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleAction));
      }

      // History: closed requests
      const closed = Store.getRequests().filter(r => r.status === 'accepted' || r.status === 'declined');
      histContainer.innerHTML = closed.length === 0
        ? '<p class="text-muted">No completed jobs yet.</p>'
        : closed.map(r => `<div class="history-item">
            ${UI.statusBadge(r.status)}
            <span>${r.job} · ${r.service}</span>
            <span class="font-mono">${UI.fmtRs(r.offer)}</span>
            <span class="text-muted">${UI.relDate(r.createdAt)}</span>
          </div>`).join('');
    }

    function getStats(r) {
      const reports = Store.getReports().filter(rep => rep.service === r.service && rep.job === r.job);
      return Stats.jobStats(reports);
    }

    function renderJobCard(r, myProvider) {
      const stats = getStats(r);
      let medHTML = '', fairBadge = '';
      if (stats.hasEnough) {
        medHTML = `<span class="text-muted" style="font-size:0.85rem">Neighbour median: <span class="font-mono font-bold">${UI.fmtRs(stats.median)}</span></span>`;
        fairBadge = r.offer >= stats.median
          ? `<span class="badge badge-success">At or above fair</span>`
          : `<span class="badge badge-warning">Below fair</span>`;
      }

      return `<div class="job-card animate-in" id="jc-${r.id}">
        <div class="job-card-header">
          <div style="flex:1">
            <div class="flex gap-8 flex-wrap mb-4">
              <span class="badge badge-accent">${r.service}</span>
              ${fairBadge}
            </div>
            <h4 style="margin-bottom:2px">${r.job}</h4>
            <p style="font-size:0.85rem;margin:0">${r.description}</p>
            <div class="text-muted" style="font-size:0.8rem;margin-top:4px">⏰ ${r.preferredTime} · ${UI.relDate(r.createdAt)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="card-title">Customer Offer</div>
            <div class="job-card-offer">${UI.fmtRs(r.offer)}</div>
            ${medHTML}
          </div>
        </div>
        ${stats.hasEnough ? `<div id="jc-bar-${r.id}"></div>` : ''}
        <div class="job-card-actions">
          <button class="btn btn-success btn-sm" data-action="accept" data-id="${r.id}" data-provider="${myProvider || ''}">Accept</button>
          <button class="btn btn-danger btn-sm" data-action="decline" data-id="${r.id}" data-provider="${myProvider || ''}">Decline</button>
          <button class="btn btn-secondary btn-sm" data-action="show-counter" data-id="${r.id}">Counter →</button>
        </div>
        <div class="job-card-counter-row hidden" id="counter-row-${r.id}">
          <div class="form-group">
            <label class="form-label" for="cp-${r.id}">Counter Price (₹)</label>
            <input id="cp-${r.id}" type="number" class="form-control" placeholder="${stats.hasEnough ? UI.fmt(stats.median) : '0'}" min="1">
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label" for="cn-${r.id}">Note (optional)</label>
            <input id="cn-${r.id}" type="text" class="form-control" placeholder="e.g. Includes parts">
          </div>
          <button class="btn btn-primary btn-sm" data-action="counter" data-id="${r.id}" data-provider="${myProvider || ''}">Send Counter</button>
        </div>
      </div>`;
    }

    function handleAction(e) {
      const { action, id, provider } = e.target.dataset;
      const req = Store.getRequests().find(r => r.id === id);
      if (!req) return;
      const provName = provider || UI.val('pb-provider-select', 'pb-provider-custom') || 'Provider';

      if (action === 'accept') {
        Store.updateRequest(id, {
          status: 'accepted',
          providerName: provName,
          history: [...(req.history||[]), { event: `accepted-by-${provName}`, at: new Date().toISOString() }]
        });
        UI.toast(`Job accepted by ${provName}!`, 'success');
        renderBoard();
      } else if (action === 'decline') {
        Store.updateRequest(id, {
          status: 'declined',
          providerName: provName,
          history: [...(req.history||[]), { event: `declined-by-${provName}`, at: new Date().toISOString() }]
        });
        UI.toast('Request declined.', '');
        renderBoard();
      } else if (action === 'show-counter') {
        document.getElementById(`counter-row-${id}`)?.classList.toggle('hidden');
      } else if (action === 'counter') {
        const price = parseFloat(document.getElementById(`cp-${id}`)?.value);
        const note = document.getElementById(`cn-${id}`)?.value.trim();
        if (!price || price <= 0) { UI.toast('Enter a valid counter price', 'error'); return; }
        Store.updateRequest(id, {
          status: 'countered',
          counterPrice: price,
          providerName: provName,
          note: note || null,
          history: [...(req.history||[]), { event: `countered-${price}-by-${provName}`, at: new Date().toISOString() }]
        });
        UI.toast(`Counter of ${UI.fmtRs(price)} sent!`, 'success');
        renderBoard();
      }
    }

    function refresh() { renderBoard(); }
    return { init, refresh };
  })();

  /* ── 6B. My Price Profile ── */
  const Profile = (() => {
    function init() {
      const sel = document.getElementById('pb-provider-select');
      // Collect all provider names from seeded data
      const allProviders = Object.values(PROVIDERS).flat();
      UI.populateSelect(sel, allProviders, '— Select your name —');
      UI.bindCustom('pb-provider-select', 'pb-provider-custom', () => {
        render();
        JobBoard.refresh();
      });
      render();
    }

    function render() {
      const name = UI.val('pb-provider-select', 'pb-provider-custom');
      const container = document.getElementById('profile-content');
      if (!name) {
        container.innerHTML = UI.emptyState('Select your provider name', 'Pick your name from the dropdown to see your profile.');
        return;
      }

      const reports = Store.getReports().filter(r => r.provider === name);
      if (reports.length === 0) {
        container.innerHTML = UI.emptyState('No reports yet', 'Your profile will populate as customers log their experiences.');
        return;
      }

      const ps = Stats.providerStats(reports, name);
      const byJob = {};
      reports.forEach(r => {
        const key = `${r.service} · ${r.job}`;
        if (!byJob[key]) byJob[key] = [];
        byJob[key].push(r.total);
      });

      const jobRows = Object.entries(byJob).map(([job, prices]) => {
        const avg = Math.round(Stats.mean(prices));
        return `<div class="profile-job-row">
          <span>${job}</span>
          <div class="flex gap-8 align-items-center" style="align-items:center">
            <span class="font-mono">${UI.fmtRs(avg)}</span>
            <span class="badge badge-neutral">${prices.length}</span>
          </div>
        </div>`;
      }).join('');

      container.innerHTML = `<div class="fade-in">
        <div class="stat-row mb-20">
          <div class="stat-chip">
            <span class="value">${ps.n}</span>
            <span class="label">Total Reports</span>
          </div>
          ${ps.againPct !== null ? `<div class="stat-chip">
            <span class="value">${ps.againPct}%</span>
            <span class="label">Would Call Again</span>
          </div>` : ''}
          ${ps.heldPct !== null ? `<div class="stat-chip">
            <span class="value">${ps.heldPct}%</span>
            <span class="label">Fix Held 30+ Days</span>
          </div>` : ''}
          <div class="stat-chip">
            <span class="value">${UI.fmtRs(ps.avgPrice)}</span>
            <span class="label">Avg Charge</span>
          </div>
        </div>
        <h4 class="mb-12">Average Price per Job</h4>
        <div>${jobRows}</div>
      </div>`;
    }

    return { init, render };
  })();

  function init() {
    JobBoard.init();
    Profile.init();
  }

  function refresh() {
    JobBoard.refresh();
  }

  return { init, refresh, JobBoard, Profile };
})();

/* ============================================================
   SECTION 7 – BOOT / APP SHELL
   ============================================================ */
const App = (() => {
  let currentRole = null; // 'customer' | 'provider' | null
  let currentScreen = null;

  const screens = {
    customer: ['price-check', 'bargain', 'report', 'ledger'],
    provider: ['job-board', 'profile']
  };

  function setRole(role) {
    currentRole = role;
    try { sessionStorage.setItem('fairfix_role', role); } catch (e) {}
    document.getElementById('page-landing').classList.remove('active');
    document.getElementById('page-app').classList.add('active');
    buildNav(role);
    navigate(role, screens[role][0]);
  }

  function buildNav(role) {
    const navLinks = document.getElementById('nav-links');
    const roleBadge = document.getElementById('nav-role-badge');

    const links = role === 'customer'
      ? [['price-check','Price Check'], ['bargain','Request & Bargain'], ['report','Report & Review'], ['ledger','Yearly Ledger']]
      : [['job-board','Job Board'], ['profile','My Price Profile']];

    navLinks.innerHTML = links.map(([screen, label]) =>
      `<li><a href="#" data-screen="${screen}" data-role="${role}">${label}</a></li>`
    ).join('') + `<li><a href="#" class="nav-switch" id="nav-switch">↩ Switch role</a></li>`;

    navLinks.querySelectorAll('a[data-screen]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(role, a.dataset.screen);
      });
    });
    document.getElementById('nav-switch').addEventListener('click', e => {
      e.preventDefault();
      switchRole();
    });

    roleBadge.textContent = role === 'customer' ? 'Customer' : 'Provider';
    roleBadge.style.display = '';
  }

  function navigate(role, screen) {
    currentScreen = screen;
    // Show correct panel
    document.querySelectorAll('.role-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`screen-${screen}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('#nav-links a[data-screen]').forEach(a => {
      a.classList.toggle('active', a.dataset.screen === screen);
    });
  }

  function switchRole() {
    currentRole = null;
    currentScreen = null;
    try { sessionStorage.removeItem('fairfix_role'); } catch (e) {}
    document.getElementById('page-app').classList.remove('active');
    document.getElementById('page-landing').classList.add('active');
    document.getElementById('nav-role-badge').style.display = 'none';
    document.getElementById('nav-links').innerHTML = '';
  }

  function initHamburger() {
    const btn = document.getElementById('nav-hamburger');
    const links = document.getElementById('nav-links');
    btn.addEventListener('click', () => links.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  function initSync() {
    Store.onSync(msg => {
      if (msg.type === 'REQUEST_ADDED' || msg.type === 'REQUEST_UPDATED' || msg.type === 'STORAGE') {
        if (currentRole === 'provider') Provider.refresh();
        if (currentRole === 'customer') Customer.refresh();
      }
      if (msg.type === 'REPORT_ADDED') {
        if (currentRole === 'customer') Customer.PriceCheck.refresh();
      }
    });
    Store.initSync();
  }

  function initDemoPanel() {
    const toggleBtn = document.getElementById('demo-toggle');
    const body = document.getElementById('demo-body');
    toggleBtn.addEventListener('click', () => body.classList.toggle('hidden'));

    document.getElementById('demo-reset').addEventListener('click', () => {
      if (confirm('Reset all demo data? This cannot be undone.')) {
        Store.clearAll();
        seedData();
        UI.toast('Demo data reset!', 'success');
        if (currentRole === 'customer') { Customer.refresh(); }
        if (currentRole === 'provider') { Provider.refresh(); }
      }
    });

    document.getElementById('demo-load-sample').addEventListener('click', () => {
      if (currentRole === 'customer') {
        if (currentScreen !== 'ledger') navigate('customer', 'ledger');
        Customer.Ledger.loadSampleYear();
      } else {
        UI.toast('Switch to Customer role to view the Yearly Ledger.', 'warning');
      }
    });

    document.getElementById('demo-simulate').addEventListener('click', simulateProviderReply);
  }

  function simulateProviderReply() {
    const openRequests = Store.getRequests().filter(r => r.status === 'open' && r.author !== 'You');
    // Also try customer's own open requests
    const myOpen = Store.getRequests().filter(r => r.status === 'open' && r.author === 'You');
    const target = myOpen[0] || openRequests[0];

    if (!target) {
      UI.toast('No open requests to simulate a reply for.', 'warning');
      return;
    }

    const reports = Store.getReports().filter(r => r.service === target.service && r.job === target.job);
    const stats = Stats.jobStats(reports);

    const providers = PROVIDERS[target.service] || ['Demo Provider'];
    const provName = providers[Math.floor(Math.random() * providers.length)];

    UI.toast('Provider is reviewing your request…', '');

    setTimeout(() => {
      const roll = Math.random();
      if (roll < 0.4 && stats.hasEnough) {
        // Accept
        Store.updateRequest(target.id, {
          status: 'accepted',
          providerName: provName,
          counterPrice: target.offer,
          history: [...(target.history||[]), { event: `accepted-by-${provName}`, at: new Date().toISOString() }]
        });
        UI.toast(`${provName} accepted your request!`, 'success');
      } else {
        // Counter near median
        const counterBase = stats.hasEnough ? stats.median : target.offer * 1.15;
        const jitter = (Math.random() - 0.3) * counterBase * 0.1;
        const counter = Math.round((counterBase + jitter) / 10) * 10;
        Store.updateRequest(target.id, {
          status: 'countered',
          counterPrice: counter,
          providerName: provName,
          note: stats.hasEnough ? `Neighbourhood median is ${UI.fmtRs(stats.median)}. I charge fair rates.` : 'Parts + labour included.',
          history: [...(target.history||[]), { event: `countered-${counter}-by-${provName}`, at: new Date().toISOString() }]
        });
        UI.toast(`${provName} countered at ${UI.fmtRs(counter)}!`, 'warning');
      }
      if (currentRole === 'customer') Customer.RequestBargain.renderMyRequests();
      if (currentRole === 'provider') Provider.JobBoard.refresh();
    }, 2000 + Math.random() * 1000);
  }

  function init() {
    seedData();
    Landing.init();
    Customer.init();
    Provider.init();
    initHamburger();
    initSync();
    initDemoPanel();

    // Restore session role if present (optional UX)
    // Not restoring role to always show landing for demo clarity
  }

  return { init, setRole, navigate, switchRole };
})();

// ── Entry point ──
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('FairFix init error:', err);
  }
});
