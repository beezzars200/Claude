// FIFA World Cup 2026 — Tournament Data
// NOTE: Groups are AI-estimated. Update with actual draw results.
window.WC = window.WC || {};

WC.GROUPS = {
  A: { teams: [
    { code: 'MEX', name: 'Mexico',       flag: '🇲🇽' },
    { code: 'POL', name: 'Poland',       flag: '🇵🇱' },
    { code: 'MAR', name: 'Morocco',      flag: '🇲🇦' },
    { code: 'ECU', name: 'Ecuador',      flag: '🇪🇨' },
  ]},
  B: { teams: [
    { code: 'USA', name: 'USA',          flag: '🇺🇸' },
    { code: 'ENG', name: 'England',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { code: 'JPN', name: 'Japan',        flag: '🇯🇵' },
    { code: 'PAN', name: 'Panama',       flag: '🇵🇦' },
  ]},
  C: { teams: [
    { code: 'CAN', name: 'Canada',       flag: '🇨🇦' },
    { code: 'GER', name: 'Germany',      flag: '🇩🇪' },
    { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'CHI', name: 'Chile',        flag: '🇨🇱' },
  ]},
  D: { teams: [
    { code: 'ARG', name: 'Argentina',    flag: '🇦🇷' },
    { code: 'ITA', name: 'Italy',        flag: '🇮🇹' },
    { code: 'CIV', name: 'Ivory Coast',  flag: '🇨🇮' },
    { code: 'AUS', name: 'Australia',    flag: '🇦🇺' },
  ]},
  E: { teams: [
    { code: 'FRA', name: 'France',       flag: '🇫🇷' },
    { code: 'DEN', name: 'Denmark',      flag: '🇩🇰' },
    { code: 'KOR', name: 'South Korea',  flag: '🇰🇷' },
    { code: 'ALG', name: 'Algeria',      flag: '🇩🇿' },
  ]},
  F: { teams: [
    { code: 'ESP', name: 'Spain',        flag: '🇪🇸' },
    { code: 'CRO', name: 'Croatia',      flag: '🇭🇷' },
    { code: 'SEN', name: 'Senegal',      flag: '🇸🇳' },
    { code: 'HON', name: 'Honduras',     flag: '🇭🇳' },
  ]},
  G: { teams: [
    { code: 'POR', name: 'Portugal',     flag: '🇵🇹' },
    { code: 'NED', name: 'Netherlands',  flag: '🇳🇱' },
    { code: 'GHA', name: 'Ghana',        flag: '🇬🇭' },
    { code: 'IRQ', name: 'Iraq',         flag: '🇮🇶' },
  ]},
  H: { teams: [
    { code: 'BRA', name: 'Brazil',       flag: '🇧🇷' },
    { code: 'BEL', name: 'Belgium',      flag: '🇧🇪' },
    { code: 'SRB', name: 'Serbia',       flag: '🇷🇸' },
    { code: 'TUN', name: 'Tunisia',      flag: '🇹🇳' },
  ]},
  I: { teams: [
    { code: 'SUI', name: 'Switzerland',  flag: '🇨🇭' },
    { code: 'COL', name: 'Colombia',     flag: '🇨🇴' },
    { code: 'NGA', name: 'Nigeria',      flag: '🇳🇬' },
    { code: 'IRN', name: 'Iran',         flag: '🇮🇷' },
  ]},
  J: { teams: [
    { code: 'URU', name: 'Uruguay',      flag: '🇺🇾' },
    { code: 'TUR', name: 'Turkey',       flag: '🇹🇷' },
    { code: 'CMR', name: 'Cameroon',     flag: '🇨🇲' },
    { code: 'JOR', name: 'Jordan',       flag: '🇯🇴' },
  ]},
  K: { teams: [
    { code: 'AUT', name: 'Austria',      flag: '🇦🇹' },
    { code: 'SCO', name: 'Scotland',     flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    { code: 'EGY', name: 'Egypt',        flag: '🇪🇬' },
    { code: 'QAT', name: 'Qatar',        flag: '🇶🇦' },
  ]},
  L: { teams: [
    { code: 'JAM', name: 'Jamaica',      flag: '🇯🇲' },
    { code: 'NZL', name: 'New Zealand',  flag: '🇳🇿' },
    { code: 'PER', name: 'Peru',         flag: '🇵🇪' },
    { code: 'IDN', name: 'Indonesia',    flag: '🇮🇩' },
  ]},
};

// Group stage schedule: each group plays on 3 matchdays
// Times are UTC. MD3 matches are simultaneous within each group.
// Pairings: MD1 = 0v1, 2v3 | MD2 = 0v2, 1v3 | MD3 = 0v3, 1v2
WC.GROUP_SCHEDULE = {
  A: { md1: '2026-06-11', md2: '2026-06-17', md3: '2026-06-23' },
  B: { md1: '2026-06-12', md2: '2026-06-18', md3: '2026-06-24' },
  C: { md1: '2026-06-13', md2: '2026-06-19', md3: '2026-06-25' },
  D: { md1: '2026-06-14', md2: '2026-06-20', md3: '2026-06-26' },
  E: { md1: '2026-06-15', md2: '2026-06-21', md3: '2026-06-27' },
  F: { md1: '2026-06-16', md2: '2026-06-22', md3: '2026-06-28' },
  G: { md1: '2026-06-11', md2: '2026-06-20', md3: '2026-06-29' },
  H: { md1: '2026-06-12', md2: '2026-06-21', md3: '2026-06-30' },
  I: { md1: '2026-06-13', md2: '2026-06-22', md3: '2026-07-01' },
  J: { md1: '2026-06-14', md2: '2026-06-23', md3: '2026-07-01' },
  K: { md1: '2026-06-15', md2: '2026-06-24', md3: '2026-07-02' },
  L: { md1: '2026-06-16', md2: '2026-06-25', md3: '2026-07-02' },
};

// Knockout bracket
// team1/team2: either a team code (if known) or a label like "1A", "W-R32-1"
// Dates are approximate — update when official schedule is published
WC.KNOCKOUT = {
  r32: [
    // Left half (feeds → SF Left → Final)
    { id: 'R32-1',  date: '2026-07-04', utc: '19:00', team1: '1A', team2: '2C', score1: null, score2: null },
    { id: 'R32-2',  date: '2026-07-04', utc: '22:00', team1: '1B', team2: '2D', score1: null, score2: null },
    { id: 'R32-3',  date: '2026-07-05', utc: '19:00', team1: '1E', team2: '2G', score1: null, score2: null },
    { id: 'R32-4',  date: '2026-07-05', utc: '22:00', team1: '1F', team2: '2H', score1: null, score2: null },
    { id: 'R32-5',  date: '2026-07-06', utc: '19:00', team1: '1I', team2: '3A/C/D', score1: null, score2: null },
    { id: 'R32-6',  date: '2026-07-06', utc: '22:00', team1: '1J', team2: '3B/E/F', score1: null, score2: null },
    { id: 'R32-7',  date: '2026-07-07', utc: '19:00', team1: '1C', team2: '3G/H/I', score1: null, score2: null },
    { id: 'R32-8',  date: '2026-07-07', utc: '22:00', team1: '1D', team2: '3J/K/L', score1: null, score2: null },
    // Right half (feeds → SF Right → Final)
    { id: 'R32-9',  date: '2026-07-04', utc: '16:00', team1: '1G', team2: '2E', score1: null, score2: null },
    { id: 'R32-10', date: '2026-07-04', utc: '23:30', team1: '1H', team2: '2F', score1: null, score2: null },
    { id: 'R32-11', date: '2026-07-05', utc: '16:00', team1: '1K', team2: '2I', score1: null, score2: null },
    { id: 'R32-12', date: '2026-07-05', utc: '23:30', team1: '1L', team2: '2J', score1: null, score2: null },
    { id: 'R32-13', date: '2026-07-06', utc: '16:00', team1: '2A', team2: '3D/E/F', score1: null, score2: null },
    { id: 'R32-14', date: '2026-07-06', utc: '23:30', team1: '2B', team2: '3G/H/L', score1: null, score2: null },
    { id: 'R32-15', date: '2026-07-07', utc: '16:00', team1: '2K', team2: '3A/B/C', score1: null, score2: null },
    { id: 'R32-16', date: '2026-07-07', utc: '23:30', team1: '2L', team2: '3I/J/K', score1: null, score2: null },
  ],
  r16: [
    { id: 'R16-1', date: '2026-07-10', utc: '19:00', team1: 'W-R32-1',  team2: 'W-R32-2',  score1: null, score2: null },
    { id: 'R16-2', date: '2026-07-10', utc: '22:00', team1: 'W-R32-3',  team2: 'W-R32-4',  score1: null, score2: null },
    { id: 'R16-3', date: '2026-07-11', utc: '19:00', team1: 'W-R32-5',  team2: 'W-R32-6',  score1: null, score2: null },
    { id: 'R16-4', date: '2026-07-11', utc: '22:00', team1: 'W-R32-7',  team2: 'W-R32-8',  score1: null, score2: null },
    { id: 'R16-5', date: '2026-07-12', utc: '19:00', team1: 'W-R32-9',  team2: 'W-R32-10', score1: null, score2: null },
    { id: 'R16-6', date: '2026-07-12', utc: '22:00', team1: 'W-R32-11', team2: 'W-R32-12', score1: null, score2: null },
    { id: 'R16-7', date: '2026-07-13', utc: '19:00', team1: 'W-R32-13', team2: 'W-R32-14', score1: null, score2: null },
    { id: 'R16-8', date: '2026-07-13', utc: '22:00', team1: 'W-R32-15', team2: 'W-R32-16', score1: null, score2: null },
  ],
  qf: [
    { id: 'QF-1', date: '2026-07-15', utc: '19:00', team1: 'W-R16-1', team2: 'W-R16-2', score1: null, score2: null },
    { id: 'QF-2', date: '2026-07-15', utc: '22:00', team1: 'W-R16-3', team2: 'W-R16-4', score1: null, score2: null },
    { id: 'QF-3', date: '2026-07-16', utc: '19:00', team1: 'W-R16-5', team2: 'W-R16-6', score1: null, score2: null },
    { id: 'QF-4', date: '2026-07-16', utc: '22:00', team1: 'W-R16-7', team2: 'W-R16-8', score1: null, score2: null },
  ],
  sf: [
    { id: 'SF-1', date: '2026-07-19', utc: '22:00', team1: 'W-QF-1', team2: 'W-QF-2', score1: null, score2: null },
    { id: 'SF-2', date: '2026-07-20', utc: '22:00', team1: 'W-QF-3', team2: 'W-QF-4', score1: null, score2: null },
  ],
  thirdPlace: { id: '3RD',   date: '2026-07-23', utc: '19:00', team1: 'L-SF-1', team2: 'L-SF-2', score1: null, score2: null },
  final:      { id: 'FINAL', date: '2026-07-26', utc: '20:00', team1: 'W-SF-1', team2: 'W-SF-2', score1: null, score2: null },
};

// European countries with IANA timezone IDs (summer/BST applicable)
WC.TIMEZONES = [
  { name: 'Ireland',         tz: 'Europe/Dublin',     flag: '🇮🇪', default: true  },
  { name: 'United Kingdom',  tz: 'Europe/London',     flag: '🇬🇧' },
  { name: 'Portugal',        tz: 'Europe/Lisbon',     flag: '🇵🇹' },
  { name: 'Iceland',         tz: 'Atlantic/Reykjavik',flag: '🇮🇸' },
  { name: 'France',          tz: 'Europe/Paris',      flag: '🇫🇷' },
  { name: 'Germany',         tz: 'Europe/Berlin',     flag: '🇩🇪' },
  { name: 'Spain',           tz: 'Europe/Madrid',     flag: '🇪🇸' },
  { name: 'Netherlands',     tz: 'Europe/Amsterdam',  flag: '🇳🇱' },
  { name: 'Belgium',         tz: 'Europe/Brussels',   flag: '🇧🇪' },
  { name: 'Switzerland',     tz: 'Europe/Zurich',     flag: '🇨🇭' },
  { name: 'Italy',           tz: 'Europe/Rome',       flag: '🇮🇹' },
  { name: 'Austria',         tz: 'Europe/Vienna',     flag: '🇦🇹' },
  { name: 'Denmark',         tz: 'Europe/Copenhagen', flag: '🇩🇰' },
  { name: 'Sweden',          tz: 'Europe/Stockholm',  flag: '🇸🇪' },
  { name: 'Norway',          tz: 'Europe/Oslo',       flag: '🇳🇴' },
  { name: 'Poland',          tz: 'Europe/Warsaw',     flag: '🇵🇱' },
  { name: 'Czech Republic',  tz: 'Europe/Prague',     flag: '🇨🇿' },
  { name: 'Slovakia',        tz: 'Europe/Bratislava', flag: '🇸🇰' },
  { name: 'Hungary',         tz: 'Europe/Budapest',   flag: '🇭🇺' },
  { name: 'Croatia',         tz: 'Europe/Zagreb',     flag: '🇭🇷' },
  { name: 'Serbia',          tz: 'Europe/Belgrade',   flag: '🇷🇸' },
  { name: 'Romania',         tz: 'Europe/Bucharest',  flag: '🇷🇴' },
  { name: 'Bulgaria',        tz: 'Europe/Sofia',      flag: '🇧🇬' },
  { name: 'Greece',          tz: 'Europe/Athens',     flag: '🇬🇷' },
  { name: 'Turkey',          tz: 'Europe/Istanbul',   flag: '🇹🇷' },
  { name: 'Finland',         tz: 'Europe/Helsinki',   flag: '🇫🇮' },
  { name: 'Estonia',         tz: 'Europe/Tallinn',    flag: '🇪🇪' },
  { name: 'Latvia',          tz: 'Europe/Riga',       flag: '🇱🇻' },
  { name: 'Lithuania',       tz: 'Europe/Vilnius',    flag: '🇱🇹' },
  { name: 'Ukraine',         tz: 'Europe/Kiev',       flag: '🇺🇦' },
  { name: 'Scotland',        tz: 'Europe/London',     flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'Albania',         tz: 'Europe/Tirane',     flag: '🇦🇱' },
];

// Generates all 72 group stage match objects
WC.buildGroupMatches = function() {
  const matches = [];
  const pairings = [
    // MD1
    { md: 1, i: 0, j: 1, timeSlot: 0 },
    { md: 1, i: 2, j: 3, timeSlot: 1 },
    // MD2
    { md: 2, i: 0, j: 2, timeSlot: 0 },
    { md: 2, i: 1, j: 3, timeSlot: 1 },
    // MD3 (simultaneous)
    { md: 3, i: 0, j: 3, timeSlot: 2 },
    { md: 3, i: 1, j: 2, timeSlot: 2 },
  ];
  const times = ['16:00', '22:00', '19:00']; // UTC; slot 2 = MD3 simultaneous

  Object.entries(WC.GROUPS).forEach(([groupLetter, group]) => {
    const sched = WC.GROUP_SCHEDULE[groupLetter];
    pairings.forEach(({ md, i, j, timeSlot }) => {
      const dateKey = md === 1 ? 'md1' : md === 2 ? 'md2' : 'md3';
      matches.push({
        id:     `G${groupLetter}-MD${md}-${i}v${j}`,
        group:  groupLetter,
        md,
        date:   sched[dateKey],
        utc:    times[timeSlot],
        team1:  group.teams[i],
        team2:  group.teams[j],
        score1: null,
        score2: null,
      });
    });
  });
  return matches;
};
