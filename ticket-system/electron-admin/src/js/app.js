// ── Navigation ─────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-view]');
const views = document.querySelectorAll('.view');

function showView(viewId) {
  views.forEach(v => v.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'import' || viewId === 'generate') loadEventSelects();
  if (viewId === 'events') { loadEventsList(); loadOrgSelect(); }
  if (viewId === 'organisations') loadOrgsList();
  if (viewId === 'users') { loadUsersList(); loadUserOrgSelect(); }
  if (viewId === 'settings') loadSettings();
}

navItems.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  setTimeout(() => t.classList.add('hidden'), 3500);
}

function confirmAction(msg) {
  return window.confirm(msg);
}

// ── CSV Parser ─────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function findCol(row, ...patterns) {
  for (const key of Object.keys(row)) {
    const lk = key.toLowerCase();
    for (const pattern of patterns) {
      if (lk.includes(pattern.toLowerCase())) return row[key] || '';
    }
  }
  return '';
}

// ── Settings ──────────────────────────────────────────
function loadSettings() {
  const { url, key } = API.getConfig();
  document.getElementById('setting-url').value = url;
  document.getElementById('setting-key').value = key;
}

document.getElementById('save-settings').addEventListener('click', () => {
  localStorage.setItem('serverUrl', document.getElementById('setting-url').value.trim().replace(/\/$/, ''));
  localStorage.setItem('apiKey', document.getElementById('setting-key').value.trim());
  showToast('Settings saved', 'success');
});

document.getElementById('test-connection').addEventListener('click', async () => {
  const el = document.getElementById('connection-status');
  el.className = 'info-box'; el.textContent = 'Testing connection…'; el.classList.remove('hidden');
  try {
    const ok = await API.testConnection();
    el.className = ok ? 'info-box info-success' : 'info-box info-error';
    el.textContent = ok ? '✓ Connected successfully' : '✗ Connection failed — check URL and API key';
  } catch (e) {
    el.className = 'info-box info-error';
    el.textContent = `✗ ${e.message}`;
  }
});

// ── Dashboard ──────────────────────────────────────────
let allEvents = [];

async function loadDashboard() {
  try {
    allEvents = await API.getEvents();
    const orgs = [...new Set(allEvents.map(e => e.org_name))];
    const sel = document.getElementById('dashboard-org-filter');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Organisations</option>' +
      orgs.map(o => `<option value="${o}"${o === current ? ' selected' : ''}>${o}</option>`).join('');
    renderDashboard();
  } catch (e) {
    document.getElementById('dashboard-events-list').innerHTML = `<div class="empty-card"><p class="error">${e.message}</p></div>`;
  }
}

function renderDashboard() {
  const filter = document.getElementById('dashboard-org-filter').value;
  const events = filter ? allEvents.filter(e => e.org_name === filter) : allEvents;
  document.getElementById('stat-events').textContent = events.length;
  const total = events.reduce((s, e) => s + (parseInt(e.total_tickets) || 0), 0);
  const scanned = events.reduce((s, e) => s + (parseInt(e.scanned_tickets) || 0), 0);
  document.getElementById('stat-tickets').textContent = total;
  document.getElementById('stat-scanned').textContent = scanned;
  document.getElementById('stat-remaining').textContent = total - scanned;

  const list = document.getElementById('dashboard-events-list');
  list.innerHTML = events.length ? events.map(e => {
    const pct = e.total_tickets ? Math.round((e.scanned_tickets / e.total_tickets) * 100) : 0;
    return `
      <div class="list-card">
        <div class="list-card-main">
          <strong>${e.name}</strong>
          <span class="muted">${e.org_name} &middot; ${new Date(e.event_date).toLocaleDateString('en-GB')}</span>
        </div>
        <div class="list-card-meta">
          <div class="progress-wrap">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span class="muted">${e.scanned_tickets || 0}/${e.total_tickets || 0}</span>
          </div>
          <a href="${API.getConfig().url}/events/${e.slug}/scan" target="_blank" class="btn btn-sm">Scanner ↗</a>
        </div>
      </div>`;
  }).join('') : '<div class="empty-card"><p class="muted">No events found.</p></div>';
}

document.getElementById('dashboard-org-filter').addEventListener('change', renderDashboard);

