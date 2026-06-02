(function () {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────────────────────
  var state = {
    tz: 'Europe/Dublin',
    tab: 'groups',
    statusFilter: 'all',
    groupFilter: 'all',
    standings: {},
    lastUpdated: null,
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    populateCountrySelector();
    bindTabButtons();
    bindScheduleFilters();
    fetchResults().then(function () {
      computeAllStandings();
      renderCurrentTab();
      setInterval(function () { fetchResults().then(function () { computeAllStandings(); renderCurrentTab(); }); }, 60000);
    });
  });

  // ── COUNTRY SELECTOR ──────────────────────────────────────────────────────
  function populateCountrySelector() {
    var sel = document.getElementById('countrySelect');
    WC.TIMEZONES.forEach(function (tz) {
      var opt = document.createElement('option');
      opt.value = tz.tz;
      opt.textContent = tz.flag + ' ' + tz.name;
      if (tz.default) { opt.selected = true; state.tz = tz.tz; }
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      state.tz = sel.value;
      var chosen = WC.TIMEZONES.find(function (t) { return t.tz === sel.value; });
      document.getElementById('tzFlag').textContent = chosen ? chosen.flag : '';
      renderCurrentTab();
    });
  }

  // ── RESULTS FETCH ─────────────────────────────────────────────────────────
  function fetchResults() {
    return fetch('data/results.json?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.matches) return;
        state.lastUpdated = data.lastUpdated || null;
        var el = document.getElementById('lastUpdated');
        if (el && state.lastUpdated) {
          var d = new Date(state.lastUpdated);
          el.textContent = 'Data last updated: ' + formatDateTimeDisplay(d);
        }
        var matches = data.matches;
        WC.GROUP_MATCHES.forEach(function (m) {
          if (matches[m.id]) {
            var r = matches[m.id];
            m.score1  = r.score1  !== undefined ? r.score1  : m.score1;
            m.score2  = r.score2  !== undefined ? r.score2  : m.score2;
            m.status  = r.status  || m.status;
          }
        });
        var allKo = getKnockoutArray();
        allKo.forEach(function (m) {
          if (matches[m.id]) {
            var r = matches[m.id];
            m.score1  = r.score1  !== undefined ? r.score1  : m.score1;
            m.score2  = r.score2  !== undefined ? r.score2  : m.score2;
            m.status  = r.status  || m.status;
            m.winner  = r.winner  || m.winner;
          }
        });
      })
      .catch(function () {});
  }

  function getKnockoutArray() {
    return [].concat(
      WC.KNOCKOUT.r32,
      WC.KNOCKOUT.r16,
      WC.KNOCKOUT.qf,
      WC.KNOCKOUT.sf,
      [WC.KNOCKOUT.thirdPlace, WC.KNOCKOUT.final]
    );
  }

  // ── STANDINGS ─────────────────────────────────────────────────────────────
  function computeAllStandings() {
    Object.keys(WC.GROUPS).forEach(function (g) {
      state.standings[g] = computeStandings(g);
    });
  }

  function computeStandings(groupLetter) {
    var teams = WC.GROUPS[groupLetter].teams;
    var table = {};
    teams.forEach(function (t) {
      table[t.code] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    var groupMatches = WC.GROUP_MATCHES.filter(function (m) { return m.group === groupLetter; });
    var playedCount = 0;
    groupMatches.forEach(function (m) {
      if (m.score1 === null || m.score2 === null) return;
      playedCount++;
      var r1 = table[m.team1.code], r2 = table[m.team2.code];
      r1.p++; r2.p++;
      r1.gf += m.score1; r1.ga += m.score2; r1.gd = r1.gf - r1.ga;
      r2.gf += m.score2; r2.ga += m.score1; r2.gd = r2.gf - r2.ga;
      if (m.score1 > m.score2)      { r1.w++; r1.pts += 3; r2.l++; }
      else if (m.score1 < m.score2) { r2.w++; r2.pts += 3; r1.l++; }
      else                           { r1.d++; r1.pts++; r2.d++; r2.pts++; }
    });
    var rows = Object.values(table);
    rows.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd  !== a.gd)  return b.gd  - a.gd;
      if (b.gf  !== a.gf)  return b.gf  - a.gf;
      return a.team.name.localeCompare(b.team.name);
    });
    var complete = playedCount === 6;
    return { rows: rows, complete: complete, playedCount: playedCount };
  }

  // ── TIME FORMATTING ───────────────────────────────────────────────────────
  function formatMatchTime(dateStr, utcTime, tz, isEst) {
    try {
      var iso = dateStr + 'T' + utcTime + ':00Z';
      var d = new Date(iso);
      var opts = { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
      var fmt = new Intl.DateTimeFormat('en-IE', opts).format(d);
      if (isEst) return '~' + fmt;
      return fmt;
    } catch (e) {
      return dateStr + ' ' + utcTime + ' UTC' + (isEst ? ' (est)' : '');
    }
  }

  function formatDateTimeDisplay(d) {
    try {
      return new Intl.DateTimeFormat('en-IE', { timeZone: state.tz, dateStyle: 'medium', timeStyle: 'short' }).format(d);
    } catch (e) { return d.toISOString(); }
  }

  function getMatchDateInTz(dateStr, utcTime, tz) {
    try {
      var iso = dateStr + 'T' + utcTime + ':00Z';
      var d = new Date(iso);
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      var y = '', mo = '', dy = '';
      parts.forEach(function (p) { if (p.type === 'year') y = p.value; if (p.type === 'month') mo = p.value; if (p.type === 'day') dy = p.value; });
      return y + '-' + mo + '-' + dy;
    } catch (e) { return dateStr; }
  }

  function todayInTz(tz) {
    try {
      var d = new Date();
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      var y = '', mo = '', dy = '';
      parts.forEach(function (p) { if (p.type === 'year') y = p.value; if (p.type === 'month') mo = p.value; if (p.type === 'day') dy = p.value; });
      return y + '-' + mo + '-' + dy;
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  // ── TAB ROUTING ───────────────────────────────────────────────────────────
  function bindTabButtons() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.toggle('active', p.id === 'tab-' + state.tab);
        });
        renderCurrentTab();
      });
    });
  }

  function renderCurrentTab() {
    if (state.tab === 'groups')   renderGroups();
    if (state.tab === 'bracket')  renderBracket();
    if (state.tab === 'schedule') renderSchedule();
  }

  // ── GROUPS TAB ────────────────────────────────────────────────────────────
  function renderGroups() {
    var grid = document.getElementById('groupsGrid');
    grid.innerHTML = '';
    Object.keys(WC.GROUPS).forEach(function (g) {
      grid.appendChild(buildGroupCard(g));
    });
  }

  function buildGroupCard(g) {
    var standing = state.standings[g] || { rows: [], complete: false, playedCount: 0 };
    var card = el('div', 'group-card');

    // Header
    var hdr = el('div', 'group-card-header');
    var lbl = el('div', 'group-letter');
    lbl.textContent = 'Group ' + g;
    var badge = el('div', 'group-status-badge');
    if (standing.complete) { badge.textContent = 'Complete'; badge.classList.add('complete'); }
    else if (standing.playedCount > 0) { badge.textContent = 'Ongoing'; badge.classList.add('ongoing'); }
    else { badge.textContent = 'Upcoming'; badge.classList.add('upcoming'); }
    hdr.appendChild(lbl); hdr.appendChild(badge);
    card.appendChild(hdr);

    // Standings table
    var tbl = el('table', 'standings-table');
    var thead = el('thead');
    var hr = el('tr');
    ['Team','P','W','D','L','GF','GA','GD','Pts'].forEach(function (h) {
      var th = el('th'); th.textContent = h; hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);

    var tbody = el('tbody');
    var rows = standing.rows.length ? standing.rows : WC.GROUPS[g].teams.map(function (t) {
      return { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    rows.forEach(function (row, i) {
      var tr = el('tr', 'standings-row');
      if (i < 2) tr.classList.add('qualifying');
      if (i < 2 && standing.complete) tr.classList.add('qualified');

      var tdTeam = el('td');
      var teamCell = el('div', 'team-cell');
      var flagEl = el('span', 'flag'); flagEl.textContent = row.team.flag;
      var nameEl = el('span', 'tname'); nameEl.textContent = row.team.name;
      teamCell.appendChild(flagEl); teamCell.appendChild(nameEl);
      tdTeam.appendChild(teamCell);
      tr.appendChild(tdTeam);

      [row.p, row.w, row.d, row.l, row.gf, row.ga, gd(row), row.pts].forEach(function (v, vi) {
        var td = el('td');
        td.textContent = v;
        if (vi === 7) td.className = 'pts-cell';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    card.appendChild(tbl);

    // Matches
    var matchSec = el('div', 'group-matches');
    var groupMatches = WC.GROUP_MATCHES.filter(function (m) { return m.group === g; });
    [1, 2, 3].forEach(function (md) {
      var mdMatches = groupMatches.filter(function (m) { return m.md === md; });
      if (!mdMatches.length) return;
      var sec = el('div', 'matchday-section');
      var lbl = el('div', 'matchday-label'); lbl.textContent = 'Matchday ' + md;
      sec.appendChild(lbl);
      mdMatches.forEach(function (m) { sec.appendChild(buildMatchRow(m)); });
      matchSec.appendChild(sec);
    });
    card.appendChild(matchSec);
    return card;
  }

  function buildMatchRow(m) {
    var row = el('div', 'match-row');

    var teamsWrap = el('div', 'match-row-teams');
    var t1 = el('div', 'match-team');
    var f1 = el('span', 'flag'); f1.textContent = m.team1.flag;
    var n1 = el('span', 'tname'); n1.textContent = m.team1.name;
    t1.appendChild(f1); t1.appendChild(n1);

    var scoreWrap = el('div', 'match-score');
    if (m.score1 !== null && m.score2 !== null) {
      var s1 = el('span', 'score-num'); s1.textContent = m.score1;
      var sep = el('span', 'score-sep'); sep.textContent = '-';
      var s2 = el('span', 'score-num'); s2.textContent = m.score2;
      scoreWrap.appendChild(s1); scoreWrap.appendChild(sep); scoreWrap.appendChild(s2);
      if (m.score1 > m.score2) t1.style.fontWeight = '700';
    } else {
      var dash = el('span', 'score-dash'); dash.textContent = 'vs';
      scoreWrap.appendChild(dash);
    }

    var t2 = el('div', 'match-team right');
    var f2 = el('span', 'flag'); f2.textContent = m.team2.flag;
    var n2 = el('span', 'tname'); n2.textContent = m.team2.name;
    t2.appendChild(n2); t2.appendChild(f2);
    if (m.score1 !== null && m.score2 !== null && m.score2 > m.score1) t2.style.fontWeight = '700';

    teamsWrap.appendChild(t1); teamsWrap.appendChild(scoreWrap); teamsWrap.appendChild(t2);

    var meta = el('div', 'match-meta');
    var timeEl = el('div', 'match-time' + (m.est ? ' est' : ''));
    timeEl.textContent = formatMatchTime(m.date, m.utc, state.tz, m.est);
    var venueEl = el('div', 'match-venue-sm');
    venueEl.textContent = m.venue !== 'TBD' ? m.venue : m.city !== 'TBD' ? m.city : '';
    meta.appendChild(timeEl); meta.appendChild(venueEl);

    row.appendChild(teamsWrap); row.appendChild(meta);
    return row;
  }

  function gd(row) {
    if (row.gd > 0) return '+' + row.gd;
    return row.gd;
  }

  // ── BRACKET TAB ───────────────────────────────────────────────────────────
  function renderBracket() {
    var root = document.getElementById('bracketRoot');
    root.innerHTML = '';

    var koMap = {};
    getKnockoutArray().forEach(function (m) { koMap[m.id] = m; });

    // Left half: R32→R16→QF→SF
    // Column order: R32, R16, QF, SF
    // Match order top-to-bottom:
    // R32 left: M74,M77 | M73,M75 | M83,M84 | M81,M82
    // R16 left: M89,M90 | M93,M94
    // QF left:  M97, M98
    // SF left:  M101

    var leftR32  = [['M74','M77'],['M73','M75'],['M83','M84'],['M81','M82']];
    var leftR16  = [['M89','M90'],['M93','M94']];
    var leftQF   = [['M97','M98']];
    var leftSF   = [['M101']];

    var rightSF  = [['M102']];
    var rightQF  = [['M99','M100']];
    var rightR16 = [['M91','M92'],['M95','M96']];
    var rightR32 = [['M76','M78'],['M79','M80'],['M86','M88'],['M85','M87']];

    var leftHalf  = el('div', 'bracket-half left');
    var rightHalf = el('div', 'bracket-half right');
    var center    = el('div', 'bracket-center');

    leftHalf.appendChild(buildBracketRound('Round of 32', leftR32,  koMap, 'left',  4));
    leftHalf.appendChild(buildBracketRound('Round of 16', leftR16,  koMap, 'left',  2));
    leftHalf.appendChild(buildBracketRound('Quarter-finals', leftQF, koMap, 'left', 1));
    leftHalf.appendChild(buildBracketRound('Semi-finals',  leftSF,  koMap, 'left',  1));

    // Center: Final + Third Place
    var centerTop = el('div', 'center-label'); centerTop.textContent = 'Final';
    var finalCard = buildMatchCard(koMap['M104'], 'final');
    finalCard.classList.add('final-card');
    var divider = el('div', 'center-divider');
    var thirdLbl = el('div', 'center-label'); thirdLbl.textContent = '3rd Place';
    var thirdCard = buildMatchCard(koMap['M103'], '3rd');
    thirdCard.classList.add('third-card');

    center.appendChild(centerTop);
    center.appendChild(finalCard);
    center.appendChild(divider);
    center.appendChild(thirdLbl);
    center.appendChild(thirdCard);

    rightHalf.appendChild(buildBracketRound('Round of 32',    rightR32, koMap, 'right', 4));
    rightHalf.appendChild(buildBracketRound('Round of 16',   rightR16, koMap, 'right', 2));
    rightHalf.appendChild(buildBracketRound('Quarter-finals', rightQF,  koMap, 'right', 1));
    rightHalf.appendChild(buildBracketRound('Semi-finals',   rightSF,  koMap, 'right', 1));

    root.appendChild(leftHalf);
    root.appendChild(center);
    root.appendChild(rightHalf);
  }

  function buildBracketRound(label, matchupGroups, koMap, side, numMatchups) {
    var roundEl = el('div', 'bracket-round');
    if (label === 'Semi-finals') roundEl.classList.add('no-connector');
    var hdr = el('div', 'round-header'); hdr.textContent = label;
    roundEl.appendChild(hdr);

    var matchesWrap = el('div', 'round-matches');
    matchupGroups.forEach(function (pair) {
      var matchup = el('div', 'matchup');
      if (pair.length === 1) matchup.classList.add('single');
      pair.forEach(function (id) {
        var m = koMap[id];
        if (m) {
          var wrap = el('div', 'card-wrap');
          wrap.appendChild(buildMatchCard(m, 'ko'));
          matchup.appendChild(wrap);
        }
      });
      matchesWrap.appendChild(matchup);
    });
    roundEl.appendChild(matchesWrap);
    return roundEl;
  }

  function buildMatchCard(m, type) {
    var card = el('div', 'match-card');
    var status = m.status || (m.score1 !== null && m.score2 !== null ? 'finished' : 'upcoming');
    card.classList.add('card-' + status);

    var t1info = resolveKoTeam(m.team1, m.team1Label);
    var t2info = resolveKoTeam(m.team2, m.team2Label);

    var t1win = m.score1 !== null && m.score2 !== null && m.score1 > m.score2;
    var t2win = m.score1 !== null && m.score2 !== null && m.score2 > m.score1;
    if (m.winner) {
      t1win = (m.winner === (t1info && t1info.code));
      t2win = (m.winner === (t2info && t2info.code));
    }

    card.appendChild(buildCardTeamRow(t1info, m.team1Label, m.score1, t1win));
    card.appendChild(buildCardTeamRow(t2info, m.team2Label, m.score2, t2win));

    var footer = el('div', 'match-card-footer');
    var noEl = el('span', 'match-card-no'); noEl.textContent = 'M' + m.no;
    var timeEl = el('span', 'match-card-time' + (m.est ? ' est' : ''));
    timeEl.textContent = formatMatchTime(m.date, m.utc, state.tz, m.est);
    var venueEl = el('span', 'match-card-venue-sm');
    venueEl.textContent = m.city !== 'TBD' ? m.city : '';
    footer.appendChild(noEl);
    if (status === 'live') { var dot = el('span', 'card-live-dot'); footer.appendChild(dot); }
    footer.appendChild(timeEl); footer.appendChild(venueEl);
    card.appendChild(footer);
    return card;
  }

  function buildCardTeamRow(teamInfo, label, score, isWinner) {
    var row = el('div', 'match-card-team');
    if (isWinner) row.classList.add('winner');

    var flagEl = el('span', 'flag');
    flagEl.textContent = teamInfo ? teamInfo.flag : '';

    var nameEl = el('span', 'cname');
    if (teamInfo) { nameEl.textContent = teamInfo.name; nameEl.classList.add('known'); }
    else { nameEl.textContent = formatLabel(label); }

    var scoreEl = el('span', 'cscore');
    scoreEl.textContent = score !== null ? score : '';

    row.appendChild(flagEl);
    row.appendChild(nameEl);
    row.appendChild(scoreEl);
    return row;
  }

  function formatLabel(label) {
    if (!label) return '?';
    // "1A" → "1st Group A", "2B" → "2nd Group B"
    var posMatch = label.match(/^([12])([A-L])$/);
    if (posMatch) return (posMatch[1] === '1' ? '1st' : '2nd') + ' Group ' + posMatch[2];
    // "W-74" → "Win M74", "L-101" → "Los M101"
    var winMatch = label.match(/^W-(\d+)$/);
    if (winMatch) return 'Win M' + winMatch[1];
    var lossMatch = label.match(/^L-(\d+)$/);
    if (lossMatch) return 'Loss M' + lossMatch[1];
    if (label === 'best 3rd') return 'Best 3rd';
    return label;
  }

  function resolveKoTeam(teamObj, label) {
    if (teamObj && teamObj.code) return teamObj;
    if (!label) return null;
    var posMatch = label.match(/^([12])([A-L])$/);
    if (posMatch) {
      var pos = parseInt(posMatch[1], 10);
      var grp = posMatch[2];
      var st = state.standings[grp];
      if (st && st.complete && st.rows.length >= pos) return st.rows[pos - 1].team;
    }
    return null;
  }

  // ── SCHEDULE TAB ──────────────────────────────────────────────────────────
  function bindScheduleFilters() {
    document.querySelectorAll('.filter-btn[data-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.statusFilter = btn.dataset.status;
        document.querySelectorAll('.filter-btn[data-status]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderSchedule();
      });
    });
    var gSel = document.getElementById('groupFilterSelect');
    if (gSel) {
      gSel.addEventListener('change', function () {
        state.groupFilter = gSel.value;
        renderSchedule();
      });
    }
  }

  function renderSchedule() {
    var body = document.getElementById('scheduleBody');
    body.innerHTML = '';

    var allMatches = buildAllMatchesForSchedule();
    var today = todayInTz(state.tz);

    // Apply filters
    allMatches = allMatches.filter(function (m) {
      if (state.groupFilter !== 'all') {
        if (state.groupFilter === 'ko') { if (m.group) return false; }
        else { if (m.group !== state.groupFilter) return false; }
      }
      if (state.statusFilter === 'upcoming') {
        var mDate = getMatchDateInTz(m.date, m.utc, state.tz);
        return mDate >= today && (m.score1 === null || m.score2 === null);
      }
      if (state.statusFilter === 'today') {
        var mDate2 = getMatchDateInTz(m.date, m.utc, state.tz);
        return mDate2 === today;
      }
      return true;
    });

    if (!allMatches.length) {
      var none = el('div', 'no-matches');
      none.textContent = 'No matches match the selected filters.';
      body.appendChild(none);
      return;
    }

    // Group by local date
    var byDate = {};
    var dateOrder = [];
    allMatches.forEach(function (m) {
      var d = getMatchDateInTz(m.date, m.utc, state.tz);
      if (!byDate[d]) { byDate[d] = []; dateOrder.push(d); }
      byDate[d].push(m);
    });

    dateOrder.forEach(function (d) {
      var group = el('div', 'date-group');
      var hdr = el('div', 'date-header');
      hdr.textContent = formatDateHeader(d, state.tz);
      group.appendChild(hdr);
      byDate[d].forEach(function (m) {
        group.appendChild(buildScheduleItem(m));
      });
      body.appendChild(group);
    });
  }

  function formatDateHeader(dateStr, tz) {
    try {
      var d = new Date(dateStr + 'T12:00:00');
      return new Intl.DateTimeFormat('en-IE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) { return dateStr; }
  }

  function buildAllMatchesForSchedule() {
    var gm = WC.GROUP_MATCHES.map(function (m) {
      return Object.assign({}, m, { roundType: 'group' });
    });
    var km = getKnockoutArray().map(function (m) {
      return Object.assign({}, m, { group: null, roundType: 'ko' });
    });
    var all = gm.concat(km);
    all.sort(function (a, b) {
      var da = a.date + 'T' + a.utc + ':00Z';
      var db = b.date + 'T' + b.utc + ':00Z';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    return all;
  }

  function buildScheduleItem(m) {
    var item = el('div', 'match-item');

    // Badge column
    var badgeCol = el('div', 'match-item-badge');
    var badge = el('div', 'round-badge');
    if (m.roundType === 'group') {
      badge.textContent = 'Group ' + m.group;
      badge.classList.add('group');
    } else {
      var rLabel = { r32: 'R32', r16: 'R16', qf: 'QF', sf: 'SF', '3rd': '3rd Place', final: 'Final' }[m.round] || 'KO';
      badge.textContent = rLabel;
      badge.classList.add(m.round === 'final' ? 'final' : 'ko');
    }
    var numEl = el('div', 'match-num');
    numEl.textContent = m.id || ('M' + m.no);
    badgeCol.appendChild(badge);
    badgeCol.appendChild(numEl);
    item.appendChild(badgeCol);

    // Teams column
    var teamsCol = el('div', 'match-item-teams');
    var t1, t2, s1, s2;
    if (m.roundType === 'group') {
      t1 = m.team1; t2 = m.team2; s1 = m.score1; s2 = m.score2;
    } else {
      t1 = resolveKoTeam(m.team1, m.team1Label) || { flag: '', name: formatLabel(m.team1Label), code: null };
      t2 = resolveKoTeam(m.team2, m.team2Label) || { flag: '', name: formatLabel(m.team2Label), code: null };
      s1 = m.score1; s2 = m.score2;
    }
    var t1win = s1 !== null && s2 !== null && s1 > s2;
    var t2win = s1 !== null && s2 !== null && s2 > s1;

    var t1row = el('div', 'match-item-team' + (t1win ? ' winner' : ''));
    var f1 = el('span', 'flag'); f1.textContent = t1 ? t1.flag : '';
    var n1 = el('span', 'tname'); n1.textContent = t1 ? t1.name : (m.team1Label || '?');
    var sc1 = el('span', 'tscore'); sc1.textContent = s1 !== null ? s1 : '';
    t1row.appendChild(f1); t1row.appendChild(n1); t1row.appendChild(sc1);

    var sep = el('div', 'match-item-sep'); sep.textContent = '—';

    var t2row = el('div', 'match-item-team' + (t2win ? ' winner' : ''));
    var f2 = el('span', 'flag'); f2.textContent = t2 ? t2.flag : '';
    var n2 = el('span', 'tname'); n2.textContent = t2 ? t2.name : (m.team2Label || '?');
    var sc2 = el('span', 'tscore'); sc2.textContent = s2 !== null ? s2 : '';
    t2row.appendChild(f2); t2row.appendChild(n2); t2row.appendChild(sc2);

    teamsCol.appendChild(t1row); teamsCol.appendChild(sep); teamsCol.appendChild(t2row);
    item.appendChild(teamsCol);

    // Meta column
    var metaCol = el('div', 'match-item-meta');
    var timeEl = el('div', 'match-item-time' + (m.est ? ' est' : ''));
    timeEl.textContent = formatMatchTime(m.date, m.utc, state.tz, m.est);
    var venueEl = el('div', 'match-item-venue');
    venueEl.textContent = m.venue && m.venue !== 'TBD' ? m.venue : '';
    var cityEl = el('div', 'match-item-city');
    cityEl.textContent = m.city && m.city !== 'TBD' ? m.city : '';
    metaCol.appendChild(timeEl);
    if (m.est) { var estBadge = el('span', 'est-badge'); estBadge.textContent = 'est.'; metaCol.appendChild(estBadge); }
    metaCol.appendChild(venueEl);
    metaCol.appendChild(cityEl);
    item.appendChild(metaCol);

    return item;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

})();
