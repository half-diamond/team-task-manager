const apiBase = '/api';
const state = {
  token: localStorage.getItem('ttm_token') || '',
  user: null,
  projects: [],
  activeProjectId: null,
  activeProject: null,
  tasks: [],
  stats: null,
  taskFilter: 'All',
  searchTerm: '',
  showTaskForm: false
};

const el = (id) => document.getElementById(id);
let toastTimer;

function showToast(message) {
  const node = el('toast');
  node.textContent = message;
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 2600);
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

function setAuthToken(token) {
  state.token = token;
  if (token) localStorage.setItem('ttm_token', token);
  else localStorage.removeItem('ttm_token');
}

function showView(isAuthed) {
  el('authView').classList.toggle('hidden', isAuthed);
  el('appView').classList.toggle('hidden', !isAuthed);
  el('logoutBtn').classList.toggle('hidden', !isAuthed);
  el('userChip').classList.toggle('hidden', !isAuthed);
}

function formatDate(dateValue) {
  if (!dateValue) return 'No due date';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString();
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'Done') return false;
  const dueDate = new Date(task.dueDate);
  return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
}

function getUserId(user) {
  return user?._id || user?.id || user || '';
}

function myRole() {
  const project = state.activeProject;
  if (!project || !state.user) return '';
  const me = project.members.find((m) => getUserId(m.user) === state.user.id);
  return me ? me.role : '';
}

async function start() {
  setupForms();
  if (!state.token) {
    showView(false);
    return;
  }
  try {
    const { user } = await apiRequest('/auth/me');
    state.user = user;
    renderUser();
    showView(true);
    await loadProjects();
  } catch (err) {
    setAuthToken('');
    showView(false);
    showToast('Please log in again');
  }
}

function renderUser() {
  if (!state.user) return;
  el('userChip').textContent = `${state.user.name} - ${state.user.email}`;
}

function toggleAuthForm() {
  el('loginSection').classList.toggle('hidden');
  el('signupSection').classList.toggle('hidden');
}

