let state = {
    xp: 0,
    level: 1,
    tasks: [],
    history: []
  };

  function loadState() {
    const saved = localStorage.getItem('motivathon');
    if (saved) state = JSON.parse(saved);
    render();
  }

  function saveState() {
    localStorage.setItem('motivathon', JSON.stringify(state));
  }

  function addOrUpdateTask(id, name, category, period, xp) {
    if (id) {
      const task = state.tasks.find(t => t.id === parseInt(id));
      if (task) {
        task.name = name;
        task.category = category;
        task.period = period;
        task.xp = xp;
      }
    } else {
      state.tasks.push({ id: Date.now(), name, category, period, xp });
    }
    saveState();
    render();
  }

  function completeTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    state.xp += parseInt(task.xp);
    state.history.push({ name: task.name, date: new Date().toLocaleString() });
    if (task.period === "Succès") {
      state.tasks = state.tasks.filter(t => t.id !== id);
    }
    saveState();
    render();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    render();
  }

  function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById("edit-id").value = task.id;
    document.getElementById("task-name").value = task.name;
    document.getElementById("task-category").value = task.category;
    document.getElementById("task-period").value = task.period;
    document.getElementById("task-xp").value = task.xp;
    openModal();
  }

  function getLevel(xp) {
    let level = 1, total = 0;
    for (let i = 0; i < levels.length; i++) {
      total += levels[i].xp;
      if (xp < total) return { level: i + 1, grade: levels[i].grade, progress: xp / total * 100 };
    }
    return { level: levels.length, grade: levels[levels.length - 1].grade, progress: 100 };
  }

  function groupTasks(tasks) {
    const mode = document.getElementById("grouping").value;
    if (mode === "xp") {
      return [...tasks].sort((a, b) => b.xp - a.xp);
    } else {
      const grouped = {};
      tasks.forEach(t => {
        const key = t[mode];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });
      return grouped;
    }
  }

  function render() {
    const list = document.getElementById("task-list");
    list.innerHTML = "";
    const mode = document.getElementById("grouping").value;
    const grouped = groupTasks(state.tasks);

    if (Array.isArray(grouped)) {
      grouped.forEach(task => list.appendChild(renderTask(task)));
    } else {
      for (const group in grouped) {
        const header = document.createElement("h4");
        header.textContent = group;
        list.appendChild(header);
        grouped[group].forEach(task => list.appendChild(renderTask(task)));
      }
    }

    const info = getLevel(state.xp);
    document.getElementById("xp").textContent = state.xp;
    document.getElementById("level").textContent = info.level;
    document.getElementById("grade").textContent = info.grade;
    document.getElementById("xp-bar").style.width = info.progress + "%";

    const histo = document.getElementById("history");
    histo.innerHTML = state.history.map(h => `<p>${h.name} - ${h.date}</p>`).join('');
  }

  function renderTask(task) {
    const el = document.createElement("div");
    el.className = "task";
    el.innerHTML = `
      <input type="checkbox" onchange="completeTask(${task.id})" />
      <strong>${task.name}</strong> (${task.category}, ${task.period}, ${task.xp} XP)
      <span class="actions">
        <button onclick="editTask(${task.id})">✏️</button>
        <button onclick="deleteTask(${task.id})">❌</button>
      </span>`;
    return el;
  }

  function toggleHistory() {
    const h = document.getElementById("history");
    h.style.display = h.style.display === "none" ? "block" : "none";
  }

  function openModal() {
    document.getElementById("taskModal").style.display = "block";
  }

  function closeModal() {
    document.getElementById("taskModal").style.display = "none";
    document.getElementById("taskForm").reset();
    document.getElementById("edit-id").value = "";
  }

  document.getElementById("taskForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("task-name").value;
    const category = document.getElementById("task-category").value;
    const period = document.getElementById("task-period").value;
    const xp = document.getElementById("task-xp").value;
    if (name && category && period && xp) {
      addOrUpdateTask(id, name, category, period, xp);
      closeModal();
    }
  });

  window.onclick = function(event) {
    const modal = document.getElementById("taskModal");
    if (event.target === modal) closeModal();
  };

  loadState();
</script>


<script>
const categoryIcons = {
  "Alimentation": "🥦",
  "Sport": "🏋️",
  "Good Habits": "💡",
  "Healthy life": "❤️",
  "Divers": "🌀",
  "Succès": "🌟"
};

let state = {
  xp: 0,
  level: 1,
  tasks: [],
  history: [],
  previousLevel: 1
};