// ── Organisations ──────────────────────────────────────
async function loadOrgsList() {
  const list = document.getElementById('orgs-list');
  try {
    const orgs = await API.getOrganisations();
    list.innerHTML = orgs.length ? orgs.map(o => `
      <div class="list-card">
        <div class="list-card-main">
          <strong>${o.name}</strong>
          <span class="muted">/${o.slug}</span>
        </div>
        <div class="list-card-meta">
          <div class="color-dots">
            <span class="dot" style="background:${o.primary_color}" title="Primary"></span>
            <span class="dot" style="background:${o.accent_color}" title="Accent"></span>
          </div>
          <button class="btn btn-sm btn-danger" onclick="deleteOrg(${o.id}, '${o.name.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>`).join('')
      : '<div class="empty-card"><p class="muted">No organisations yet.</p></div>';
  } catch (e) {
    list.innerHTML = `<div class="empty-card"><p class="error">${e.message}</p></div>`;
  }
}

async function deleteOrg(id, name) {
  if (!confirmAction(`Delete "${name}"? This will delete all events and tickets for this organisation.`)) return;
  try {
    await API.deleteOrganisation(id);
    showToast('Organisation deleted', 'success');
    loadOrgsList();
  } catch (e) { showToast(e.message, 'error'); }
}
window.deleteOrg = deleteOrg;

document.getElementById('show-add-org').addEventListener('click', () => {
  document.getElementById('org-form-container').classList.remove('hidden');
});
document.getElementById('cancel-org').addEventListener('click', () => {
  document.getElementById('org-form-container').classList.add('hidden');
});
document.getElementById('org-name').addEventListener('input', e => {
  document.getElementById('org-slug').value = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
});
document.getElementById('pick-org-logo').addEventListener('click', async () => {
  const data = await window.electronAPI.openImage();
  if (!data) return;
  document.getElementById('org-logo-data').value = data;
  document.getElementById('org-logo-name').textContent = 'Image selected';
  const p = document.getElementById('org-logo-preview');
  p.src = data; p.classList.remove('hidden');
});
document.getElementById('save-org').addEventListener('click', async () => {
  const name = document.getElementById('org-name').value.trim();
  const slug = document.getElementById('org-slug').value.trim();
  if (!name || !slug) return showToast('Name and slug required', 'error');
  try {
    await API.createOrganisation({
      name, slug,
      logo_url: document.getElementById('org-logo-data').value || null,
      primary_color: document.getElementById('org-primary').value,
      accent_color: document.getElementById('org-accent').value,
      secondary_color: document.getElementById('org-secondary').value
    });
    showToast('Organisation saved', 'success');
    document.getElementById('org-form-container').classList.add('hidden');
    document.getElementById('org-name').value = '';
    document.getElementById('org-slug').value = '';
    loadOrgsList();
  } catch (e) { showToast(e.message, 'error'); }
});

// ── Events ─────────────────────────────────────────────
async function loadOrgSelect() {
  const sel = document.getElementById('event-org');
  try {
    const orgs = await API.getOrganisations();
    sel.innerHTML = orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  } catch (e) {}
}

async function loadEventsList() {
  const list = document.getElementById('events-list');
  try {
    const events = await API.getEvents();
    list.innerHTML = events.length ? events.map(e => `
      <div class="list-card">
        <div class="list-card-main">
          <strong>${e.name}</strong>
          <span class="muted">${e.org_name} &middot; ${new Date(e.event_date).toLocaleDateString('en-GB')}</span>
        </div>
        <div class="list-card-meta">
          <span class="badge ${e.is_active ? 'badge-green' : 'badge-grey'}">${e.is_active ? 'Active' : 'Inactive'}</span>
          <span class="badge badge-blue">${e.total_tickets || 0} tickets</span>
          <button class="btn btn-sm btn-danger" onclick="deleteEvent(${e.id}, '${e.name.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>`).join('')
      : '<div class="empty-card"><p class="muted">No events yet.</p></div>';
  } catch (e) {
    list.innerHTML = `<div class="empty-card"><p class="error">${e.message}</p></div>`;
  }
}

async function deleteEvent(id, name) {
  if (!confirmAction(`Delete "${name}"? This will delete all tickets and attendees for this event.`)) return;
  try {
    await API.deleteEvent(id);
    showToast('Event deleted', 'success');
    loadEventsList();
  } catch (e) { showToast(e.message, 'error'); }
}
window.deleteEvent = deleteEvent;

