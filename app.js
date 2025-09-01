/* app.js — Motivathon ONLINE-ONLY (DB=vérité) — complet
   - Groupements (catégorie / périodicité) + sections repliables
   - Réapparition automatique selon period
   - Succès (one-shot : period="succès" => pas de réapparition)
   - XP & niveaux (barre + calcul) — stockés localement (UI only)
   - Historique local (plug DB possible plus tard)
   - Création / édition via modale, toggle done relié à la DB
*/

"use strict";

window.Motivathon = window.Motivathon || {};
const M = window.Motivathon;

/* ===================== DOM HOOKS (adapte si besoin) ===================== */
const DOM = {
  openBtn:      document.getElementById('openModal'),
  modal:        document.getElementById('taskModal'),
  closeModal:   document.getElementById('closeModal'),
  form:         document.getElementById('taskForm'),
  title:        document.getElementById('taskTitle'),
  category:     document.getElementById('taskCategory'),
  period:       document.getElementById('taskPeriod'),
  xp:           document.getElementById('taskXP'),
  list:         document.getElementById('taskList'),
  empty:        document.getElementById('emptyTasks'),
  // Profil / XP (optionnels)
  xpBar:        document.getElementById('xpBar'),
  xpText:       document.getElementById('xpText'),
  levelText:    document.getElementById('levelText'),
  badgeRack:    document.getElementById('badgeRack'),
  // GroupBy (optionnel) : <select id="groupBy" value="category|period|none">
  groupBySel:   document.getElementById('groupBy'),
};

/* ===================== ÉTAT ===================== */
M.tasks = [];
M.history = []; // local (plug DB possible plus tard)
M.editingId = null;

// Préférences UI
M.groupBy = localStorage.getItem('motivathon_groupby') || 'category'; // 'category' | 'period' | 'none'
M.collapsedCategory = JSON.parse(localStorage.getItem('motivathon_collapsed_category') || '{}');
M.collapsedPeriod   = JSON.parse(localStorage.getItem('motivathon_collapsed_period') || '{}');

// Profil local (XP / level)
M.player = {
  xp: parseInt(localStorage.getItem('motivathon_xp') || '0', 10) || 0,
  level: parseInt(localStorage.getItem('motivathon_level') || '1', 10) || 1,
};

/* ===================== XP & niveaux ===================== */
function savePlayer() {
  try {
    localStorage.setItem('motivathon_xp', String(M.player.xp || 0));
    localStorage.setItem('motivathon_level', String(M.player.level || 1));
  } catch {}
}
function xpThreshold(level) { return 100 + (level - 1) * 50; } // palier pour passer au prochain niveau
function computeLevelFromXp(xp) {
  let lvl = 1, rest = xp;
  while (true) {
    const need = xpThreshold(lvl);
    if (rest >= need) { rest -= need; lvl += 1; }
    else break;
  }
  return Math.max(1, lvl);
}
M.gainXP = function (delta) {
  if (typeof delta !== 'number' || !isFinite(delta)) return;
  this.player.xp = Math.max(0, (this.player.xp || 0) + delta);
  this.player.level = computeLevelFromXp(this.player.xp);
  savePlayer();
  renderProfile();
};
function renderProfile() {
  if (!DOM.xpBar && !DOM.xpText && !DOM.levelText) return;
  const lvl = M.player.level || 1;
  // XP requis jusqu’au niveau courant (somme des paliers précédents)
  let totalBefore = 0;
  for (let i = 1; i < lvl; i++) totalBefore += xpThreshold(i);
  const need = xpThreshold(lvl);
  const inLevel = Math.max(0, (M.player.xp || 0) - totalBefore);
  const pct = Math.max(0, Math.min(100, Math.round((inLevel / need) * 100)));

  if (DOM.xpBar)  DOM.xpBar.style.width = pct + '%';
  if (DOM.xpText) DOM.xpText.textContent = `${inLevel} / ${need} XP`;
  if (DOM.levelText) DOM.levelText.textContent = `Niveau ${lvl}`;

  if (DOM.badgeRack) {
    DOM.badgeRack.innerHTML = '';
    const milestones = [1,3,5,10,15,20];
    milestones.forEach(m => {
      const b = document.createElement('span');
      b.className = 'badge ' + (lvl >= m ? 'badge-achieved' : 'badge-muted');
      b.textContent = `Lv${m}`;
      DOM.badgeRack.appendChild(b);
    });
  }
}

/* ===================== MAPPINGS & HELPERS ===================== */
const REAPPEAR_DAYS = {
  'quotidienne': 1,
  'hebdomadaire': 7,
  'mensuelle': 30,
  '3 jours': 3,
  '2 semaines': 14
  // "succès" => pas de réapparition
};
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function reappearDays(p){ const d = REAPPEAR_DAYS[norm(p)]; return d ? d : null; }

