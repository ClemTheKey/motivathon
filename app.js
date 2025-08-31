/* app.js — Motivathon ONLINE ONLY (DB = vérité) */

window.Motivathon = window.Motivathon || {};
const M = window.Motivathon;

/* ========= Sélecteurs DOM ========= */
const els = {
  openBtn:    document.getElementById('openModal'),
  modal:      document.getElementById('taskModal'),
  closeModal: document.getElementById('closeModal'),
  form:       document.getElementById('taskForm'),
  title:      document.getElementById('taskTitle'),
  category:   document.getElementById('taskCategory'),
  period:     document.getElementById('taskPeriod'),
  xp:         document.getElementById('taskXP'),
  list:       document.getElementById('taskList')
};

/* ========= État UI ========= */
M.tasks = [];
M.editingId = null;

/* ========= Utilitaires UI ========= */
function openModal()  { if (els.modal) els.modal.style.display = 'block'; }
function closeModal() { if (els.modal) els.modal.style.display = 'none'; M.editingId = null; }
function resetForm()  { if (els.form) els.form.reset(); M.editingId = null; }

/* ========= Sync depuis Data ========= */
M.syncFromData = function () {
  try {
    M.tasks = (typeof Data?.listTasks === 'function') ? Data.listTasks().slice() : [];
  } catch (e) {
    console.warn('[syncFromData]', e);
    M.tasks = [];
  }
};

M.refreshFromDb = async function () {
  try {
    await Data.init();
    await Data.refresh();  // DB → Data
    M.syncFromData();      // Data → état local
    M.renderTasks();
  } catch (e) {
    console.warn('[refreshFromDb]', e);
  }
};

/* ========= Rendu ========= */
M.renderTasks = function () {
  if (!els.list) return;
  els.list.innerHTML = '';

  const tasks = Array.isArray(M.tasks) ? M.tasks : [];
  if (!tasks.length) {
    els.list.innerHTML = '<p style="opacity:.6">Aucune tâche</p>';
    return;
  }

  for (const t of tasks) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.id = t.id;

    // checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!t.done;
    cb.addEventListener('change', () => {
      try { Data.setTaskDone(t.id, cb.checked); } catch (e) { console.warn(e); }
    });

    // titre
    const span = document.createElement('span');
    span.className = 'task-title';
    span.textContent = t.title || '(sans titre)';

    // meta
    const meta = document.createElement('span');
    meta.className = 'task-meta';
    meta.textContent = `${t.category||'—'} · ${t.period||'—'} · ${t.xp||0} XP`;

    // bouton éditer
    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.className = 'btn-edit';
    btnEdit.addEventListener('click', () => M.openEditTask(t.id));

    row.append(cb, span, meta, btnEdit);
    els.list.appendChild(row);
  }
};

/* ========= Création / Édition ========= */
M.openNewTask = function () {
  M.editingId = null;
  resetForm();
  openModal();
};

M.openEditTask = function (id) {
  const t = M.tasks.find(x => x.id === id);
  if (!t) return;
  M.editingId = t.id;
  if (els.title)    els.title.value = t.title || '';
  if (els.category) els.category.value = t.category || '';
  if (els.period)   els.period.value = t.period || '';
  if (els.xp)       els.xp.value = t.xp || 0;
  openModal();
};

M.handleFormSubmit = function (ev) {
  ev.preventDefault();
  const title    = (els.title?.value || '').trim();
  const category = els.category?.value || null;
  const period   = els.period?.value || null;
  const xp       = parseInt(els.xp?.value ?? '0', 10);
  if (!title) return;

  (async () => {
    try {
      await Data.init();

      if (M.editingId) {
        await Data.upsertTask({ id: M.editingId, title, category, period, xp });
      } else {
        await Data.upsertTask({ title, category, period, xp, done: false });
      }

      await M.refreshFromDb();
      resetForm();
      closeModal();
    } catch (e) {
      console.warn('[handleFormSubmit]', e);
    }
  })();
};

/* ========= Bind UI ========= */
function bindUI() {
  els.openBtn?.addEventListener('click', M.openNewTask);
  els.closeModal?.addEventListener('click', () => { resetForm(); closeModal(); });
  els.form?.addEventListener('submit', M.handleFormSubmit);

  // clic hors contenu pour fermer la modale
  if (els.modal) {
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) { resetForm(); closeModal(); }
    });
  }
}

/* ========= Bootstrap ========= */
(function start() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindUI();
      try { M.syncFromData(); M.renderTasks(); } catch {}
    }, { once: true });
  } else {
    bindUI();
    try { M.syncFromData(); M.renderTasks(); } catch {}
  }
})();