document.getElementById('show-add-event').addEventListener('click', () => {
  document.getElementById('event-form-container').classList.remove('hidden');
});
document.getElementById('cancel-event').addEventListener('click', () => {
  document.getElementById('event-form-container').classList.add('hidden');
});
document.getElementById('event-name').addEventListener('input', e => {
  document.getElementById('event-slug').value = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
});
document.getElementById('pick-event-logo').addEventListener('click', async () => {
  const data = await window.electronAPI.openImage();
  if (!data) return;
  document.getElementById('event-logo-data').value = data;
  document.getElementById('event-logo-name').textContent = 'Image selected';
  const p = document.getElementById('event-logo-preview');
  p.src = data; p.classList.remove('hidden');
});
document.getElementById('save-event').addEventListener('click', async () => {
  const name = document.getElementById('event-name').value.trim();
  const slug = document.getElementById('event-slug').value.trim();
  const date = document.getElementById('event-date').value;
  if (!name || !slug || !date) return showToast('Name, slug and date required', 'error');
  try {
    await API.createEvent({
      organisation_id: document.getElementById('event-org').value,
      name, slug,
      event_date: date,
      event_time: document.getElementById('event-time').value || null,
      venue: document.getElementById('event-venue').value || null,
      logo_url: document.getElementById('event-logo-data').value || null,
      primary_color: document.getElementById('event-primary').value,
      accent_color: document.getElementById('event-accent').value,
      secondary_color: document.getElementById('event-secondary').value
    });
    showToast('Event created', 'success');
    document.getElementById('event-form-container').classList.add('hidden');
    document.getElementById('event-name').value = '';
    document.getElementById('event-slug').value = '';
    loadEventsList();
  } catch (e) { showToast(e.message, 'error'); }
});

// ── Import CSV ─────────────────────────────────────────
let parsedAttendees = [];

async function loadEventSelects() {
  try {
    const events = await API.getEvents();
    ['import-event', 'gen-event'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.innerHTML = events.map(e =>
        `<option value="${e.id}" data-event='${JSON.stringify(e)}'>${e.name} — ${e.org_name} (${new Date(e.event_date).toLocaleDateString('en-GB')})</option>`
      ).join('');
    });
    updateGenInfo();
  } catch (e) {}
}

document.getElementById('pick-csv').addEventListener('click', async () => {
  const csvText = await window.electronAPI.openCsv();
  if (!csvText) return;
  document.getElementById('csv-file-name').textContent = 'File loaded';

  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  parsedAttendees = lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => row[h] = (vals[i] || '').replace(/^["']|["']$/g, '').trim());
      return {
        name: findCol(row, 'name'),
        email: findCol(row, 'email'),
        mobile: findCol(row, 'mobile', 'phone', 'tel'),
        company: findCol(row, 'company', 'organisation', 'organization'),
        tickets: Math.max(1, parseInt(findCol(row, 'ticket', 'qty', 'quantity', 'no of', 'number of') || '1') || 1)
      };
    })
    .filter(a => a.name && a.name.trim().length > 0 && !/^(name|full name)$/i.test(a.name.trim()));

  const totalTickets = parsedAttendees.reduce((s, a) => s + a.tickets, 0);
  document.getElementById('csv-count').textContent = parsedAttendees.length;
  document.getElementById('ticket-count').textContent = totalTickets;

  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = parsedAttendees.map(a => `
    <tr>
      <td>${a.name}</td><td>${a.email}</td><td>${a.mobile}</td>
      <td>${a.company}</td><td><strong>${a.tickets}</strong></td>
    </tr>`).join('');

  document.getElementById('csv-preview').classList.remove('hidden');
  document.getElementById('import-btn').disabled = false;
});

document.getElementById('import-btn').addEventListener('click', async () => {
  const eventId = document.getElementById('import-event').value;
  const btn = document.getElementById('import-btn');
  const result = document.getElementById('import-result');
  btn.disabled = true; btn.textContent = 'Importing…';
  try {
    const res = await API.importAttendees(eventId, parsedAttendees);
    result.className = 'info-box info-success'; result.classList.remove('hidden');
    result.textContent = `✓ Imported ${parsedAttendees.length} attendees — ${res.ticketsCreated} unique tickets created.`;
    showToast(`${res.ticketsCreated} tickets created`, 'success');
    document.getElementById('csv-preview').classList.add('hidden');
    parsedAttendees = [];
  } catch (e) {
    result.className = 'info-box info-error'; result.classList.remove('hidden');
    result.textContent = `✗ ${e.message}`;
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Import to Database';
  }
});