function el(tag, cls){ const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function badge(cls, txt){ const b = el('span', 'badge ' + cls); b.textContent = txt; return b; }

function catClass(cat){
  switch(norm(cat)){
    case 'alimentation':   return 'badge-cat badge-cat-alimentation';
    case 'sport':          return 'badge-cat badge-cat-sport';
    case 'good habits':    return 'badge-cat badge-cat-good-habits';
    case 'healthy life':   return 'badge-cat badge-cat-healthy-life';
    case 'divers':         return 'badge-cat badge-cat-divers';
    default:               return 'badge';
  }
}
function perClass(per){
  switch(norm(per)){
    case 'quotidienne':    return 'badge badge-per-quotidienne';
    case 'hebdomadaire':   return 'badge badge-per-hebdomadaire';
    case 'mensuelle':      return 'badge badge-per-mensuelle';
    case '3 jours':        return 'badge badge-per-3-jours';
    case '2 semaines':     return 'badge badge-per-2-semaines';
    case 'succès':         return 'badge badge-per-succes';
    default:               return 'badge';
  }
}

/* ===================== SYNC DB → ÉTAT ===================== */
M.syncFromData = function(){
  try {
    const list = (typeof Data?.listTasks === 'function') ? Data.listTasks() : [];
    M.tasks = Array.isArray(list) ? list.slice() : [];
  } catch { M.tasks = []; }
};

M.refreshFromDb = async function(){
  try {
    await Data.init?.();
    await Data.refresh?.(); // DB → Data
    M.syncFromData();

    // Réapparition auto (si délai écoulé)
    await M.expireTasksIfNeeded();

    M.renderEverything();
  } catch(e){ console.warn('[refreshFromDb]', e); }
};

/* ===================== RÉAPPARITION =====================
   Si t.done et délai écoulé selon period => remettre done=false en DB.
   On se base sur updated_at (mis à jour lors du toggle côté Data.setTaskDone/Upsert).
========================================================= */
M.expireTasksIfNeeded = async function(){
  const now = Date.now();
  const toReopen = [];

  for (const t of M.tasks) {
    if (!t || !t.done) continue;
    const days = reappearDays(t.period);
    if (!days) continue; // succès/one-shot

    const ref = t.updated_at ? Date.parse(t.updated_at) : NaN;
    if (!ref || isNaN(ref)) continue;
    if (now - ref >= days * 86400000) toReopen.push(t.id);
  }

  if (!toReopen.length) return;

  for (const id of toReopen) {
    try { await Data.upsertTask({ id, done: false }); }
    catch(e){ console.warn('[reappear] fail', id, e); }
  }
  await Data.refresh?.();
  M.syncFromData();
};

/* ===================== RENDU ===================== */
M.renderEverything = function(){
  renderProfile();
  M.renderTasks();
  // Si tu as un panneau d'historique, tu peux l’afficher ici via M.renderHistory()
};

M.renderTasks = function(){
  const c = DOM.list;
  if (!c) return;
  c.innerHTML = '';

  const tasks = Array.isArray(M.tasks) ? M.tasks.slice() : [];

  // tri : non faites d’abord, puis par date (created_at)
  tasks.sort((a,b)=>{
    const da = a.done?1:0, db = b.done?1:0;
    if (da !== db) return da - db;
    const ta = a.created_at ? Date.parse(a.created_at)||0 : 0;
    const tb = b.created_at ? Date.parse(b.created_at)||0 : 0;
    return ta - tb;
  });

  if (!tasks.length) {
    if (DOM.empty) DOM.empty.style.display = '';
    c.innerHTML = '<p style="opacity:.6;margin:8px 0">Aucune tâche</p>';
    return;
  }
  if (DOM.empty) DOM.empty.style.display = 'none';

  const mode = (M.groupBy || 'category');
  if (mode === 'none') {
    tasks.forEach(t => c.appendChild(renderTaskRow(t)));
    return;
  }

  // groupement
  const groups = new Map();
  for (const t of tasks) {
    const key = (mode === 'category') ? (t.category || 'Sans catégorie') : (t.period || 'Sans périodicité');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  groups.forEach((items, label) => {
    const section = el('div', 'group');

    const header = el('div', 'group-header');
    const title = el('span', 'group-title'); title.textContent = label;
    const toggle = el('button', 'group-toggle'); toggle.textContent = '–';
    header.appendChild(title); header.appendChild(toggle);

    const body = el('div', 'group-body');

    // état replié mémorisé
    let collapsed = false;
    if (mode === 'category') collapsed = !!M.collapsedCategory[label];
    else collapsed = !!M.collapsedPeriod[label];
    if (collapsed) { body.style.display='none'; toggle.textContent = '+'; }

    // items
    items.forEach(t => body.appendChild(renderTaskRow(t)));

    toggle.addEventListener('click', ()=>{
      const open = (body.style.display === 'none');
      body.style.display = open ? '' : 'none';
      toggle.textContent = open ? '–' : '+';
      if (mode === 'category') {
        M.collapsedCategory[label] = !open;
        localStorage.setItem('motivathon_collapsed_category', JSON.stringify(M.collapsedCategory));
      } else {
        M.collapsedPeriod[label] = !open;
        localStorage.setItem('motivathon_collapsed_period', JSON.stringify(M.collapsedPeriod));
      }
    });

    section.appendChild(header);
    section.appendChild(body);
    c.appendChild(section);
  });
};

function renderTaskRow(t){
  const row = el('div', 'task');
  row.dataset.id = t.id;

  // Checkbox custom
  const wrap = el('label', 'check-wrap');
  const cb = el('input', 'task-check'); cb.type = 'checkbox'; cb.checked = !!t.done;
  const fake = el('span', 'custom-checkbox');
  wrap.appendChild(cb); wrap.appendChild(fake);

  wrap.addEventListener('change', async ()=>{
    try {
      await Data.init?.();
      const willBeDone = !!cb.checked;

      // Écrit en DB
      await Data.upsertTask({ id: t.id, done: willBeDone });

      // Gain XP uniquement quand on passe de non fait -> fait
      if (!t.done && willBeDone) M.gainXP(Number(t.xp || 0));

      await M.refreshFromDb();
    } catch(e) {
      console.warn('[toggle]', e);
    }
  });

  // Contenu
  const main = el('div');
  const titleRow = el('div', 'title-row');
  const title = el('span', 'task-title'); title.textContent = t.title || '(sans titre)';
  titleRow.appendChild(title);

  const metaRow = el('div', 'meta-row');
  if (t.category) metaRow.appendChild(badge(catClass(t.category), t.category));
  if (t.period)   metaRow.appendChild(badge(perClass(t.period), t.period));
  metaRow.appendChild(badge('badge badge-xp', (t.xp||0) + ' XP'));

  main.appendChild(titleRow);
  main.appendChild(metaRow);

  // Actions
  const actions = el('div', 'actions');
  const bEdit = el('button','icon-btn'); bEdit.textContent = '✏️';
  bEdit.addEventListener('click', ()=>M.openEditTask(t.id));
  actions.appendChild(bEdit);

  row.appendChild(wrap);
  row.appendChild(main);
  row.appendChild(actions);

  if (t.done) row.classList.add('vanish');
  return row;
}

/* ===================== FORMULAIRE ===================== */
M.openNewTask = function(){
  M.editingId = null;
  DOM.form?.reset();
  if (DOM.modal) DOM.modal.style.display = 'flex';
};
M.openEditTask = function(id){
  const t = M.tasks.find(x=>x.id===id); if (!t) return;
  M.editingId = id;
  if (DOM.title)    DOM.title.value    = t.title || '';
  if (DOM.category) DOM.category.value = t.category || '';
  if (DOM.period)   DOM.period.value   = t.period || '';
  if (DOM.xp)       DOM.xp.value       = (typeof t.xp === 'number') ? t.xp : 0;
  if (DOM.modal)    DOM.modal.style.display = 'flex';
};
M.handleFormSubmit = function(ev){
  ev.preventDefault();
  const title = (DOM.title?.value || '').trim();
  const category = DOM.category?.value || null;
  const period = DOM.period?.value || null;
  const xp = parseInt(DOM.xp?.value || '0', 10);
  if (!title) return;

  (async()=>{
    try{
      await Data.init?.();

      if (M.editingId) {
        await Data.upsertTask({ id: M.editingId, title, category, period, xp });
      } else {
        await Data.upsertTask({ title, category, period, xp, done:false });
      }

      await M.refreshFromDb();
      DOM.form?.reset();
      if (DOM.modal) DOM.modal.style.display = 'none';
      M.editingId = null;
    }catch(e){ console.warn('[submit]', e); }
  })();
};

/* ===================== GROUP BY CONTROL ===================== */
function bindGroupByControl(){
  if (!DOM.groupBySel) return;
  DOM.groupBySel.value = M.groupBy;
  DOM.groupBySel.addEventListener('change', ()=>{
    M.groupBy = DOM.groupBySel.value || 'category';
    localStorage.setItem('motivathon_groupby', M.groupBy);
    M.renderTasks();
  });
}

/* ===================== BIND UI ===================== */
function bindUI(){
  DOM.openBtn?.addEventListener('click', M.openNewTask);
  DOM.closeModal?.addEventListener('click', ()=>{ M.editingId=null; if (DOM.modal) DOM.modal.style.display='none'; });
  DOM.form?.addEventListener('submit', M.handleFormSubmit);
  DOM.modal?.addEventListener('click', (e)=>{ if (e.target===DOM.modal){ M.editingId=null; DOM.modal.style.display='none'; }});
  bindGroupByControl();

  // Échap pour fermer la modale
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && DOM.modal && DOM.modal.style.display === 'flex') {
      M.editingId = null; DOM.modal.style.display = 'none';
    }
  });
}

/* ===================== BOOTSTRAP ===================== */
(function start(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ bindUI(); renderProfile(); M.syncFromData(); M.renderTasks(); }, { once:true });
  } else {
    bindUI(); renderProfile(); M.syncFromData(); M.renderTasks();
  }
})();