function setupForms() {
  el('showSignupBtn').addEventListener('click', toggleAuthForm);
  el('showLoginBtn').addEventListener('click', toggleAuthForm);
  el('openCreateTaskBtn').addEventListener('click', () => {
    state.showTaskForm = true;
    renderProject();
    const panel = el('createTaskCard');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const titleInput = el('createTaskForm').elements.title;
    window.setTimeout(() => titleInput.focus(), 250);
  });
  el('closeCreateTaskBtn').addEventListener('click', () => {
    state.showTaskForm = false;
    renderProject();
  });
  el('taskSearchInput').addEventListener('input', (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderTasks(myRole() === 'Admin');
  });
  document.querySelectorAll('[data-task-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.taskFilter = button.dataset.taskFilter;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === button));
      renderTasks(myRole() === 'Admin');
    });
  });
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      el(button.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const { user, token } = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password')
        })
      });
      state.user = user;
      setAuthToken(token);
      renderUser();
      showView(true);
      await loadProjects();
      showToast('Logged in');
      formEl.reset();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const { user, token } = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password')
        })
      });
      state.user = user;
      setAuthToken(token);
      renderUser();
      showView(true);
      await loadProjects();
      showToast('Account created');
      formEl.reset();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('logoutBtn').addEventListener('click', () => {
    setAuthToken('');
    state.user = null;
    state.projects = [];
    state.activeProject = null;
    state.activeProjectId = null;
    showView(false);
    renderProjects();
    renderEmpty();
    showToast('Logged out');
  });

  el('createProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const formEl = e.currentTarget;
      const form = new FormData(formEl);
      const { project } = await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description')
        })
      });
      formEl.reset();
      if (project?._id) {
        state.activeProjectId = project._id;
        state.activeProject = project;
        state.showTaskForm = false;
        state.projects = [project, ...state.projects.filter((item) => item._id !== project._id)];
        renderProjects();
      }
      showToast('Project created');
      await loadProjects();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeProjectId) return;
    try {
      const formEl = e.currentTarget;
      const form = new FormData(formEl);
      await apiRequest(`/projects/${state.activeProjectId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          role: form.get('role')
        })
      });
      formEl.reset();
      showToast('Member added');
      await refreshProject();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('createTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeProjectId) return;
    try {
      const formEl = e.currentTarget;
      const form = new FormData(formEl);
      const assignedTo = form.get('assignedTo');
      await apiRequest(`/tasks/project/${state.activeProjectId}`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          dueDate: form.get('dueDate') || undefined,
          priority: form.get('priority'),
          assignedTo: assignedTo || undefined
        })
      });
      formEl.reset();
      state.showTaskForm = false;
      showToast('Task created');
      await refreshProject();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('refreshProjectsBtn').addEventListener('click', loadProjects);
  el('refreshTasksBtn').addEventListener('click', refreshProject);
}

async function loadProjects() {
  try {
    const data = await apiRequest('/projects');
    state.projects = data.projects || [];
    renderProjects();
    if (!state.activeProjectId && state.projects.length) {
      await selectProject(state.projects[0]._id);
    } else if (state.activeProjectId) {
      const exists = state.projects.some((p) => p._id === state.activeProjectId);
      if (!exists && state.projects.length) await selectProject(state.projects[0]._id);
      else if (!state.projects.length) renderEmpty();
      else await refreshProject();
    }
  } catch (err) {
    showToast(err.message);
  }
}

function renderProjects() {
  const list = el('projectsList');
  if (!state.projects.length) {
    list.innerHTML = '<p class="muted">No projects yet. Create one to get started.</p>';
    return;
  }
  list.innerHTML = state.projects.map((project) => {
    const memberCount = project.members?.length || 0;
    return `
      <div class="project-item ${project._id === state.activeProjectId ? 'active' : ''}" data-id="${project._id}">
        <span class="project-avatar">${initials(project.name)}</span>
        <div class="project-copy">
          <strong>${escapeHtml(project.name)}</strong>
          <p class="muted">${escapeHtml(project.description || 'No description')}</p>
          <span class="project-meta">${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
        </div>
      </div>
    `;
  }).join('');
  list.querySelectorAll('.project-item').forEach((item) => {
    item.addEventListener('click', () => selectProject(item.dataset.id));
  });
}

function renderEmpty() {
  el('emptyState').classList.remove('hidden');
  el('projectPanel').classList.add('hidden');
}

async function selectProject(projectId) {
  state.activeProjectId = projectId;
  state.showTaskForm = false;
  renderProjects();
  await refreshProject();
}

async function refreshProject() {
  if (!state.activeProjectId) return renderEmpty();
  try {
    const [projectData, tasksData, statsData] = await Promise.all([
      apiRequest(`/projects/${state.activeProjectId}`),
      apiRequest(`/tasks/project/${state.activeProjectId}`),
      apiRequest(`/dashboard/project/${state.activeProjectId}`)
    ]);

    state.activeProject = projectData.project;
    state.tasks = tasksData.tasks || [];
    state.stats = statsData.stats;

    renderProject();
  } catch (err) {
    showToast(err.message);
  }
}

function renderProject() {
  const project = state.activeProject;
  if (!project) return renderEmpty();

  el('emptyState').classList.add('hidden');
  el('projectPanel').classList.remove('hidden');
  el('projectTitle').textContent = project.name;
  el('projectDescription').textContent = project.description || 'No description provided';
  el('rolePill').textContent = `Your role: ${myRole() || 'Member'}`;
  el('memberCountPill').textContent = `${project.members.length} ${project.members.length === 1 ? 'member' : 'members'}`;

  const isAdmin = myRole() === 'Admin';
  el('addMemberForm').classList.toggle('hidden', !isAdmin);
  el('createTaskForm').classList.toggle('hidden', !isAdmin);
  el('createTaskCard').classList.toggle('hidden', !isAdmin || !state.showTaskForm);
  el('openCreateTaskBtn').classList.toggle('hidden', !isAdmin);

  const assignSelect = el('createTaskForm').elements.assignedTo;
  assignSelect.innerHTML = '<option value="">Assign later</option>' + project.members.filter((member) => member.user).map((member) => {
    const name = member.user?.name || member.user?.email || 'Member';
    return `<option value="${getUserId(member.user)}">${escapeHtml(name)} (${member.role})</option>`;
  }).join('');

  renderMembers(project.members, isAdmin);
  renderStats();
  renderWorkload();
  renderTasks(isAdmin);
}

function renderMembers(members, isAdmin) {
  const holder = el('membersList');
  holder.innerHTML = members.map((member) => {
    const user = member.user || {};
    const userId = getUserId(user);
    const isCreator = state.activeProject && getUserId(state.activeProject.createdBy) === userId;
    const name = user.name || 'Unknown';
    return `
      <div class="member-row">
        <span class="member-avatar">${initials(name || user.email || 'Member')}</span>
        <div class="member-main">
          <strong>${escapeHtml(name)}</strong>
          <div class="muted">${escapeHtml(user.email || '')}</div>
        </div>
        <div class="task-meta">
          <span class="chip">${member.role}${isCreator ? ' - Creator' : ''}</span>
          ${isAdmin && !isCreator && userId ? `<button class="btn btn-ghost btn-danger btn-sm" data-remove="${userId}">Remove</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiRequest(`/projects/${state.activeProjectId}/members/${btn.dataset.remove}`, { method: 'DELETE' });
        showToast('Member removed');
        await refreshProject();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function renderStats() {
  const stats = state.stats;
  const grid = el('statsGrid');
  if (!stats) {
    grid.innerHTML = '';
    return;
  }
  const total = stats.totalTasks || 0;
  const byStatus = stats.byStatus || {};
  grid.innerHTML = `
    <div class="stat card total"><span class="muted">Total tasks</span><strong>${total}</strong></div>
    <div class="stat card"><span class="muted">To Do</span><strong>${byStatus['To Do'] || 0}</strong></div>
    <div class="stat card progress"><span class="muted">In Progress</span><strong>${byStatus['In Progress'] || 0}</strong></div>
    <div class="stat card done"><span class="muted">Done</span><strong>${byStatus.Done || 0}</strong></div>
    <div class="stat card overdue"><span class="muted">Overdue</span><strong>${stats.overdueTasks || 0}</strong></div>
    <div class="stat card"><span class="muted">Tracked users</span><strong>${(stats.tasksPerUser || []).length}</strong></div>
    <div class="stat card"><span class="muted">Members</span><strong>${state.activeProject.members.length}</strong></div>
    <div class="stat card"><span class="muted">Your role</span><strong>${myRole() || 'Member'}</strong></div>
  `;
}

function renderWorkload() {
  const stats = state.stats;
  const list = el('tasksPerUserList');
  const scope = el('dashboardScope');
  if (!stats) {
    list.innerHTML = '';
    scope.textContent = '';
    return;
  }

  const rows = stats.tasksPerUser || [];
  scope.textContent = stats.scope === 'assigned' ? 'Your assigned workload' : 'Project workload';

  if (!rows.length) {
    list.innerHTML = '<p class="muted">No task assignments yet.</p>';
    return;
  }

  const maxCount = Math.max(...rows.map((row) => row.count || 0), 1);
  list.innerHTML = rows.map((row) => {
    const user = row.user || {};
    const name = user.name || user.email || 'Unknown user';
    const email = user.email || row.role || '';
    const percent = Math.round(((row.count || 0) / maxCount) * 100);
    return `
      <div class="workload-row">
        <div class="workload-user">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(email)}</span>
        </div>
        <div class="workload-meter" aria-label="${escapeHtml(name)} task load">
          <span class="workload-fill" style="width: ${percent}%"></span>
        </div>
        <span class="chip">${row.count || 0} ${(row.count || 0) === 1 ? 'task' : 'tasks'}</span>
      </div>
    `;
  }).join('');
}

function renderTasks(isAdmin) {
  const board = el('tasksBoard');
  if (!state.activeProject) {
    board.innerHTML = '';
    return;
  }

  const statuses = [
    { label: 'To Do', dotClass: 'status-to-do' },
    { label: 'In Progress', dotClass: 'status-in-progress' },
    { label: 'Done', dotClass: 'status-done', title: 'Completed' }
  ];
  const members = (state.activeProject.members || []).filter((member) => member.user);
  const visibleTasks = filteredTasks();
  const subtitle = el('boardSubtitle');
  if (subtitle) {
    const scope = isAdmin ? 'Project tasks' : 'Assigned to you';
    const filterText = state.taskFilter === 'All' ? 'All statuses' : state.taskFilter;
    subtitle.textContent = `${scope} - ${filterText}`;
  }

  if (!state.tasks.length) {
    board.innerHTML = `<div class="empty-board">${isAdmin ? 'No tasks yet. Create the first task above.' : 'No tasks are assigned to you yet.'}</div>`;
    return;
  }

  if (!visibleTasks.length) {
    board.innerHTML = '<div class="empty-board">No tasks match the current search or filter.</div>';
    return;
  }

  board.innerHTML = statuses.map((status) => {
    const columnTasks = visibleTasks.filter((task) => task.status === status.label);
    if (state.taskFilter !== 'All' && state.taskFilter !== status.label) return '';
    return `
      <section class="kanban-column">
        <div class="column-head">
          <span class="column-title">
            <span class="column-dot ${status.dotClass}"></span>
            ${status.title || status.label}
          </span>
          <span class="chip">${columnTasks.length}</span>
        </div>
        <div class="column-tasks">
          ${columnTasks.length ? columnTasks.map((task) => renderTaskCard(task, isAdmin, members)).join('') : '<div class="empty-column">No tasks here.</div>'}
        </div>
      </section>
    `;
  }).join('');

  bindTaskEvents();
}

function filteredTasks() {
  return state.tasks.filter((task) => {
    const matchesFilter = state.taskFilter === 'All' || task.status === state.taskFilter;
    if (!matchesFilter) return false;
    if (!state.searchTerm) return true;
    const assignedName = task.assignedTo?.name || task.assignedTo?.email || '';
    return [
      task.title,
      task.description,
      task.priority,
      task.status,
      assignedName
    ].some((value) => String(value || '').toLowerCase().includes(state.searchTerm));
  });
}

function renderTaskCard(task, isAdmin, members) {
  const overdue = isOverdue(task);
  const assignedId = getUserId(task.assignedTo);
  const canEdit = isAdmin || assignedId === state.user?.id;
  const assignedName = task.assignedTo?.name || 'Unassigned';
  const statusStyle = statusClass(task.status);
  const priorityStyle = priorityClass(task.priority);
  const dueText = overdue ? 'Overdue' : task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date';

  return `
      <article class="task-card task-${statusStyle}">
        <div class="task-priority">
          <span class="chip chip-priority ${priorityStyle}">${task.priority} priority</span>
          <span class="chip ${overdue ? 'chip-danger' : ''}">${dueText}</span>
        </div>
        <strong class="task-title">${escapeHtml(task.title)}</strong>
        <p class="task-description">${escapeHtml(task.description || 'No description')}</p>
        <div class="task-meta">
          <span class="chip chip-status ${statusStyle}">${task.status}</span>
          <span class="chip">Assigned: ${escapeHtml(assignedName)}</span>
        </div>
        <div class="task-footer">
          <div class="assignee-stack">
            <span class="assignee-avatar">${initials(assignedName)}</span>
            <span>${escapeHtml(assignedName)}</span>
          </div>
        </div>
        <div class="task-actions">
          <div class="task-action-row">
            ${canEdit ? `
              <select data-status="${task._id}">
                <option ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                <option ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option ${task.status === 'Done' ? 'selected' : ''}>Done</option>
              </select>
            ` : ''}
            ${isAdmin ? `
              <select data-assign="${task._id}">
                <option value="">Unassigned</option>
                ${members.map((member) => `
                  <option value="${getUserId(member.user)}" ${assignedId === getUserId(member.user) ? 'selected' : ''}>
                    ${escapeHtml(member.user.name || member.user.email || 'Member')}
                  </option>
                `).join('')}
              </select>
              <button class="btn btn-ghost btn-danger btn-sm" data-delete="${task._id}">Delete</button>
            ` : ''}
          </div>
          ${isAdmin ? renderTaskEditForm(task) : ''}
        </div>
      </article>
    `;
}

function bindTaskEvents() {
  const board = el('tasksBoard');
  board.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('change', async (e) => {
      try {
        await apiRequest(`/tasks/${e.target.dataset.status}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: e.target.value })
        });
        showToast('Status updated');
        await refreshProject();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  board.querySelectorAll('[data-assign]').forEach((select) => {
    select.addEventListener('change', async (e) => {
      try {
        await apiRequest(`/tasks/${e.target.dataset.assign}/assign`, {
          method: 'PATCH',
          body: JSON.stringify({ assignedTo: e.target.value || null })
        });
        showToast('Task reassigned');
        await refreshProject();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  board.querySelectorAll('[data-edit]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formEl = e.currentTarget;
      const editForm = new FormData(formEl);
      try {
        await apiRequest(`/tasks/${formEl.dataset.edit}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: editForm.get('title'),
            description: editForm.get('description'),
            dueDate: editForm.get('dueDate') || null,
            priority: editForm.get('priority')
          })
        });
        showToast('Task updated');
        await refreshProject();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  board.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await apiRequest(`/tasks/${btn.dataset.delete}`, { method: 'DELETE' });
        showToast('Task deleted');
        await refreshProject();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function renderTaskEditForm(task) {
  return `
    <details class="task-edit">
      <summary>Edit details</summary>
      <form class="task-edit-form" data-edit="${task._id}">
        <label>
          Title
          <input type="text" name="title" value="${escapeHtml(task.title)}" required />
        </label>
        <label>
          Due date
          <input type="date" name="dueDate" value="${dateInputValue(task.dueDate)}" />
        </label>
        <label>
          Priority
          <select name="priority">
            ${priorityOptions(task.priority)}
          </select>
        </label>
        <label class="field-wide">
          Description
          <textarea name="description" rows="3">${escapeHtml(task.description || '')}</textarea>
        </label>
        <button class="btn" type="submit">Save task</button>
      </form>
    </details>
  `;
}

function priorityOptions(selectedPriority) {
  return ['Low', 'Medium', 'High'].map((priority) => (
    `<option ${priority === selectedPriority ? 'selected' : ''}>${priority}</option>`
  )).join('');
}

function dateInputValue(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function statusClass(status) {
  return `status-${slug(status)}`;
}

function priorityClass(priority) {
  return `priority-${slug(priority)}`;
}

function initials(value) {
  const words = String(value || 'TT').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TT';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

start();
