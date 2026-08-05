/*
 * app.js — renders the cards from schedule.js and works out where you are in
 * the day. You shouldn't need to touch this to change meals or times.
 */

const ACCENTS = {
  emerald: {
    dot: 'bg-emerald-500',
    header: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    title: 'text-emerald-950 dark:text-emerald-100',
    badge: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    tagline:
      'text-emerald-800 bg-white/80 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/30',
    feature: 'bg-emerald-50/60 dark:bg-emerald-500/10',
    ring: 'ring-emerald-400',
  },
  blue: {
    dot: 'bg-blue-500',
    header: 'bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20',
    title: 'text-blue-950 dark:text-blue-100',
    badge: 'bg-blue-200 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
    tagline:
      'text-blue-800 bg-white/80 border-blue-200 dark:text-blue-200 dark:bg-blue-950/40 dark:border-blue-500/30',
    feature: 'bg-blue-50/60 dark:bg-blue-500/10',
    ring: 'ring-blue-400',
  },
  amber: {
    dot: 'bg-amber-500',
    header: 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20',
    title: 'text-amber-950 dark:text-amber-100',
    badge: 'bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    tagline:
      'text-amber-800 bg-white/80 border-amber-200 dark:text-amber-200 dark:bg-amber-950/40 dark:border-amber-500/30',
    feature: 'bg-amber-50/60 dark:bg-amber-500/10',
    ring: 'ring-amber-400',
  },
  slate: {
    dot: 'bg-slate-400',
    header: 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700',
    title: 'text-slate-800 dark:text-slate-100',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    tagline:
      'text-slate-600 bg-white/80 border-slate-200 dark:text-slate-300 dark:bg-slate-900/60 dark:border-slate-700',
    feature: 'bg-slate-100/70 dark:bg-slate-800/50',
    ring: 'ring-slate-400',
  },
};

const TAG_STYLES = {
  Breakfast:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  'Mid-Morning':
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
  'Pre-Workout':
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
  Lunch:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  Dinner:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  'Dinner (Refuel)':
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  Workout: 'bg-blue-600 text-white border-blue-600',
  'Check-in': 'bg-amber-600 text-white border-amber-600',
  Flexible:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const TAG_FALLBACK =
  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

const SUMMARY_TONES = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300',
};

const LOCATIONS = {
  wfh: { icon: 'house', label: 'WFH' },
  office: { icon: 'building', label: 'Office' },
};

/* ---------- helpers ---------- */

// Icon names come from ICONS in icons.js.
function svgIcon(name, className) {
  const glyph = ICONS[name];
  if (!glyph) return '';
  return `<svg class="${className}" viewBox="${glyph.box}" fill="currentColor" aria-hidden="true"><path d="${glyph.path}"/></svg>`;
}

