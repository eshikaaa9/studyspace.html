// ================================================
// StudySpace – Student Task Planner
// All data is saved in the browser's LocalStorage.
// ================================================

// ---------- Grab HTML elements ----------
const form = document.getElementById("taskForm");
const titleInput = document.getElementById("title");
const subjectInput = document.getElementById("subject");
const deadlineInput = document.getElementById("deadline");
const priorityInput = document.getElementById("priority");
const typeInput = document.getElementById("type");
const formError = document.getElementById("formError");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");
const filterButtons = document.querySelectorAll(".filter");
const toast = document.getElementById("toast");

const STORAGE_KEY = "studyspace-tasks";

let tasks = [];          // array holding all task objects
let currentFilter = "all";
let editingId = null;    // id of the task being edited (null = adding new)

// ---------- Date helpers ----------

// Returns a date as "YYYY-MM-DD" (local time) so we can compare easily
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Returns today's date, shifted by a number of days (used for sample tasks)
function dayFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateString(d);
}

const today = () => toDateString(new Date());

// A task is overdue if its deadline has passed and it isn't completed
function isOverdue(task) {
  return !task.completed && task.deadline < today();
}

// A task is due today if the deadline equals today and it isn't completed
function isDueToday(task) {
  return !task.completed && task.deadline === today();
}

// Makes "2026-10-28" look like "Oct 28, 2026"
function formatDate(str) {
  const [y, m, d] = str.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---------- LocalStorage ----------

// Save the tasks array to LocalStorage (as a JSON string)
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Load tasks from LocalStorage. On first launch, create sample tasks.
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    tasks = JSON.parse(saved);
  } else {
    tasks = [
      { id: 1, title: "Finish calculus worksheet", subject: "Mathematics", deadline: dayFromToday(0), priority: "High", type: "Assignment", completed: false },
      { id: 2, title: "Read chapter 5", subject: "History", deadline: dayFromToday(2), priority: "Low", type: "Reading", completed: false },
      { id: 3, title: "Lab report on circuits", subject: "Physics", deadline: dayFromToday(-1), priority: "High", type: "Assignment", completed: false },
      { id: 4, title: "Build portfolio website", subject: "Web Development", deadline: dayFromToday(7), priority: "Medium", type: "Project", completed: false },
      { id: 5, title: "Revise for midterm quiz", subject: "Chemistry", deadline: dayFromToday(-3), priority: "Medium", type: "Exam", completed: true },
    ];
    saveTasks();
  }
}

// ---------- Rendering ----------

// Update the 4 dashboard numbers and the progress bar
function updateDashboard() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const dueToday = tasks.filter(isDueToday).length;

  document.getElementById("totalCount").textContent = total;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("todayCount").textContent = dueToday;

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressText").textContent = percent + "% completed";
}

// Return only the tasks that match the selected filter
function getFilteredTasks() {
  if (currentFilter === "pending") return tasks.filter(t => !t.completed);
  if (currentFilter === "completed") return tasks.filter(t => t.completed);
  if (currentFilter === "overdue") return tasks.filter(isOverdue);
  return tasks;
}

// Draw the task list on the page
function renderTasks() {
  taskList.innerHTML = "";
  // Sort by deadline so the most urgent tasks are on top
  const list = [...getFilteredTasks()].sort((a, b) => a.deadline.localeCompare(b.deadline));

  emptyMessage.classList.toggle("hidden", list.length > 0);

  list.forEach(task => {
    const li = document.createElement("li");
    li.className = "task";
    if (task.completed) li.classList.add("completed");
    else if (isOverdue(task)) li.classList.add("overdue");
    else if (isDueToday(task)) li.classList.add("today");

    // Warning text for overdue / due today
    let warning = "";
    if (isOverdue(task)) warning = `<p class="warning">⚠️ Overdue! This task was due ${formatDate(task.deadline)}.</p>`;
    else if (isDueToday(task)) warning = `<p class="warning">⏰ Due today – don't forget!</p>`;

    li.innerHTML = `
      <input type="checkbox" ${task.completed ? "checked" : ""} title="Mark complete" />
      <div class="task-body">
        <p class="task-title"></p>
        <div class="task-meta">
          <span>📘 <span class="subj"></span></span>
          <span>📅 ${formatDate(task.deadline)}</span>
          <span>🏷️ ${task.type}</span>
          <span class="badge ${task.priority}">${task.priority}</span>
        </div>
        ${warning}
      </div>
      <div class="task-actions">
        <button class="icon-btn edit" title="Edit">✏️</button>
        <button class="icon-btn delete" title="Delete">🗑️</button>
      </div>`;

    // Use textContent for user text (safe against HTML injection)
    li.querySelector(".task-title").textContent = task.title;
    li.querySelector(".subj").textContent = task.subject;

    // Attach button events
    li.querySelector("input").addEventListener("change", () => toggleTask(task.id));
    li.querySelector(".edit").addEventListener("click", () => startEdit(task.id));
    li.querySelector(".delete").addEventListener("click", () => deleteTask(task.id));

    taskList.appendChild(li);
  });
}

// Re-draw everything after any change
function refresh() {
  saveTasks();
  updateDashboard();
  renderTasks();
}

// ---------- Messages ----------

// Show a small pop-up message at the bottom of the screen
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ---------- Form handling ----------

// Check the form fields; returns an error message or "" if valid
function validateForm() {
  if (titleInput.value.trim().length < 3) return "Please enter a task title (at least 3 characters).";
  if (subjectInput.value.trim() === "") return "Please enter a subject.";
  if (deadlineInput.value === "") return "Please choose a deadline.";
  return "";
}

// Runs when the form is submitted (either add or save edit)
form.addEventListener("submit", event => {
  event.preventDefault(); // stop page reload

  const error = validateForm();
  formError.textContent = error;
  if (error) return;

  const data = {
    title: titleInput.value.trim(),
    subject: subjectInput.value.trim(),
    deadline: deadlineInput.value,
    priority: priorityInput.value,
    type: typeInput.value,
  };

  if (editingId === null) {
    // Add a new task
    tasks.push({ id: Date.now(), completed: false, ...data });
    showToast("✅ Task added successfully!");
  } else {
    // Update the existing task
    const task = tasks.find(t => t.id === editingId);
    Object.assign(task, data);
    showToast("✏️ Task updated!");
  }

  resetForm();
  refresh();
});

// Fill the form with a task's data so the user can edit it
function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  editingId = id;
  titleInput.value = task.title;
  subjectInput.value = task.subject;
  deadlineInput.value = task.deadline;
  priorityInput.value = task.priority;
  typeInput.value = task.type;

  formTitle.textContent = "✏️ Edit Task";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  formError.textContent = "";
  form.scrollIntoView({ behavior: "smooth" });
}

// Clear the form and go back to "Add" mode
function resetForm() {
  form.reset();
  priorityInput.value = "Medium";
  editingId = null;
  formTitle.textContent = "➕ Add New Task";
  submitBtn.textContent = "Add Task";
  cancelEditBtn.classList.add("hidden");
  formError.textContent = "";
}

cancelEditBtn.addEventListener("click", resetForm);

// ---------- Task actions ----------

// Mark a task complete / not complete
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  task.completed = !task.completed;
  if (task.completed) showToast("🎉 Great job! Task completed.");
  refresh();
}

// Delete a task after asking for confirmation
function deleteTask(id) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  tasks = tasks.filter(t => t.id !== id);
  if (editingId === id) resetForm();
  showToast("🗑️ Task deleted.");
  refresh();
}

// ---------- Filters ----------
filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

// ---------- Start the app ----------
loadTasks();
updateDashboard();
renderTasks();
