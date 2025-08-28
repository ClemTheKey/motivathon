const Motivathon = {
  tasks: [],
  history: [],
  groupBy: "category",
  sortBy: "none",
  editingId: null,
  runId: 0,
  collapsedCategory: {},
  collapsedPeriod: {},

  init() {
    // Elements
    this.resetXPBtn = document.getElementById("resetXP");
    this.clearHistoryBtn = document.getElementById("clearHistory");
    this.clearTasksBtn = document.getElementById("clearTasks");

    this.importCsvInput = document.getElementById("importCsv");
    this.importCsvBtn = document.getElementById("importCsvBtn");
    this.importSummary = document.getElementById("importSummary");
    this.importErrors = document.getElementById("importErrors");
    this.importErrorsList = document.getElementById("importErrorsList");

    // Backup/Restore
    this.backupExportBtn = document.getElementById("backupExport");
    this.backupImportBtn = document.getElementById("backupImport");
    this.backupFileInput = document.getElementById("backupFile");
    this.backupSummary = document.getElementById("backupSummary");

    this.tabButtons = document.querySelectorAll(".tab");
    this.tabPanels = {
      tasks: document.getElementById("tab-tasks"),
      history: document.getElementById("tab-history"),
      admin: document.getElementById("tab-admin"),
    };

    this.taskListElement = document.getElementById("taskList");
    this.totalCounterEl = document.getElementById("totalCounter");
    this.modal = document.getElementById("taskModal");
    this.openModalBtn = document.getElementById("openModal");
    this.historyBtn = document.getElementById("btnHistory");
    this.adminBtn = document.getElementById("btnAdmin");
    this.historyModal = document.getElementById("historyModal");
    this.adminModal = document.getElementById("adminModal");
    this.closeHistoryBtn = document.getElementById("closeHistoryModal");
    this.closeAdminBtn = document.getElementById("closeAdminModal");
    this.closeModalBtn = document.getElementById("closeModal");
    this.form = document.getElementById("taskForm");
    this.groupBySelect = document.getElementById("groupBy");
    this.sortBySelect = document.getElementById("sortBy");
    this.modalTitle = document.getElementById("modalTitle");
    this.submitBtn = document.getElementById("submitBtn");
    this.collapseAllBtn = document.getElementById("collapseAll");
    this.expandAllBtn = document.getElementById("expandAll");

    this.historyListElement = document.getElementById("historyList");

    // Preferences
    try {
      const gb = localStorage.getItem("motivathon_groupby");
      if (gb === "category" || gb === "period" || gb === "none") this.groupBy = gb;
      if (this.groupBySelect) this.groupBySelect.value = this.groupBy;

      const sb = localStorage.getItem("motivathon_sortby");
      if (sb === "none" || sb === "xpAsc" || sb === "xpDesc") this.sortBy = sb;
      if (this.sortBySelect) this.sortBySelect.value = this.sortBy;

      const cc = localStorage.getItem("motivathon_collapsed_category");
      if (cc) this.collapsedCategory = JSON.parse(cc) || {};
      const cp = localStorage.getItem("motivathon_collapsed_period");
      if (cp) this.collapsedPeriod = JSON.parse(cp) || {};
    } catch (e) { console.warn("prefs load error:", e); }

    // Active tab
    const at = localStorage.getItem("motivathon_active_tab");
    this.showTab((at === "history" || at === "admin") ? at : "tasks", true);

    // Events
    if (this.tabButtons && this.tabButtons.forEach) {
      this.tabButtons.forEach((btn) => btn.addEventListener("click", () => this.showTab(btn.dataset.tab)));
    }
    if (this.openModalBtn) this.openModalBtn.addEventListener("click", () => { this.startAddFlow(); this.showModal(); });
    if (this.historyBtn) this.historyBtn.addEventListener("click", () => { this.renderHistory(); if(this.historyModal){ this.historyModal.style.display="block"; this.historyModal.removeAttribute("hidden"); } });
    if (this.adminBtn) this.adminBtn.addEventListener("click", () => { if(this.adminModal){ this.adminModal.style.display="block"; this.adminModal.removeAttribute("hidden"); } });
    if (this.closeModalBtn) this.closeModalBtn.addEventListener("click", () => this.hideModal());
    if (this.modal) window.addEventListener("click", (e) => { if (e.target === this.modal) this.hideModal(); });
    
    if (this.closeHistoryBtn) this.closeHistoryBtn.addEventListener("click", () => { if(this.historyModal){ this.historyModal.style.display="none"; this.historyModal.setAttribute("hidden","true"); } });
    if (this.closeAdminBtn) this.closeAdminBtn.addEventListener("click", () => { if(this.adminModal){ this.adminModal.style.display="none"; this.adminModal.setAttribute("hidden","true"); } });
    if (this.historyModal) window.addEventListener("click", (e) => { if (e.target === this.historyModal) { this.historyModal.style.display="none"; this.historyModal.setAttribute("hidden","true"); } });
    if (this.adminModal) window.addEventListener("click", (e) => { if (e.target === this.adminModal) { this.adminModal.style.display="none"; this.adminModal.setAttribute("hidden","true"); } });
if (this.form) this.form.addEventListener("submit", (e) => this.handleFormSubmit(e));

    if (this.resetXPBtn) this.resetXPBtn.addEventListener("click", () => this.player.resetXP());
    if (this.backupExportBtn) this.backupExportBtn.addEventListener("click", () => this.handleBackupExport());
    if (this.backupImportBtn) this.backupImportBtn.addEventListener("click", () => { if(this.backupFileInput) this.backupFileInput.click(); });
    if (this.backupFileInput) this.backupFileInput.addEventListener("change", (e) => this.handleBackupImport(e));

    if (this.clearHistoryBtn) this.clearHistoryBtn.addEventListener("click", () => this.clearHistory());
    if (this.clearTasksBtn) this.clearTasksBtn.addEventListener("click", () => this.clearTasks());

    if (this.groupBySelect) this.groupBySelect.addEventListener("change", (e) => this.setGroupBy(e.target.value));
    if (this.sortBySelect) this.sortBySelect.addEventListener("change", (e) => this.setSortBy(e.target.value));

    if (this.collapseAllBtn) this.collapseAllBtn.addEventListener("click", () => this.setAllCollapsed(true));
    if (this.expandAllBtn) this.expandAllBtn.addEventListener("click", () => this.setAllCollapsed(false));

    if (this.importCsvBtn) this.importCsvBtn.addEventListener("click", () => this.handleCsvImport());

    // Restore state
    this.loadFromStorage();

    // Player
    this.player.init();
    this.player.updateLevel();
    this.player.updateXPBar();
    this.renderProfileBadges();

    // Initial render
    this.renderTasks();
    this.renderHistory();
    if (window && window.requestAnimationFrame) { requestAnimationFrame(() => this.player.updateXPBar()); }
  },

  // Helpers meta
  catEmoji(cat) {
    const map = {
      "Alimentation":"🥦",
      "Sport":"🏃",
      "Good Habits":"⏰",
      "Healthy life":"🧘‍♂️",
      "Divers":"🎯",
    };
    return map[cat] || "📌";
  },
  catClass(cat) {
    const s = (cat||"").toLowerCase().replace(/\s+/g,"-");
    if (s.includes("alim")) return "alimentation";
    if (s.includes("sport")) return "sport";
    if (s.includes("good")||s.includes("habits")) return "good-habits";
    if (s.includes("healthy")) return "healthy-life";
    if (s.includes("divers")) return "divers";
    return "divers";
  },
  perClass(per) {
    const p = (per||"").toLowerCase();
    if (p.startsWith("quo")) return "quotidienne";
    if (p.startsWith("hebdo")||p.startsWith("week")) return "hebdomadaire";
    if (p.startsWith("mensu")||p.startsWith("month")) return "mensuelle";
    if (p.includes("3")) return "3-jours";
    if (p.includes("2") && p.includes("semaine")) return "2-semaines";
    if (p.includes("succ")) return "succes";
    return "quotidienne";
  },

  // Tabs
  showTab(name, initial = false) {
    const valid = (name === "tasks" || name === "history" || name === "admin") ? name : "tasks";
    if (this.tabButtons && this.tabButtons.forEach) {
      this.tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === valid));
    }
    if (this.tabPanels.tasks) this.tabPanels.tasks.classList.toggle("active", valid === "tasks");
    if (this.tabPanels.history) this.tabPanels.history.classList.toggle("active", valid === "history");
    if (this.tabPanels.admin) this.tabPanels.admin.classList.toggle("active", valid === "admin");
    if (!initial) localStorage.setItem("motivathon_active_tab", valid);
    if (valid === "tasks") this.renderTasks();
    if (valid === "history") this.renderHistory();
  },

  // Modal helpers
  startAddFlow() {
    this.editingId = null;
    if (this.modalTitle) this.modalTitle.textContent = "Ajouter une tâche";
    if (this.submitBtn) this.submitBtn.textContent = "Ajouter";
    if (this.form) this.form.reset();
  },
  startEditFlow(task) {
    this.editingId = task.id;
    if (this.modalTitle) this.modalTitle.textContent = "Modifier la tâche";
    if (this.submitBtn) this.submitBtn.textContent = "Mettre à jour";
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskCategory").value = task.category;
    document.getElementById("taskPeriod").value = task.period;
    document.getElementById("taskXP").value = task.xp;
    this.showModal();
  },
  showModal() { if (this.modal) this.modal.style.display = "block"; },
  hideModal() { if (this.modal) this.modal.style.display = "none"; if (this.form) this.form.reset(); },

  setGroupBy(mode) {
    if (mode !== "category" && mode !== "period" && mode !== "none") return;
    this.groupBy = mode;
    this.saveToStorage();
    this.renderTasks();
  },
  setSortBy(mode) {
    if (mode !== "none" && mode !== "xpAsc" && mode !== "xpDesc") return;
    this.sortBy = mode;
    this.saveToStorage();
    this.renderTasks();
  },

  handleFormSubmit(event) {
    event.preventDefault();
    const title = document.getElementById("taskTitle").value.trim();
    const category = document.getElementById("taskCategory").value;
    const period = document.getElementById("taskPeriod").value;
    const xp = parseInt(document.getElementById("taskXP").value, 10);
    if (!title || !category || !period || isNaN(xp)) return;

    if (this.editingId) {
      const idx = this.tasks.findIndex((t) => t.id === this.editingId);
      if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], title, category, period, xp };
    } else {
      const id = this.genId();
      this.tasks.push({ id, title, category, period, xp });
    }
    this.saveToStorage();
    this.hideModal();
    this.renderTasks();
    this.editingId = null;
  },

  genId() { return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); },

  removeOneTaskInstance(task) {
    if (task.id) {
      const idx = this.tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) { this.tasks.splice(idx, 1); return; }
    }
    const idx2 = this.tasks.findIndex((t) => t.title === task.title && t.category === task.category && t.period === task.period && t.xp === task.xp);
    if (idx2 !== -1) this.tasks.splice(idx2, 1);
  },

  addHistoryEntry(task) {
    const entry = { id: task.id || null, title: task.title, category: task.category, period: task.period, xp: task.xp, completedAt: new Date().toISOString() };
    this.history.unshift(entry);
    if (this.history.length > 2000) this.history.pop();
  },

  validateTask(task, elCheckbox, taskRow) {
    // UI feedback first
    if (taskRow) {
      taskRow.classList.add("just-validated");
      const xpChip = document.createElement("span");
      xpChip.className = "xp-float";
      xpChip.textContent = `+${task.xp} XP`;
      taskRow.appendChild(xpChip);
      if (window && window.requestAnimationFrame) requestAnimationFrame(() => xpChip.classList.add("show"));
      try { this.burstConfetti(taskRow, 10); } catch(e) {}
      setTimeout(() => taskRow.classList.add("vanish"), 600);
    }
    if (elCheckbox) elCheckbox.disabled = true;
    const xpWrap = document.getElementById("xpContainer");
    if (xpWrap) { xpWrap.classList.add("xp-pulse"); setTimeout(() => xpWrap.classList.remove("xp-pulse"), 420); }

    // After a short delay, apply state changes and re-render
    setTimeout(() => {
      const rid = this.runId;
      if ((this.normalizePeriod && this.normalizePeriod(task.period || task.periodicity)) !== 'succès') { task.count = (task.count || 0) + 1; }
      this.removeOneTaskInstance(task);
      this.player.gainXP(task.xp);
      this.addHistoryEntry(task);
      this.saveToStorage();
      this.player.updateLevel();
      this.player.updateXPBar();
      this.renderProfileBadges();

      // Réapparition (sauf succès)
      const per = ((task.period || task.periodicity || "")).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
      if (per === "succes") { try { if (this.addTrophy) this.addTrophy(task); } catch(e) {}
        this.renderTasks(); this.renderHistory(); return;
      }
      setTimeout(() => {
        if (rid !== this.runId) return;
        if ((this.normalizePeriod && this.normalizePeriod(task.period || task.periodicity)) !== 'succès') {
            task.__reappear = true;
            this.tasks.push(task);
          }
        this.saveToStorage();
        this.renderTasks();
      }, 2000);
      this.renderTasks();
      this.renderHistory();
    }, 900);
  },

  deleteTask(task) { if ((this.normalizePeriod && this.normalizePeriod(task.period || task.periodicity)) !== 'succès') { task.count = (task.count || 0) + 1; }
      this.removeOneTaskInstance(task); this.saveToStorage(); this.renderTasks(); },
  clearHistory() { this.history = []; this.saveToStorage(); this.renderHistory(); },
  clearTasks() { this.runId++; this.tasks = []; this.saveToStorage(); this.renderTasks(); },

  
  // --- Micro animations & confetti ---
  burstConfetti(anchorEl, count=12) {
    try {
      const rect = anchorEl ? anchorEl.getBoundingClientRect() : {left: window.innerWidth/2, top: window.innerHeight/2, width:0, height:0};
      const originX = rect.left + rect.width*0.6;
      const originY = rect.top + rect.height*0.3;
      for (let i=0;i<count;i++) {
        const span = document.createElement('span');
        span.className = 'confetti-piece';
        const dx = (Math.random()*2-1)*60;
        const dy = - (30 + Math.random()*60);
        const rot = (Math.random()*360)|0;
        span.style.setProperty('--dx', dx.toFixed(1)+'px');
        span.style.setProperty('--dy', dy.toFixed(1)+'px');
        span.style.setProperty('--rot', rot+'deg');
        span.style.left = (originX + (Math.random()*16-8))+'px';
        span.style.top = (originY + (Math.random()*10-5))+'px';
        document.body.appendChild(span);
        setTimeout(() => span.remove(), 900);
      }
    } catch(e) {}
  },
  showGradePopup(gradeLabel) {
    const box = document.createElement('div');
    box.className = 'grade-toast';
    box.innerHTML = `<div class="grade-toast-inner">
        <div class="grade-title">🎖️ Nouveau grade !</div>
        <div class="grade-body">${gradeLabel}</div>
        <div class="grade-actions">
          <button class="btn btn-ok">OK</button>
        </div>
        <button class="grade-close" aria-label="Fermer">×</button>
      </div>`;
    document.body.appendChild(box);
    const close = box.querySelector('.grade-close');
    const okBtn = box.querySelector('.btn-ok');
    const dismiss = () => { box.classList.remove('show'); setTimeout(()=>box.remove(), 150); };
    if (close) close.addEventListener('click', dismiss);
    if (okBtn) okBtn.addEventListener('click', dismiss);
    setTimeout(() => { box.classList.add('show'); }, 10);
  },
  onLevelUp(oldLevel, newLevel) {
    const xpWrap = document.getElementById('xpContainer');
    if (xpWrap) {
      xpWrap.classList.add('xp-celebrate');
      setTimeout(()=>xpWrap.classList.remove('xp-celebrate'), 2400);
      this.burstConfetti(xpWrap, 28);
    }
    const oldG = Math.floor(oldLevel/10), newG = Math.floor(newLevel/10);
    if (newG>oldG) {
      const label = this.player.getCurrentGrade ? this.player.getCurrentGrade() : `Grade ${newG}`;
      this.showGradePopup(label);
    }
  },