// "09:00 - 10:00" -> { start: 540, end: 600 }, both in minutes past midnight.
// Returns null for rows with no time.
function parseRange(time) {
  const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return null;
  const [, sh, sm, eh, em] = match.map(Number);
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// WEEK is Monday-first; Date#getDay is Sunday-first.
function todayIndex(now) {
  return (now.getDay() + 6) % 7;
}

function minutesNow(now) {
  return now.getHours() * 60 + now.getMinutes();
}

/* ---------- rendering ---------- */

function renderSummary() {
  document.getElementById('summary').innerHTML = SUMMARY.map(
    (card) => `
    <div class="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
      <div class="w-10 h-10 shrink-0 rounded-lg ${SUMMARY_TONES[card.tone] || SUMMARY_TONES.emerald} flex items-center justify-center">
        ${svgIcon(card.icon, 'w-5 h-5')}
      </div>
      <div class="min-w-0 break-words">
        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold leading-tight">${escapeHtml(card.label)}</p>
        <p class="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-100 leading-tight">${escapeHtml(card.value)}</p>
      </div>
    </div>`,
  ).join('');
}

function renderItem(item, accent, isNow) {
  const range = parseRange(item.time);

  // The live row keeps a smaller negative margin than a plain feature row so its
  // ring stays inside the card's rounded, overflow-hidden edge.
  let emphasis = '';
  if (isNow) {
    emphasis = `${accent.feature} ring-2 ring-emerald-400 -mx-3 px-3 rounded-lg`;
  } else if (item.feature) {
    emphasis = `${accent.feature} -mx-6 px-6 rounded-lg`;
  }

  const timeCell = item.time
    ? `<div class="text-xs font-mono font-bold px-2 py-1 rounded w-fit shrink-0 ${
        item.feature
          ? 'text-slate-700 bg-white/70 dark:text-slate-200 dark:bg-slate-800'
          : 'text-slate-400 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
      }">${escapeHtml(item.time)}</div>`
    : '<div class="text-xs font-mono font-bold text-slate-300 dark:text-slate-600 px-2 py-1 w-fit shrink-0">—</div>';

  const note = item.note
    ? ` <span class="text-xs text-slate-400 dark:text-slate-500">(${escapeHtml(item.note)})</span>`
    : '';

  const tagStyle = TAG_STYLES[item.tag] || TAG_FALLBACK;
  const tag = item.tag
    ? `<span class="text-xs ${tagStyle} border px-2.5 py-1 rounded-full font-medium w-fit shrink-0">${escapeHtml(item.tag)}</span>`
    : '';

  return `
    <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${emphasis}"
         ${range ? `data-start="${range.start}" data-end="${range.end}"` : ''}>
      ${timeCell}
      <div class="flex-1 sm:mx-4 text-slate-700 dark:text-slate-200 font-medium flex items-start gap-2">
        <span class="emoji text-xl leading-none shrink-0 w-14 text-right whitespace-nowrap">${escapeHtml(item.icon || '')}</span>
        <span>${escapeHtml(item.text)}${note}</span>
      </div>
      ${tag}
    </div>`;
}

function renderDay(entry, isToday, nowMinutes) {
  const accent = ACCENTS[entry.accent] || ACCENTS.slate;
  const location = LOCATIONS[entry.location];

  const locationBadge = location
    ? `<span class="text-xs ${accent.badge} font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5">
         ${svgIcon(location.icon, 'w-3 h-3')}${location.label}
       </span>`
    : '';

  const todayBadge = isToday
    ? `<span class="text-xs bg-emerald-600 text-white font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap">Today</span>`
    : '';

  const taglineIcon = entry.taglineIcon ? svgIcon(entry.taglineIcon, 'w-3.5 h-3.5') : '';

  const rows = entry.items
    .map((item) => {
      const range = parseRange(item.time);
      const live = Boolean(
        isToday && range && nowMinutes >= range.start && nowMinutes < range.end,
      );
      return renderItem(item, accent, live);
    })
    .join('');

  return `
    <section id="day-${escapeHtml(entry.day.toLowerCase())}"
             class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition hover:shadow-md scroll-mt-4 ${
               isToday ? `ring-2 ${accent.ring}` : ''
             }">
      <div class="${accent.header} px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div class="flex items-center flex-wrap gap-x-3 gap-y-2">
          <span class="w-3 h-3 rounded-full ${accent.dot}"></span>
          <h2 class="text-lg font-bold ${accent.title}">${escapeHtml(entry.day)}</h2>
          ${locationBadge}
          ${todayBadge}
        </div>
        <span class="text-sm font-semibold px-3 py-1 rounded-lg border inline-flex items-center gap-1.5 ${accent.tagline}">
          ${taglineIcon}${escapeHtml(entry.tagline)}
        </span>
      </div>
      <div class="p-6 divide-y divide-slate-100 dark:divide-slate-800">${rows}</div>
    </section>`;
}

/* ---------- "right now" banner ---------- */

function describeNow(now) {
  const entry = WEEK[todayIndex(now)];
  const minutes = minutesNow(now);
  const timed = entry.items
    .map((item) => ({ item, range: parseRange(item.time) }))
    .filter((row) => row.range)
    .sort((a, b) => a.range.start - b.range.start);

  const current = timed.find((row) => minutes >= row.range.start && minutes < row.range.end);
  if (current) {
    return { lead: 'Right now', body: current.item.text, icon: current.item.icon, time: current.item.time };
  }

  const next = timed.find((row) => minutes < row.range.start);
  if (next) {
    return { lead: 'Next up', body: next.item.text, icon: next.item.icon, time: next.item.time };
  }

  if (!timed.length) {
    return { lead: entry.day, body: 'Nothing scheduled', icon: '🗓️', time: '' };
  }
  return { lead: 'Done for today', body: 'Plan resumes tomorrow', icon: '✅', time: '' };
}

function renderNow(now) {
  const status = describeNow(now);
  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('now').innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
      <span class="emoji text-2xl leading-none shrink-0">${escapeHtml(status.icon || '⏱️')}</span>
      <div class="min-w-0 flex-1">
        <p class="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(status.lead)}</p>
        <p class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(status.body)}</p>
      </div>
      <span class="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">${escapeHtml(status.time || clock)}</span>
    </div>`;
}

/* ---------- boot ---------- */

/* ---------- day picker ---------- */

const ALL_DAYS = 'all';

// Which day the cards are showing. Left null until the user picks one, so the
// view keeps following the real day — including across midnight with the page
// still open.
let chosenDay = null;

function visibleDay(now) {
  return chosenDay === null ? todayIndex(now) : chosenDay;
}

// Which day the options are currently labelled against, so the "— today" marker
// can be rebuilt when the date rolls over rather than going stale.
let pickerToday = null;

function syncDayPicker(now) {
  const select = document.getElementById('day-select');
  const today = todayIndex(now);

  if (pickerToday !== today) {
    const options = WEEK.map(
      (entry, index) =>
        `<option value="${index}">${escapeHtml(entry.day)}${index === today ? ' — today' : ''}</option>`,
    );
    options.push(`<option value="${ALL_DAYS}">Whole week</option>`);
    select.innerHTML = options.join('');
    pickerToday = today;
  }

  select.value = String(visibleDay(now));
}

function initDayPicker() {
  document.getElementById('day-select').addEventListener('change', (event) => {
    chosenDay = event.target.value === ALL_DAYS ? ALL_DAYS : Number(event.target.value);
    render();
    document.getElementById('week').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

// Fills the [data-icon] placeholders in index.html's header.
function hydrateStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((slot) => {
    slot.innerHTML = svgIcon(slot.dataset.icon, 'w-full h-full');
  });
}

function render() {
  const now = new Date();
  const today = todayIndex(now);
  const minutes = minutesNow(now);
  const showing = visibleDay(now);

  renderSummary();
  renderNow(now);
  syncDayPicker(now);

  document.getElementById('week').innerHTML = WEEK.map((entry, index) => ({ entry, index }))
    .filter(({ index }) => showing === ALL_DAYS || index === showing)
    .map(({ entry, index }) => renderDay(entry, index === today, minutes))
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateStaticIcons();
  initDayPicker();
  render();

  // Keep the banner, the highlighting and the selected day honest as time passes.
  setInterval(render, 60 * 1000);
});