// ── Generate Tickets ───────────────────────────────────
async function updateGenInfo() {
  const sel = document.getElementById('gen-event');
  const btn = document.getElementById('gen-btn');
  const info = document.getElementById('gen-ticket-info');
  if (!sel || !sel.value) return;
  try {
    const stats = await API.getStats(sel.value);
    info.className = 'info-box'; info.classList.remove('hidden');
    info.textContent = `${stats.total} tickets in database (${stats.scanned || 0} already scanned)`;
    btn.disabled = !stats.total;
  } catch (e) {
    info.className = 'info-box info-error'; info.classList.remove('hidden');
    info.textContent = e.message; btn.disabled = true;
  }
}

document.getElementById('gen-event').addEventListener('change', updateGenInfo);

document.getElementById('gen-btn').addEventListener('click', async () => {
  const sel = document.getElementById('gen-event');
  const btn = document.getElementById('gen-btn');
  const result = document.getElementById('gen-result');
  const opt = sel.options[sel.selectedIndex];
  const evt = JSON.parse(opt.dataset.event);
  evt.baseUrl = API.getConfig().url;
  btn.disabled = true; btn.textContent = 'Generating PDFs…';
  result.classList.add('hidden');
  try {
    const tickets = await API.getTickets(sel.value);
    const res = await window.electronAPI.generateTickets({
      tickets: tickets.map(t => ({ ticketNumber: t.ticket_number, name: t.name, company: t.company })),
      event: evt
    });
    result.className = 'info-box info-success'; result.classList.remove('hidden');
    result.textContent = `✓ ${res.count} PDF tickets generated — ZIP saved to Downloads.`;
    showToast(`${res.count} tickets generated`, 'success');
  } catch (e) {
    result.className = 'info-box info-error'; result.classList.remove('hidden');
    result.textContent = `✗ ${e.message}`;
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate & Download PDF Tickets';
  }
});

// ── Admin Users ────────────────────────────────────────
async function loadUserOrgSelect() {
  const sel = document.getElementById('user-org');
  try {
    const orgs = await API.getOrganisations();
    sel.innerHTML = '<option value="">Super Admin — sees all events</option>' +
      orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  } catch (e) {}
}

async function loadUsersList() {
  const list = document.getElementById('users-list');
  try {
    const users = await API.getAdminUsers();
    list.innerHTML = users.length ? users.map(u => `
      <div class="list-card">
        <div class="list-card-main">
          <strong>${u.username}</strong>
          <span class="muted">${u.org_name ? u.org_name : 'Super Admin'}</span>
        </div>
        <div class="list-card-meta">
          <span class="badge ${u.organisation_id ? 'badge-blue' : 'badge-purple'}">${u.organisation_id ? 'Org Admin' : 'Super Admin'}</span>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.username.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>`).join('')
      : '<div class="empty-card"><p class="muted">No admin users yet.</p></div>';
  } catch (e) {
    list.innerHTML = `<div class="empty-card"><p class="error">${e.message}</p></div>`;
  }
}

async function deleteUser(id, username) {
  if (!confirmAction(`Delete user "${username}"?`)) return;
  try {
    await API.deleteAdminUser(id);
    showToast('User deleted', 'success');
    loadUsersList();
  } catch (e) { showToast(e.message, 'error'); }
}
window.deleteUser = deleteUser;

document.getElementById('show-add-user').addEventListener('click', () => {
  document.getElementById('user-form-container').classList.remove('hidden');
});
document.getElementById('cancel-user').addEventListener('click', () => {
  document.getElementById('user-form-container').classList.add('hidden');
});
document.getElementById('save-user').addEventListener('click', async () => {
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const org = document.getElementById('user-org').value;
  if (!username || !password) return showToast('Username and password required', 'error');
  if (password.length < 8) return showToast('Password must be at least 8 characters', 'error');
  try {
    await API.createAdminUser({ username, password, organisation_id: org || null });
    showToast('Admin user created', 'success');
    document.getElementById('user-form-container').classList.add('hidden');
    document.getElementById('user-username').value = '';
    document.getElementById('user-password').value = '';
    loadUsersList();
  } catch (e) { showToast(e.message, 'error'); }
});

// Init
showView('dashboard');