// Collapsing helpers
  getCollapsedMap() { return this.groupBy === "category" ? this.collapsedCategory : this.collapsedPeriod; },
  saveCollapsedMap() {
    try {
      localStorage.setItem("motivathon_collapsed_category", JSON.stringify(this.collapsedCategory));
      localStorage.setItem("motivathon_collapsed_period", JSON.stringify(this.collapsedPeriod));
    } catch (e) {}
  },
  toggleGroupCollapse(key) {
    const map = this.getCollapsedMap();
    map[key] = !map[key];
    this.saveCollapsedMap();
    this.renderTasks();
  },
  setAllCollapsed(collapsed) {
    const map = this.getCollapsedMap();
    const groups = new Map();
    for (const task of this.tasks) {
      const key = this.groupBy === "category" ? task.category : task.period;
      if (!groups.has(key)) groups.set(key, 0);
      groups.set(key, groups.get(key) + 1);
    }
    for (const key of groups.keys()) map[key] = collapsed;
    this.saveCollapsedMap();
    this.renderTasks();
  },

  createTaskElement(task) {
    const taskDiv = document.createElement("div");
    taskDiv.classList.add("task");
    if (task.__reappear) { taskDiv.classList.add("reappear"); setTimeout(() => { taskDiv.classList.remove("reappear"); delete task.__reappear; }, 500); }

    // Checkbox
    const checkWrap = document.createElement("label");
    checkWrap.className = "check-wrap";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "task-check";
    cb.setAttribute("aria-label", `Valider : ${task.title}`);
    const visual = document.createElement("span");
    visual.className = "custom-checkbox";
    checkWrap.append(cb, visual);

    cb.addEventListener("change", () => {
      if (cb.checked) this.validateTask(task, cb, taskDiv);
    });

    // Left content
    const left = document.createElement("div");
    left.classList.add("left");

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";
    const titleEl = document.createElement("strong");
    titleEl.className = "task-title";
    titleEl.textContent = task.title;

    const xpBadge = document.createElement("span");
    xpBadge.className = "badge badge-xp";
    xpBadge.textContent = `⚡ ${task.xp} XP`;

    const isSuccess = (this.normalizePeriod && this.normalizePeriod(task.period || task.periodicity)) === 'succès';
if (!isSuccess) {
    const count = task.count || 0;
    if (count > 0) {
        const countBadge = document.createElement('span');
        countBadge.className = 'count-badge';
        countBadge.title = 'Répétitions de cette tâche';
        countBadge.textContent = `×${count}`;
        titleRow.append(titleEl, xpBadge, countBadge);
    } else {
        titleRow.append(titleEl, xpBadge);
    }
} else {
    titleRow.append(titleEl, xpBadge);
}
const metaRow = document.createElement("div");
    metaRow.className = "meta-row";
    // Category badge
    const catSpan = document.createElement("span");
    const catClass = this.catClass(task.category);
    catSpan.className = `badge badge-cat badge-cat-${catClass}`;
    catSpan.textContent = `${this.catEmoji(task.category)} ${task.category}`;
    // Period badge
    const perSpan = document.createElement("span");
    const perClass = this.perClass(task.period);
    perSpan.className = `badge badge-per badge-per-${perClass}`;
    perSpan.textContent = task.period;

    metaRow.append(catSpan, perSpan);

    left.append(titleRow, metaRow);

    // Actions (small)
    const actions = document.createElement("div");
    actions.classList.add("actions");
    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.title = "Modifier";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => this.startEditFlow(task));
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn danger";
    deleteBtn.title = "Supprimer";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", () => this.deleteTask(task));
    actions.append(editBtn, deleteBtn);

    taskDiv.append(checkWrap, left, actions);
    return taskDiv;
  },

  renderTasks() {
    if (!this.taskListElement) return;
    this.taskListElement.innerHTML = "";
    if (this.totalCounterEl) this.totalCounterEl.textContent = `Total : ${this.tasks.length}`;

    if (this.groupBy === "none") {
      const flat = this.tasks.slice();
      if (this.sortBy === "xpAsc") flat.sort((a, b) => (a.xp - b.xp) || a.title.localeCompare(b.title, "fr"));
      else if (this.sortBy === "xpDesc") flat.sort((a, b) => (b.xp - a.xp) || a.title.localeCompare(b.title, "fr"));
      else flat.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      if (!flat.length) {
        const empty = document.createElement("p");
        empty.textContent = "Aucune tâche. Ajoute ta première tâche pour commencer.";
        this.taskListElement.appendChild(empty);
        return;
      }
      for (const t of flat) this.taskListElement.appendChild(this.createTaskElement(t));
      return;
    }

    // Grouped
    const groups = new Map();
    for (const task of this.tasks) {
      const key = this.groupBy === "category" ? task.category : task.period;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }
    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "fr"));
    const collapsedMap = this.getCollapsedMap();

    for (const key of keys) {
      const section = document.createElement("div");
      section.classList.add("group");
      const items = groups.get(key).slice();
      const count = items.length;
      const sumXP = items.reduce((acc, t) => acc + (parseInt(t.xp) || 0), 0);

      if (this.sortBy === "xpAsc") items.sort((a, b) => (a.xp - b.xp) || a.title.localeCompare(b.title, "fr"));
      else if (this.sortBy === "xpDesc") items.sort((a, b) => (b.xp - a.xp) || a.title.localeCompare(b.title, "fr"));
      else items.sort((a, b) => a.title.localeCompare(b.title, "fr"));

      const collapsed = collapsedMap[key] === true;
      if (collapsed) section.classList.add("collapsed");

      const title = document.createElement("h3");
      title.innerHTML = `<span class="caret">${collapsed ? "▶" : "▼"}</span> <span class="label">${key}</span> <span class="count-badge">${count}</span> <span class="xp-badge">Σ ${sumXP} XP</span>`;
      title.addEventListener("click", () => this.toggleGroupCollapse(key));
      section.appendChild(title);

      const itemsWrap = document.createElement("div");
      itemsWrap.classList.add("group-items");
      for (const t of items) itemsWrap.appendChild(this.createTaskElement(t));
      section.appendChild(itemsWrap);

      this.taskListElement.appendChild(section);
    }

    if (!keys.length) {
      const empty = document.createElement("p");
      empty.textContent = "Aucune tâche. Ajoute ta première tâche pour commencer.";
      this.taskListElement.appendChild(empty);
    }
  },

  renderHistory() {
    if (!this.historyListElement) return;
    this.historyListElement.innerHTML = "";
    if (!this.history.length) {
      const empty = document.createElement("p");
      empty.textContent = "Aucun élément d'historique pour l’instant.";
      this.historyListElement.appendChild(empty);
      return;
    }
    for (const h of this.history) {
      const row = document.createElement("div");
      row.classList.add("history-item");
      const left = document.createElement("div");
      left.classList.add("history-left");
      left.innerHTML = `<span class="history-badge">${h.category}</span> <span class="history-badge">${h.period}</span> <strong>${h.title}</strong> <span>+${h.xp} XP</span>`;
      const right = document.createElement("div");
      right.classList.add("history-right");
      const date = new Date(h.completedAt);
      right.textContent = date.toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      row.appendChild(left); row.appendChild(right);
      this.historyListElement.appendChild(row);
    }
  },

  // CSV helpers

  sanitizeValue(raw) {
    let s = (raw ?? "").toString();
    s = s.replace(/\uFEFF/g, "").replace(/\u00A0/g, " "); // BOM & NBSP
    s = s.replace(/[“”„‟‹›«»'"]/g, ""); // quotes variants
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
    s = s.replace(/[-–—]/g, "-"); // dashes
    s = s.toLowerCase();
    s = s.replace(/[^a-z0-9\- ]+/g, " "); // keep alnum, dash, space
    s = s.replace(/\s+/g, " ").trim();
    return s;
  },

  // --- Heuristic header mapping when explicit headers fail ---
  guessHeaderMap(headerRow, dataRows, mapPrim) {
    const map = { title: null, category: null, period: null, xp: null };
    const norm = (s) => this.noacc(String(s||"").trim().toLowerCase());
    const cats = new Set(["alimentation","sport","good habits","goodhabits","healthy life","healthylife","divers"]);
    const periods = new Set(["quotidienne","hebdomadaire","mensuelle","3 jours","3jours","2 semaines","2semaines","succès","succes","success","daily","weekly","monthly"]);

    const ncols = Math.max(...dataRows.map(r => r.length), headerRow.length);
    const sampleN = Math.min(12, dataRows.length);

    const colStats = Array.from({length:ncols}, ()=>({numeric:0, cat:0, per:0, avgLen:0, total:0}));

    for (let r = 0; r < sampleN; r++) {
      const row = dataRows[r] || [];
      for (let c = 0; c < ncols; c++) {
        const v = (row[c] ?? "").toString().trim();
        if (!v) continue;
        const nv = norm(v);
        const num = Number(v);
        if (!Number.isNaN(num)) colStats[c].numeric++;
        if (cats.has(nv)) colStats[c].cat++;
        if (periods.has(nv)) colStats[c].per++;
        colStats[c].avgLen += v.length;
        colStats[c].total++;
      }
    }
    for (const cs of colStats) if (cs.total>0) cs.avgLen/=cs.total;

    // XP: most numeric
    let xpIdx = -1, xpScore = -1;
    colStats.forEach((cs, i)=>{ if (cs.numeric > xpScore) { xpScore = cs.numeric; xpIdx = i; } });
    if (xpScore > 0) map.xp = xpIdx;

    // Category: most matches to categories
    let catIdx=-1, catScore=-1;
    colStats.forEach((cs,i)=>{ if (cs.cat > catScore) { catScore=cs.cat; catIdx=i; } });
    if (catScore > 0) map.category = catIdx;

    // Period: most matches to periods
    let perIdx=-1, perScore=-1;
    colStats.forEach((cs,i)=>{ if (cs.per > perScore) { perScore=cs.per; perIdx=i; } });
    if (perScore > 0) map.period = perIdx;

    // Title: the remaining column with highest avgLen
    let titleIdx = -1, titleScore = -1;
    colStats.forEach((cs,i)=>{
      if (i===map.xp || i===map.category || i===map.period) return;
      if (cs.avgLen > titleScore) { titleScore = cs.avgLen; titleIdx = i; }
    });
    if (titleIdx !== -1) map.title = titleIdx;

    // Merge with primary (prefer primary)
    const res = { ...map, ...mapPrim };
    return res;
  },

  cleanHeaderCell(s) {
    if (s == null) return "";
    let x = String(s).replace(/\\uFEFF/g, "").replace(/\\u00A0/g, " ").trim();
    x = x.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    x = x.replace(/\\s+/g, " ");
    return x;
  },
  noacc(s) { return (s || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); },
  csvToRows(text) {
    // Normalize newlines (Windows, Unix, classic Mac) and strip BOM
    if (text && text.charCodeAt && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Detect Excel 'sep=' hint
    let lines = text.split("\n");
    let delim = ",";
    if (lines.length && /^sep\s*=/.test(lines[0].trim().toLowerCase())) {
      const hint = lines[0].split("=",1)[1].trim();
      delim = hint === "\t" ? "\t" : hint;
      lines = lines.slice(1);
    }

    // If no hint, autodetect on first non-empty line
    const firstNonEmpty = lines.find(l => l.trim().length > 0) || "";
    const cnt = (s, p) => (s.match(p) || []).length;
    if (!/^sep\s*=/.test(firstNonEmpty.trim().toLowerCase())) {
      let cand = ",";
      let best = cnt(firstNonEmpty, /,/g);
      const semi = cnt(firstNonEmpty, /;/g);
      if (semi > best) { cand = ";"; best = semi; }
      const tabs = cnt(firstNonEmpty, /\t/g);
      if (tabs > best) { cand = "\t"; best = tabs; }
      delim = cand;
    }

    // Join back to parse char-by-char (so quotes spanning lines work)
    const src = lines.join("\n");
    const rows = [];
    let row = [];
    let field = "";
    let i = 0, inQuotes = false;

    const isDelim = (ch) => (delim === "\t" ? ch === "\t" : ch === delim);
    while (i < src.length) {
      const ch = src[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < src.length && src[i+1] === '"') {
            field += '"'; i += 2; continue; // escaped quote
          } else {
            inQuotes = false; i++; continue; // end quote
          }
        } else {
          field += ch; i++; continue;
        }
      } else {
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (isDelim(ch)) { row.push(field.trim()); field = ""; i++; continue; }
        if (ch === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; i++; continue; }
        field += ch; i++; continue;
      }
    }
    // flush last field/row
    row.push(field.trim());
    rows.push(row);
    // Remove empty lines
    return rows.filter(r => r.some(c => (c||"").trim().length > 0));
  },
  
  headerMapFromRow(headerRow) {
    const map = {};
    const clean = (s) => this.cleanHeaderCell(s);
    const base = (s) => this.noacc(clean(s)).toLowerCase().trim();
    const alpha = (s) => base(s).replace(/[^a-z0-9]+/g, "");
    const like = (a, patt) => a.startsWith(patt) || a.includes(patt);

    for (let i = 0; i < headerRow.length; i++) {
      const hRaw = headerRow[i];
      if (hRaw == null) continue;
      const b = base(hRaw);
      const a = alpha(hRaw);
      if (!a) continue;

      if (map.title == null && (["titre","title","tache","tâche","task","nom"].includes(b) || like(a,"tit") || like(a,"tach") || like(a,"tache") || like(a,"task") || a==="nom" || a==="itre")) { map.title = i; continue; }
      if (map.category == null && (["categorie","catégorie","category","cat"].includes(b) || a.includes("categor") || a.startsWith("cat") || a==="ategorie")) { map.category = i; continue; }
      if (map.period == null && (["periodicite","périodicite","périodicité","periodicité","period","frequence","fréquence","frequency"].includes(b) || a.includes("period") || a.includes("perio") || a.includes("riodic") || a.includes("frequ") || a.startsWith("freq") || a==="eriode" || a==="eriodicite")) { map.period = i; continue; }
      if (map.xp == null && (["xp","points","score"].includes(b) || a==="xp" || a.includes("point") || a.includes("score"))) { map.xp = i; continue; }
    }
    return map;
  },

  normalizeCategory(raw) {
    const s = this.sanitizeValue(raw);
    const map = {
      "alimentation":"Alimentation",
      "sport":"Sport",
      "good habits":"Good Habits",
      "good-habits":"Good Habits",
      "healthy life":"Healthy life",
      "healthy-life":"Healthy life",
      "divers":"Divers",
      "misc":"Divers"
    };
    if (map[s]) return map[s];
    // Substring heuristics
    if (s.includes("alim")) return "Alimentation";
    if (s.includes("sport")) return "Sport";
    if (s.includes("habit")) return "Good Habits";
    if (s.includes("healthy") || s.includes("sain")) return "Healthy life";
    if (s.includes("divers") || s.includes("misc")) return "Divers";
    return null;
  },
  normalizePeriod(raw) {
    const s = this.sanitizeValue(raw);
    const map = {
      "quotidienne":"quotidienne", "quotidien":"quotidienne", "daily":"quotidienne",
      "hebdomadaire":"hebdomadaire", "weekly":"hebdomadaire",
      "mensuelle":"mensuelle", "mensuel":"mensuelle", "monthly":"mensuelle",
      "3 jours":"3 jours", "3-jours":"3 jours", "3jours":"3 jours",
      "2 semaines":"2 semaines", "2-semaines":"2 semaines", "2semaines":"2 semaines",
      "succes":"succès", "succès":"succès", "success":"succès"
    };
    if (map[s]) return map[s];
    // Heuristics
    if (s.startsWith("quo")) return "quotidienne";
    if (s.startsWith("hebdo") || s.startsWith("week")) return "hebdomadaire";
    if (s.startsWith("mensu") || s.startsWith("month")) return "mensuelle";
    if (s.includes("3") && s.includes("jour")) return "3 jours";
    if (s.includes("2") && s.includes("semaine")) return "2 semaines";
    if (s.includes("succ")) return "succès";
    return null;
  },
  handleCsvImport() {
    if (!this.importCsvInput) return;
    if (this.importSummary) this.importSummary.textContent = "";
    if (this.importErrors) this.importErrors.style.display = "none";
    if (this.importErrorsList) this.importErrorsList.innerHTML = "";

    const file = this.importCsvInput && this.importCsvInput.files && this.importCsvInput.files[0];
    if (!file) { if (this.importSummary) this.importSummary.textContent = "Sélectionne un fichier .csv."; return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target.result;
      const rows = this.csvToRows(text);
      if (!rows.length) { if (this.importSummary) this.importSummary.textContent = "Fichier vide ou invalide."; return; }
      const header = rows[0].map((h) => this.cleanHeaderCell(h));
      let map = this.headerMapFromRow(header);
      if (map.title == null || map.category == null || map.period == null || map.xp == null) {
        // Fallback: guess mapping from data
        const bodyRows = rows.slice(1);
        const guess = this.guessHeaderMap(header, bodyRows, map);
        if (guess.title != null && guess.category != null && guess.period != null && guess.xp != null) {
          map = guess;
        } else {
          if (this.importSummary) this.importSummary.textContent = "En-têtes manquants. Attendu : Titre, Catégorie, Périodicité, XP.";
          if (this.importErrors && this.importErrorsList) {
            this.importErrors.style.display = "";
            const li = document.createElement("li"); li.textContent = "Debug: en-têtes détectés = [" + header.join(" | ") + "]"; this.importErrorsList.appendChild(li);
            const li2 = document.createElement("li"); li2.textContent = "Debug: mapping = " + JSON.stringify(map); this.importErrorsList.appendChild(li2);
          }
          return;
        }
      }
      const errors = [];
      const newTasks = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const title = (row[map.title] ?? "").toString().trim();
        const catRaw = (row[map.category] ?? "").toString().trim();
        const perRaw = (row[map.period] ?? "").toString().trim();
        const xpRaw = (row[map.xp] ?? "").toString().trim();
        if (!title && !catRaw && !perRaw && !xpRaw) continue;
        const category = this.normalizeCategory(catRaw);
        const period = this.normalizePeriod(perRaw);
        const xp = parseInt(xpRaw, 10);
        if (!title) { errors.push(`Ligne ${r+1} : Titre vide.`); continue; }
        if (!category) { errors.push(`Ligne ${r+1} : Catégorie inconnue (“${catRaw}”).`); continue; }
        if (!period) { errors.push(`Ligne ${r+1} : Périodicité inconnue (“${perRaw}”).`); continue; }
        if (isNaN(xp) || xp <= 0) { errors.push(`Ligne ${r+1} : XP invalide (“${xpRaw}”).`); continue; }
        newTasks.push({ id: this.genId(), title, category, period, xp });
      }
      const before = this.tasks.length;
      this.tasks.push(...newTasks);
      const after = this.tasks.length;
      this.saveToStorage();
      this.renderTasks();
      this.showTab("tasks");
      const added = after - before;
      const skipped = errors.length;
      if (this.importSummary) this.importSummary.textContent = `${added} tâche(s) importée(s). ${skipped} ignorée(s).`;
      if (errors.length && this.importErrors && this.importErrorsList) {
        this.importErrors.style.display = "";
        for (const e of errors) {
          const li = document.createElement("li");
          li.textContent = e;
          this.importErrorsList.appendChild(li);
        }
      }
    };
    reader.readAsText(file, "utf-8");
  },

  // Persistence
  saveToStorage() {
    try {
      localStorage.setItem("motivathon_tasks", JSON.stringify(this.tasks));
      localStorage.setItem("motivathon_history", JSON.stringify(this.history));
      localStorage.setItem("motivathon_xp", String(this.player.xp));
      localStorage.setItem("motivathon_groupby", this.groupBy);
      localStorage.setItem("motivathon_sortby", this.sortBy);
      localStorage.setItem("motivathon_collapsed_category", JSON.stringify(this.collapsedCategory));
      localStorage.setItem("motivathon_collapsed_period", JSON.stringify(this.collapsedPeriod));
    } catch (e) {}
  },
  loadFromStorage() {
    try {
      const storedTasks = localStorage.getItem("motivathon_tasks");
      if (storedTasks) {
        this.tasks = JSON.parse(storedTasks) || [];
        let changed = false;
        for (const t of this.tasks) { if (!t.id) { t.id = this.genId(); changed = true; } t.xp = Number(t.xp) || 0; }
        if (changed) this.saveToStorage();
      }
      const storedHistory = localStorage.getItem("motivathon_history");
      if (storedHistory) this.history = JSON.parse(storedHistory) || [];
      const storedXP = localStorage.getItem("motivathon_xp");
      if (storedXP != null) {
        const val = parseInt(storedXP, 10);
        this.player.xp = isNaN(val) ? 0 : val;
      }
    } catch (e) {}
  },

  // Profile badges
  renderProfileBadges() {
    const wrap = document.getElementById("profileBadges");
    if (!wrap) return;
    const lvl = this.player.level;
    const grade = this.player.getCurrentGrade();
    const xpTotal = this.player.xp;
    wrap.innerHTML = `
      <span class="badge-soft badge-level" title="Niveau actuel">🔰 Niveau ${lvl}</span>
      <span class="badge-soft badge-grade" title="Grade (change tous les 10 niveaux)">🏅 ${grade}</span>
      <span class="badge-soft badge-xptotal" title="XP totale accumulée">💎 ${xpTotal} XP</span>
    `;
},

  // Player (XP / niveaux / grades)
  player: {
    xp: 0,
    level: 0,
    thresholds: [],
    grades: ["Bouli Bouli","Loukoum","Bien, mais pas top","Ah! On y vient...","Paladin neutre","Poulet","En jambes","Patron du Game","Monte Cristo","Heavy is the Crown"],
    xpToNext: [100,125,144,158,170,181,191,200,208,215,222,228,235,241,246,251,257,262,266,271,275,280,284,288,292,296,300,303,307,310,314,317,320,323,327,330,333,336,339,341,344,347,350,353,355,358,360,363,365,368,370,373,375,377,380,382,384,387,389,391,393,395,397,400,402,404,406,408,410,412,414,416,417,419,421,423,425,427,429,430,432,434,436,437,439,441,443,444,446,448,449,451,453,454,456,457,459,461,462,463],
    init() { this.thresholds = this.buildThresholds(); },
    buildThresholds() { let sum = 0; const thr = []; for (const step of this.xpToNext) { sum += step; thr.push(sum); } return thr; },
    gainXP(amount) { this.xp += amount; this.updateLevel(); this.updateXPBar(); },
    resetXP() { this.xp = 0; this.level = 0; Motivathon.saveToStorage(); this.updateLevel(); this.updateXPBar(); },
    updateLevel() {
      const old = this.level || 0;
      let newLevel = 0;
      while (newLevel < this.thresholds.length && this.xp >= this.thresholds[newLevel]) newLevel++;
      if (newLevel > 99) newLevel = 99;
      this.level = newLevel;
      try { if (newLevel>old) Motivathon.onLevelUp(old, newLevel); } catch(e) {}
      const levelEl = document.getElementById("levelDisplay");
      if (levelEl) levelEl.textContent = `Niveau : ${this.level} | Grade : ${this.getCurrentGrade()}`;
      const ph = document.getElementById("gradeImage");
      if (ph) {
        const grade = this.getCurrentGrade();
        ph.setAttribute("aria-label", `Image du grade (placeholder) — ${grade}`);
        ph.title = grade;
      }
      Motivathon.renderProfileBadges();
    },
    updateXPBar() {
      const xpTotal = this.xp;
      const xpCurrentLevel = (this.level === 0) ? 0 : this.thresholds[this.level - 1];
      const xpNextLevel = this.thresholds[Math.min(this.level, this.thresholds.length - 1)];
      const denom = Math.max(1, (xpNextLevel - xpCurrentLevel));
      const numerator = Math.max(0, Math.min(xpTotal - xpCurrentLevel, xpNextLevel - xpCurrentLevel));
      const progress = (numerator / denom) * 100;
      
      const bar = document.getElementById("xpBar");
      if (bar) {
        bar.setAttribute("role", "progressbar");
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", String(xpNextLevel - xpCurrentLevel));
        bar.setAttribute("aria-valuenow", String(numerator));
        bar.setAttribute("aria-label", `XP vers niveau ${this.level + 1}`);
      }
const fill = document.getElementById("xpFill"); const label = document.getElementById("xpLabel");
      const p = Math.min(100, Math.max(0, progress));
      if (fill) fill.style.width = p + "%";
      if (label) label.textContent = `XP : ${numerator} / ${xpNextLevel - xpCurrentLevel}`;
      const totalLabel = document.getElementById("xpTotalDisplay"); if (totalLabel) totalLabel.textContent = `XP total : ${xpTotal}`;
      Motivathon.renderProfileBadges();
    },
    getCurrentGrade() { const idx = Math.min(9, Math.floor(this.level / 10)); return this.grades[idx] || "Heavy is the Crown"; },
    animateLevelUp() {}
  },

  // ===== Backup / Restore =====
  buildBackup() {
    const dump = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.toLowerCase().startsWith("motivathon")) {
          dump[k] = localStorage.getItem(k);
        }
      }
    } catch(e) {}
    return {
      __schema: "motivathon-backup@1",
      exportedAt: new Date().toISOString(),
      data: dump
    };
  },
  handleBackupExport() {
    try {
      const backup = this.buildBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0,15);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `motivathon_backup_${ts}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      if (this.backupSummary) this.backupSummary.textContent = "Backup exporté.";
    } catch(e) { if (this.backupSummary) this.backupSummary.textContent = "Échec de l'export."; }
  },
  async handleBackupImport(evt) {
    try {
      const file = (evt && evt.target && evt.target.files && evt.target.files[0]) ? evt.target.files[0] : null;
      if (!file) return;
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== "object" || !obj.data || typeof obj.data !== "object") {
        if (this.backupSummary) this.backupSummary.textContent = "Fichier invalide.";
        return;
      }
      // Restore all motivathon* keys
      const data = obj.data;
      Object.keys(data).forEach((k) => {
        try { localStorage.setItem(k, data[k]); } catch(e) {}
      });

      // Rehydrate in-memory state
      // Tasks/History/XP
      this.loadFromStorage();
      // Prefs
      try {
        const gb = localStorage.getItem("motivathon_groupby"); if (gb) this.groupBy = gb;
        const sb = localStorage.getItem("motivathon_sortby"); if (sb) this.sortBy = sb;
        const cc = localStorage.getItem("motivathon_collapsed_category"); if (cc) this.collapsedCategory = JSON.parse(cc)||{};
        const cp = localStorage.getItem("motivathon_collapsed_period"); if (cp) this.collapsedPeriod = JSON.parse(cp)||{};
      } catch(e){}
      // Trophies
      try {
        const t = localStorage.getItem("motivathon.trophies");
        if (t) { this._trophies = JSON.parse(t)||[]; if (this.saveTrophies) this.saveTrophies(); if (this.renderTrophies) this.renderTrophies(); }
      } catch(e){}

      // Refresh UI
      this.player.updateLevel(); this.player.updateXPBar();
      this.renderProfileBadges(); this.renderTasks(); this.renderHistory();

      if (this.backupSummary) this.backupSummary.textContent = "Backup restauré.";
      if (this.backupFileInput) this.backupFileInput.value = "";
    } catch(e) {
      if (this.backupSummary) this.backupSummary.textContent = "Échec de l'import.";
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Motivathon.init());

// --- Armoire aux Trophées (Succès) -------------------------------------------------
(function () {
  const M = (typeof Motivathon !== 'undefined') ? Motivathon : null;
  if (!M) return;

  const STORAGE_KEY = "motivathon.trophies";

  // Load persisted trophies
  M._trophies = [];
  try { M._trophies = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch(e) { M._trophies = []; }

  M.saveTrophies = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._trophies)); } catch(e) {}
  };

  M.formatDateFR = function (iso) {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch(e) { return iso; }
  };

  M.ensureTrophyCabinet = function () {
    let cab = document.getElementById('trophyCabinet');
    if (!cab) {
      const xp = document.getElementById('xpContainer');
      cab = document.createElement('div');
      cab.id = 'trophyCabinet';
      cab.className = 'trophy-cabinet';
      cab.innerHTML = `<div class="trophy-title">🗄️ Armoire aux trophées</div><div id="trophyGrid" class="trophy-grid"></div>`;
      if (xp && xp.parentNode) xp.parentNode.insertBefore(cab, xp.nextSibling);
      else document.body.appendChild(cab);
    }
    if (!document.getElementById('trophyGrid')) {
      const grid = document.createElement('div');
      grid.id = 'trophyGrid';
      grid.className = 'trophy-grid';
      cab.appendChild(grid);
    }
  };

M.fixTrophyMisplacement = function () {
  try {
    const xp = document.getElementById('xpContainer');
    const cab = document.getElementById('trophyCabinet');
    const grid = document.getElementById('trophyGrid');
    if (!cab || !grid) return;

    // Ensure cabinet is OUTSIDE xpContainer (after it)
    if (xp && xp.contains(cab)) {
      xp.insertAdjacentElement('afterend', cab);
    }

    // Ensure grid is a child of the cabinet
    if (grid.parentElement !== cab) {
      cab.appendChild(grid);
    }

    // Remove any stray trophies in XP area
    if (xp) {
      xp.querySelectorAll('.trophy, .trophy-item').forEach(el => el.remove());
      const walker = document.createTreeWalker(xp, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (n.nodeValue && n.nodeValue.includes('🏆')) nodes.push(n);
      }
      nodes.forEach(n => n.nodeValue = n.nodeValue.replace(/🏆+/g, ''));
    }
  } catch (e) {}
};



  M.renderTrophies = function () {
    this.ensureTrophyCabinet();
    this.fixTrophyMisplacement();
    const grid = document.getElementById('trophyGrid');
    if (!grid) return;
    grid.innerHTML = "";
    this._trophies.forEach(t => {
      const el = document.createElement('div');
      el.className = 'trophy';
      el.textContent = '🏆';
      el.setAttribute('aria-label', t.title);
      el.dataset.tooltip = `${t.title} — ${this.formatDateFR(t.date)}`;
      grid.appendChild(el);
    });
  };

  M.addTrophy = function (task) {
    try {
      const title = task.title || task.name || "(Succès)";
      const nowIso = new Date().toISOString();
      this._trophies.push({ title, date: nowIso });
      this.saveTrophies();
      this.renderTrophies();
    } catch(e) {}
  };

  // Initial render on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => M.renderTrophies());
  } else {
    M.renderTrophies();
    M.fixTrophyMisplacement && M.fixTrophyMisplacement();
  }
})();

// === Armoire aux Trophées — Core ===
(function(){
  const M = (typeof window!=='undefined' ? (window.Motivathon||window.MOTIVATHON||window.motivathon) : null)
            || (typeof Motivathon!=='undefined' ? Motivathon : null);
  if (!M) return;

  const STORAGE_KEY = "motivathon.trophies";
  M._trophies = M._trophies || [];
  try { M._trophies = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch(e) {}

  M.saveTrophies = function () { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._trophies||[])); } catch(e) {} };
  M.formatDateFR = function (iso) { try { return new Intl.DateTimeFormat('fr-FR',{ dateStyle:'short', timeStyle:'short'}).format(new Date(iso)); } catch(e){ return iso; } };

  M.ensureTrophyCabinet = function () {
    let cab = document.getElementById('trophyCabinet');
    if (!cab) {
      const xp = document.getElementById('xpContainer');
      cab = document.createElement('div');
      cab.id = 'trophyCabinet';
      cab.className = 'trophy-cabinet';
      cab.innerHTML = `<div class="trophy-title">🗄️ Armoire aux trophées</div><div id="trophyGrid" class="trophy-grid"></div>`;
      if (xp && xp.parentNode) xp.parentNode.insertBefore(cab, xp.nextSibling);
      else document.body.appendChild(cab);
    }
    if (!document.getElementById('trophyGrid')) {
      const grid = document.createElement('div');
      grid.id = 'trophyGrid';
      grid.className = 'trophy-grid';
      cab.appendChild(grid);
    }
  };

  M.renderTrophies = function () {
    this.ensureTrophyCabinet();
    this.fixTrophyMisplacement();
    try { const xp = document.getElementById('xpContainer'); if (xp) xp.querySelectorAll('.trophy').forEach(el => el.remove()); } catch(e){}
    const grid = document.getElementById('trophyGrid');
    if (!grid) return;
    grid.innerHTML = "";
    (this._trophies || []).forEach(t => {
      const el = document.createElement('div');
      el.className = 'trophy-item';
      el.textContent = '🏆';
      el.setAttribute('aria-label', t.title);
      el.dataset.tooltip = `${t.title} — ${this.formatDateFR(t.date)}`;
      grid.appendChild(el);
    });
  };

  M.addTrophy = function (task) {
    const title = (task && (task.title || task.name)) || "(Succès)";
    const nowIso = new Date().toISOString();
    this._trophies = this._trophies || [];
    this._trophies.push({ title, date: nowIso });
    this.saveTrophies();
    this.renderTrophies();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => M.renderTrophies());
  } else {
    M.renderTrophies();
    M.fixTrophyMisplacement && M.fixTrophyMisplacement();
  }
})();

// === Armoire aux Trophées — Wrapper ===
(function(){
  const M = (typeof window!=='undefined' ? (window.Motivathon||window.MOTIVATHON||window.motivathon) : null)
            || (typeof Motivathon!=='undefined' ? Motivathon : null);
  if (!M || typeof M.validateTask !== 'function' || M._validateTaskWrapped_v2) return;

  function isSuccessTask(task){
    try {
      const raw = (task && (task.period || task.periodicity) || "").toString();
      const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if (M.normalizePeriod) {
        const np = M.normalizePeriod(raw);
        if ((np||'').toLowerCase() === 'succès') return true;
      }
      return norm === 'succes' || norm === 'success';
    } catch(e){ return false; }
  }

  const _orig = M.validateTask.bind(M);
  M.validateTask = function(task, elCheckbox, taskRow){
    const res = _orig(task, elCheckbox, taskRow);
    if (isSuccessTask(task) && typeof this.addTrophy === 'function') {
      try { this.addTrophy(task); } catch(e) {}
    }
    return res;
  };
  M._validateTaskWrapped_v2 = true;
})();


// === UI Helpers (Design Refresh) ===
window.Motivathon = (typeof Motivathon !== 'undefined') ? Motivathon : (window.Motivathon = window.Motivathon || {});

Motivathon.ui = Motivathon.ui || {};

Motivathon.ui.makeBtn = function(btn, kind){
  try{
    btn.classList.add('btn');
    if (kind) btn.classList.add(kind);
  }catch(e){}
  return btn;
};

Motivathon.ui.buildChips = function(task){
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  if (task.category){
    const c = document.createElement('span');
    c.className = 'chip cat';
    c.textContent = (task.categoryEmoji ? task.categoryEmoji+' ' : '') + task.category;
    wrap.appendChild(c);
  }
  const rawPer = (task.period || task.periodicity || '')+'';
  if (rawPer){
    const p = document.createElement('span');
    p.className = 'chip per';
    p.textContent = rawPer;
    wrap.appendChild(p);
  }
  if (typeof task.xp === 'number'){
    const x = document.createElement('span');
    x.className = 'chip xp';
    x.textContent = `+${task.xp} XP`;
    wrap.appendChild(x);
  }
  return wrap;
};

Motivathon.ui.decorateTaskRow = function(rowEl, task){
  try{
    const cb = rowEl.querySelector('input[type="checkbox"]');
    if (cb && !rowEl.querySelector('.task-check')){
      const box = document.createElement('span');
      box.className = 'task-check';
      cb.after(box);
      const sync = ()=> box.classList.toggle('checked', cb.checked);
      box.addEventListener('click', ()=>{ cb.click(); });
      cb.addEventListener('change', sync);
      sync();
    }

    const actionButtons = rowEl.querySelectorAll('button');
    if (actionButtons.length){
      actionButtons.forEach((b,i)=>{
        if (b.classList.contains('btn')) return;
        Motivathon.ui.makeBtn(b, i===0 ? 'btn-secondary' : 'btn-danger');
      });
    }

    const title = rowEl.querySelector('.task-title') || rowEl.querySelector('.title');
    if (title && !rowEl.querySelector('.chips')){
      const chips = Motivathon.ui.buildChips(task||{});
      const meta = rowEl.querySelector('.task-meta') || document.createElement('div');
      meta.classList.add('task-meta');
      meta.appendChild(chips);
      title.parentElement.appendChild(meta);
    }
  }catch(e){}
};

// Fallback observer to decorate task rows after render
(function(){
  try {
    const root = document.getElementById('tasksContainer') || document.body;
    const obs = new MutationObserver(ms => {
      ms.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType===1 && (n.classList && n.classList.contains('task-row'))) {
            Motivathon.ui.decorateTaskRow(n, {});
          }
        });
      });
    });
    obs.observe(root, { childList:true, subtree:true });
  } catch(e){}
})();


// === Safe Group Header Decorator (non-invasive) ===
(function(){
  function norm(s){
    return (s||"").toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().trim();
  }
  function detectKeyFromHeader(h3){
    try{
      const clone = h3.cloneNode(true);
      clone.querySelectorAll('.count-badge,.xp-badge,.caret').forEach(el=>el.remove());
      return clone.textContent.replace(/\s+/g,' ').trim();
    }catch(e){ return h3.textContent.trim(); }
  }
  function classify(section, mode, key){
    const n = norm(key);
    if (mode === 'category'){
      const map = {
        'alimentation':'alimentation',
        'sport':'sport',
        'good habits':'good-habits',
        'healthy life':'healthy-life',
        'divers':'divers'
      };
      const cls = map[n] || n.replace(/\s+/g,'-');
      section.classList.add('cat-'+cls);
    } else if (mode === 'period'){
      const map = {
        'quotidienne':'quotidienne',
        'hebdomadaire':'hebdomadaire',
        'mensuelle':'mensuelle',
        '3 jours':'3-jours',
        '2 semaines':'2-semaines',
        'succes':'succes',
        'succès':'succes'
      };
      const cls = map[n] || n.replace(/\s+/g,'-');
      section.classList.add('per-'+cls);
    }
    section.dataset.skinned = "1";
  }
  function decorate(){
    try{
      const modeSel = document.getElementById('groupBy');
      const mode = (modeSel && modeSel.value) || 'category';
      document.querySelectorAll('.group:not([data-skinned])').forEach(section=>{
        const h3 = section.querySelector('h3');
        if (!h3) return;
        const key = detectKeyFromHeader(h3);
        if (!key) return;
        classify(section, mode, key);
      });
    }catch(e){/*noop*/}
  }
  function start(){
    decorate();
    const root = document.getElementById('tasksContainer') || document.body;
    try{
      const obs = new MutationObserver(()=>decorate());
      obs.observe(root, { childList:true, subtree:true });
    }catch(e){/*noop*/}
    const sel = document.getElementById('groupBy');
    if (sel) sel.addEventListener('change', ()=>{
      document.querySelectorAll('.group[data-skinned]').forEach(s=>{
        s.removeAttribute('data-skinned');
        s.className = (s.className || '').split(' ').filter(c=>!/^cat-|^per-/.test(c)).join(' ').trim() || 'group';
      });
      decorate();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* === Micro-patch: grade images (grades/ subfolder) + grade-change modal === */
(function(){
  try{
    var M = window.Motivathon || window.M || window.app || null;
    var prevGradeIdx = null;
    var IMAGES = [
      "grades/grade-00.png","grades/grade-10.png","grades/grade-20.png","grades/grade-30.png","grades/grade-40.png",
      "grades/grade-50.png","grades/grade-60.png","grades/grade-70.png","grades/grade-80.png","grades/grade-90.png"
    ];
    function getGradeIdx(){
      try{ var lvl = (M && M.player && (M.player.level||0)) || 0; return Math.max(0, Math.min(9, Math.floor(lvl/10))); }catch(e){ return 0; }
    }
    function setGradeImage(){
      try{
        var el = document.getElementById("gradeImage"); if(!el) return;
        var idx = getGradeIdx(); var src = IMAGES[idx];
        if(!src){ el.style.backgroundImage = ""; el.classList.remove("has-img"); return; }
        var test = new Image();
        test.onload = function(){ el.style.backgroundImage = "url('"+src+"')"; el.classList.add("has-img"); el.textContent=""; };
        test.onerror = function(){ el.style.backgroundImage = ""; el.classList.remove("has-img"); };
        test.src = src;
      }catch(e){}
    }
    function showGradeModal(idx){
      try{
        var src = IMAGES[idx]; if(!src) return;
        var overlay = document.createElement("div");
        overlay.className = "modal grade-modal"; overlay.style.display = "block";
        overlay.setAttribute("role","dialog"); overlay.setAttribute("aria-modal","true");
        var box = document.createElement("div"); box.className = "modal-content";
        box.innerHTML = '<h3 class="title">Nouveau grade !</h3>' +
                        '<img alt="Nouveau grade" src="'+src+'"/>' +
                        '<div style="margin-top:12px; text-align:right"><button id="closeGradeModal" class="secondary">OK</button></div>';
        overlay.appendChild(box); document.body.appendChild(overlay);
        function close(){ overlay.style.display="none"; overlay.remove(); }
        overlay.addEventListener("click", function(e){ if(e.target===overlay) close(); });
        var btn = box.querySelector("#closeGradeModal"); if(btn) btn.addEventListener("click", close);
      }catch(e){}
    }
    function hook(){
      try{
        if(!(M && M.player && typeof M.player.updateLevel === "function")) return;
        if(M.player.__gradeHooked2) return; M.player.__gradeHooked2 = true;
        var orig = M.player.updateLevel.bind(M.player);
        prevGradeIdx = getGradeIdx();
        M.player.updateLevel = function(){
          var before = prevGradeIdx;
          var r = orig.apply(this, arguments);
          try{ var now = getGradeIdx(); if(now !== before){ showGradeModal(now); prevGradeIdx = now; } setGradeImage(); }catch(e){}
          return r;
        };
      }catch(e){}
    }
    if(!M || !M.player){ document.addEventListener('DOMContentLoaded', function(){ M = window.Motivathon || window.M || window.app; hook(); setGradeImage(); }); }
    else { hook(); setGradeImage(); }
  }catch(e){}
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("✅ Service Worker enregistré"))
      .catch((err) => console.error("❌ Service Worker erreur :", err));
  });
}
