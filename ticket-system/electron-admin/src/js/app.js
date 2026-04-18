// Navigation
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
  if (viewId === 'settings') loadSettings();
}

navItems.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  setTimeout(() => t.classList.add('hidden'), 3500);
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
  el.className = 'info-box'; el.textContent = 'Testing…'; el.classList.remove('hidden');
  try {
    const ok = await API.testConnection();
    el.className = ok ? 'info-box info-success' : 'info-box info-error';
    el.textContent = ok ? '✓ Connected successfully' : '✗ Connection failed';
  } catch (e) {
    el.className = 'info-box info-error';
    el.textContent = `✗ ${e.message}`;
  }
});

// ── Dashboard ──────────────────────────────────────────
async function loadDashboard() {
  try {
    const events = await API.getEvents();
    document.getElementById('stat-events').textContent = events.length;
    document.getElementById('stat-tickets').textContent = events.reduce((s, e) => s + (e.total_tickets || 0), 0);
    document.getElementById('stat-scanned').textContent = events.reduce((s, e) => s + (e.scanned_tickets || 0), 0);
    const list = document.getElementById('dashboard-events-list');
    list.innerHTML = events.slice(0, 5).map(e => `
      <div class="list-card">
        <div class="list-card-main">
          <strong>${e.name}</strong>
          <span class="muted">${e.org_name} · ${new Date(e.event_date).toLocaleDateString('en-GB')}</span>
        </div>
        <div class="list-card-meta">
          <span class="badge">${e.scanned_tickets || 0} / ${e.total_tickets || 0} scanned</span>
          <a href="${API.getConfig().url}/events/${e.slug}/scan" target="_blank" class="link">Scanner ↗</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('dashboard-events-list').innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ── Organisations ──────────────────────────────────────
async function loadOrgsList() {
  const list = document.getElementById('orgs-list');
  try {
    const orgs = await API.getOrganisations();
    list.innerHTML = orgs.length
      ? orgs.map(o => `
        <div class="list-card">
          <div class="list-card-main">
            <strong>${o.name}</strong>
            <span class="muted">/${o.slug}</span>
          </div>
          <div class="color-dots">
            <span class="dot" style="background:${o.primary_color}" title="Primary"></span>
            <span class="dot" style="background:${o.accent_color}" title="Accent"></span>
          </div>
        </div>`).join('')
      : '<p class="muted">No organisations yet.</p>';
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

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
  const preview = document.getElementById('org-logo-preview');
  preview.src = data; preview.classList.remove('hidden');
});

document.getElementById('save-org').addEventListener('click', async () => {
  const name = document.getElementById('org-name').value.trim();
  const slug = document.getElementById('org-slug').value.trim();
  if (!name || !slug) return showToast('Name and slug are required', 'error');
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
    loadOrgsList();
  } catch (e) {
    showToast(e.message, 'error');
  }
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
    list.innerHTML = events.length
      ? events.map(e => `
        <div class="list-card">
          <div class="list-card-main">
            <strong>${e.name}</strong>
            <span class="muted">${e.org_name} · ${new Date(e.event_date).toLocaleDateString('en-GB')}</span>
          </div>
          <div class="list-card-meta">
            <span class="badge">${e.total_tickets || 0} tickets</span>
            <span class="badge ${e.is_active ? 'badge-green' : 'badge-grey'}">${e.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>`).join('')
      : '<p class="muted">No events yet.</p>';
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

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
  const preview = document.getElementById('event-logo-preview');
  preview.src = data; preview.classList.remove('hidden');
});

document.getElementById('save-event').addEventListener('click', async () => {
  const name = document.getElementById('event-name').value.trim();
  const slug = document.getElementById('event-slug').value.trim();
  const date = document.getElementById('event-date').value;
  if (!name || !slug || !date) return showToast('Name, slug and date are required', 'error');
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
    loadEventsList();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ── Import CSV ─────────────────────────────────────────
let parsedAttendees = [];

async function loadEventSelects() {
  try {
    const events = await API.getEvents();
    ['import-event', 'gen-event'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.innerHTML = events.map(e => `<option value="${e.id}" data-event='${JSON.stringify(e)}'>${e.name} (${new Date(e.event_date).toLocaleDateString('en-GB')})</option>`).join('');
    });
    updateGenInfo();
  } catch (e) {}
}

document.getElementById('pick-csv').addEventListener('click', async () => {
  const csvText = await window.electronAPI.openCsv();
  if (!csvText) return;
  document.getElementById('csv-file-name').textContent = 'File loaded';

  const lines = csvText.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  parsedAttendees = lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] || '');
    return {
      name: row.name || row['full name'] || '',
      email: row.email || row['e-mail'] || '',
      mobile: row.mobile || row.phone || row.telephone || '',
      company: row.company || row.organisation || row.club || '',
      tickets: parseInt(row.tickets || row['no. tickets'] || row.qty || 1) || 1
    };
  }).filter(a => a.name);

  const totalTickets = parsedAttendees.reduce((s, a) => s + a.tickets, 0);
  document.getElementById('csv-count').textContent = parsedAttendees.length;
  document.getElementById('ticket-count').textContent = totalTickets;

  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = parsedAttendees.map(a => `
    <tr>
      <td>${a.name}</td><td>${a.email}</td><td>${a.mobile}</td>
      <td>${a.company}</td><td>${a.tickets}</td>
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
    result.textContent = `✓ Imported ${parsedAttendees.length} attendees and created ${res.ticketsCreated} unique tickets.`;
    showToast(`${res.ticketsCreated} tickets created`, 'success');
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
  if (!sel.value) return;
  try {
    const stats = await API.getStats(sel.value);
    info.className = 'info-box'; info.classList.remove('hidden');
    info.textContent = `${stats.total} tickets in database (${stats.scanned} already scanned)`;
    btn.disabled = stats.total === 0;
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
    const res = await window.electronAPI.generateTickets({ tickets: tickets.map(t => ({
      ticketNumber: t.ticket_number,
      name: t.name,
      company: t.company
    })), event: evt });
    result.className = 'info-box info-success'; result.classList.remove('hidden');
    result.textContent = `✓ Generated ${res.count} PDF tickets. ZIP saved to your Downloads folder.`;
    showToast(`${res.count} tickets generated`, 'success');
  } catch (e) {
    result.className = 'info-box info-error'; result.classList.remove('hidden');
    result.textContent = `✗ ${e.message}`;
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate & Download PDF Tickets';
  }
});

// Init
showView('dashboard');