function loadState() {
  const saved = localStorage.getItem('motivathon');
  if (saved) state = JSON.parse(saved);
  render();
}

function saveState() {
  localStorage.setItem('motivathon', JSON.stringify(state));
}

function addOrUpdateTask(id, name, category, period, xp) {
  if (id) {
    const task = state.tasks.find(t => t.id === parseInt(id));
    if (task) {
      task.name = name;
      task.category = category;
      task.period = period;
      task.xp = xp;
    }
  } else {
    state.tasks.push({ id: Date.now(), name, category, period, xp });
  }
  saveState();
  render();
}

function completeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.xp += parseInt(task.xp);
  state.history.push({ name: task.name, date: new Date().toLocaleString() });

  const el = document.querySelector(`[data-id='${id}']`);
  if (el) el.classList.add("fade-out");

  if (task.period === "Succès") {
    setTimeout(() => {
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveState();
      render();
    }, 500);
  } else {
    const temp = { ...task };
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    render();
    setTimeout(() => {
      state.tasks.push(temp);
      saveState();
      render();
    }, 1800);
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  render();
}

function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById("edit-id").value = task.id;
  document.getElementById("task-name").value = task.name;
  document.getElementById("task-category").value = task.category;
  document.getElementById("task-period").value = task.period;
  document.getElementById("task-xp").value = task.xp;
  openModal();
}

function getLevel(xp) {
  let level = 1, total = 0;
  for (let i = 0; i < levels.length; i++) {
    total += levels[i].xp;
    if (xp < total) return { level: i + 1, grade: levels[i].grade, progress: xp / total * 100 };
  }
  return { level: levels.length, grade: levels[levels.length - 1].grade, progress: 100 };
}

function groupTasks(tasks) {
  const mode = document.getElementById("grouping").value;
  if (mode === "xp") return [...tasks].sort((a, b) => b.xp - a.xp);
  const grouped = {};
  tasks.forEach(t => {
    const key = t[mode];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  return grouped;
}

function renderTask(task) {
  const el = document.createElement("div");
  el.className = "task fade-in";
  el.setAttribute("data-id", task.id);
  const icon = categoryIcons[task.category] || "";
  el.innerHTML = `
    <input type="checkbox" onchange="completeTask(${task.id})" />
    <strong>${icon} ${task.name}</strong> (${task.category}, ${task.period}, ${task.xp} XP)
    <span class="actions">
      <button onclick="editTask(${task.id})">✏️</button>
      <button onclick="deleteTask(${task.id})">❌</button>
    </span>`;
  return el;
}

function render() {
  const list = document.getElementById("task-list");
  list.innerHTML = "";
  const grouped = groupTasks(state.tasks);

  if (Array.isArray(grouped)) {
    grouped.forEach(task => list.appendChild(renderTask(task)));
  } else {
    for (const group in grouped) {
      const h = document.createElement("h4");
      h.textContent = group;
      list.appendChild(h);
      grouped[group].forEach(task => list.appendChild(renderTask(task)));
    }
  }

  const info = getLevel(state.xp);
  const lvlEl = document.getElementById("level");
  if (info.level !== state.previousLevel) {
    lvlEl.classList.add("animated");
    setTimeout(() => lvlEl.classList.remove("animated"), 1000);
  }
  state.previousLevel = info.level;

  document.getElementById("xp").textContent = state.xp;
  lvlEl.textContent = info.level;
  document.getElementById("grade").textContent = info.grade;
  document.getElementById("xp-bar").style.width = info.progress + "%";

  const histo = document.getElementById("history");
  histo.innerHTML = state.history.map(h => `<p>${h.name} - ${h.date}</p>`).join('');
}

function toggleHistory() {
  const h = document.getElementById("history");
  h.style.display = h.style.display === "none" ? "block" : "none";
}

function openModal() {
  document.getElementById("taskModal").style.display = "block";
}

function closeModal() {
  document.getElementById("taskModal").style.display = "none";
  document.getElementById("taskForm").reset();
  document.getElementById("edit-id").value = "";
}

document.getElementById("taskForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const name = document.getElementById("task-name").value;
  const category = document.getElementById("task-category").value;
  const period = document.getElementById("task-period").value;
  const xp = document.getElementById("task-xp").value;
  if (name && category && period && xp) {
    addOrUpdateTask(id, name, category, period, xp);
    closeModal();
  }
});

window.onclick = function(event) {
  const modal = document.getElementById("taskModal");
  if (event.target === modal) closeModal();
};

loadState();