/* app.js — Motivathon ONLINE-ONLY (branché Data + UI riche) */

window.Motivathon = window.Motivathon || {};
const M = window.Motivathon;

M.tasks = [];
M.editingId = null;

/* ========= Utilitaires ========= */
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function badge(cls, txt) {
  const b = el("span", "badge " + cls);
  b.textContent = txt;
  return b;
}

function categoryClass(cat) {
  switch ((cat||"").toLowerCase()) {
    case "alimentation": return "badge-cat badge-cat-alimentation";
    case "sport": return "badge-cat badge-cat-sport";
    case "good habits": return "badge-cat badge-cat-good-habits";
    case "healthy life": return "badge-cat badge-cat-healthy-life";
    case "divers": return "badge-cat badge-cat-divers";
    default: return "badge";
  }
}
function periodClass(per) {
  switch ((per||"").toLowerCase()) {
    case "quotidienne": return "badge badge-per-quotidienne";
    case "hebdomadaire": return "badge badge-per-hebdomadaire";
    case "mensuelle": return "badge badge-per-mensuelle";
    case "3 jours": return "badge badge-per-3-jours";
    case "2 semaines": return "badge badge-per-2-semaines";
    case "succès": return "badge badge-per-succes";
    default: return "badge";
  }
}

/* ========= Sync DB → UI ========= */
M.syncFromData = function() {
  try {
    M.tasks = (typeof Data?.listTasks === "function") ? Data.listTasks().slice() : [];
  } catch { M.tasks = []; }
};

M.refreshFromDb = async function() {
  try {
    await Data.init?.();
    await Data.refresh?.();
    M.syncFromData();
    M.renderTasks();
  } catch (e) { console.warn("[refreshFromDb]", e); }
};

/* ========= Rendu ========= */
M.renderTasks = function() {
  const list = document.getElementById("taskList");
  if (!list) return;
  list.innerHTML = "";

  if (!M.tasks.length) {
    list.innerHTML = `<p style="opacity:.6;margin:8px 0">Aucune tâche</p>`;
    return;
  }

  for (const t of M.tasks) {
    const row = el("div", "task");
    row.dataset.id = t.id;

    // Checkbox custom
    const wrap = el("label", "check-wrap");
    const cb = el("input", "task-check");
    cb.type = "checkbox"; cb.checked = !!t.done;
    const fake = el("span", "custom-checkbox");
    wrap.appendChild(cb); wrap.appendChild(fake);
    wrap.addEventListener("change", ()=>Data.setTaskDone(t.id, cb.checked));

    // Contenu principal
    const main = el("div");
    const titleRow = el("div", "title-row");
    const title = el("span", "task-title");
    title.textContent = t.title || "(sans titre)";
    titleRow.appendChild(title);

    const metaRow = el("div", "meta-row");
    if (t.category) metaRow.appendChild(badge(categoryClass(t.category), t.category));
    if (t.period)   metaRow.appendChild(badge(periodClass(t.period), t.period));
    metaRow.appendChild(badge("badge badge-xp", (t.xp||0)+" XP"));

    main.appendChild(titleRow);
    main.appendChild(metaRow);

    // Actions
    const actions = el("div", "actions");
    const editBtn = el("button", "icon-btn");
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", ()=>M.openEditTask(t.id));
    actions.appendChild(editBtn);

    row.appendChild(wrap);
    row.appendChild(main);
    row.appendChild(actions);

    if (t.done) row.classList.add("vanish");

    list.appendChild(row);
  }
};

/* ========= Formulaire ========= */
M.openNewTask = function() {
  M.editingId = null;
  document.getElementById("taskForm")?.reset();
  document.getElementById("taskModal").style.display = "flex";
};
M.openEditTask = function(id) {
  const t = M.tasks.find(x=>x.id===id); if (!t) return;
  M.editingId = id;
  document.getElementById("taskTitle").value = t.title||"";
  document.getElementById("taskCategory").value = t.category||"";
  document.getElementById("taskPeriod").value = t.period||"";
  document.getElementById("taskXP").value = t.xp||0;
  document.getElementById("taskModal").style.display = "flex";
};

M.handleFormSubmit = function(ev) {
  ev.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const category = document.getElementById("taskCategory").value||null;
  const period = document.getElementById("taskPeriod").value||null;
  const xp = parseInt(document.getElementById("taskXP").value||"0",10);
  if (!title) return;
  (async()=>{
    try{
      await Data.init();
      if (M.editingId) {
        await Data.upsertTask({id:M.editingId,title,category,period,xp});
      } else {
        await Data.upsertTask({title,category,period,xp,done:false});
      }
      await M.refreshFromDb();
      document.getElementById("taskForm").reset();
      document.getElementById("taskModal").style.display="none";
      M.editingId=null;
    }catch(e){console.warn("[submit]",e);}
  })();
};

/* ========= Bind ========= */
function bindUI(){
  document.getElementById("openModal")?.addEventListener("click", M.openNewTask);
  document.getElementById("closeModal")?.addEventListener("click", ()=>{M.editingId=null;document.getElementById("taskModal").style.display="none"});
  document.getElementById("taskForm")?.addEventListener("submit", M.handleFormSubmit);
}
if (document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded", ()=>{bindUI(); M.syncFromData(); M.renderTasks();});
}else{bindUI(); M.syncFromData(); M.renderTasks();}
