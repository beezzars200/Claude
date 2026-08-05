/*
 * schedule.js — the only file you need to edit.
 *
 * Each day has:
 *   day      Name shown on the card.
 *   accent   Card colour: "emerald" | "blue" | "amber" | "slate".
 *   location "wfh" | "office" | null
 *   tagline  Short label on the right of the card header.
 *   items[]  Rows, in order. Each row is:
 *              time  "HH:MM - HH:MM" (drives the "right now" banner) or "" for no time.
 *              icon  Emoji shown next to the text.
 *              text  What you're doing/eating.
 *              note  Optional small grey aside, e.g. "(At Desk)".
 *              tag   Right-hand pill. Known tags get their own colour — see TAG_STYLES
 *                    in app.js. Anything else falls back to grey.
 *              feature  true to give the row a tinted background (gym, weigh-in).
 */

const BREAKFAST = {
  time: '09:00 - 10:00',
  icon: '🍳',
  text: '2 Boiled Eggs, Toast, Butter',
  tag: 'Breakfast',
};

const WEEK = [
  {
    day: 'Monday',
    accent: 'emerald',
    location: 'wfh',
    tagline: 'Rest & Reset',
    items: [
      BREAKFAST,
      {
        time: '11:30 - 12:00',
        icon: '🍮🐟',
        text: 'Protein Pudding + 1 Tin of Tuna',
        tag: 'Mid-Morning',
      },
      {
        time: '12:30 - 13:30',
        icon: '🥗',
        text: 'Chicken & Green Salad + Oil',
        tag: 'Lunch',
      },
      {
        time: '19:00 - 20:00',
        icon: '🍗',
        text: 'Chicken & Veg',
        tag: 'Dinner',
      },
    ],
  },

  {
    day: 'Tuesday',
    accent: 'blue',
    location: 'office',
    tagline: 'Gym Day + Refuel',
    taglineIcon: 'dumbbell',
    items: [
      BREAKFAST,
      {
        time: '11:30 - 12:00',
        icon: '🍫🍌',
        text: 'Fulfil Bar + Banana or Rice Cakes',
        tag: 'Pre-Workout',
      },
      {
        time: '12:00 - 12:40',
        icon: '🏋️',
        text: 'Gym Session',
        note: '30-40 min',
        tag: 'Workout',
        feature: true,
      },
      {
        time: '13:00 - 13:30',
        icon: '🥗🐟',
        text: 'Takeaway Chicken & Green Salad + 1 Tin of Tuna',
        note: 'At Desk',
        tag: 'Lunch',
      },
      {
        time: '19:00 - 20:00',
        icon: '🍗🥔',
        text: 'Chicken, Veg + Boiled Potatoes',
        tag: 'Dinner (Refuel)',
      },
    ],
  },

  {
    day: 'Wednesday',
    accent: 'emerald',
    location: 'office',
    tagline: 'Rest & Recover',
    items: [
      BREAKFAST,
      {
        time: '11:30 - 12:00',
        icon: '🍫🐟',
        text: 'Fulfil Bar + 1 Tin of Tuna',
        tag: 'Mid-Morning',
      },
      {
        time: '12:30 - 13:30',
        icon: '🥗',
        text: 'Takeaway Chicken & Green Salad + Oil',
        tag: 'Lunch',
      },
      {
        time: '19:00 - 20:00',
        icon: '🍗',
        text: 'Chicken & Veg',
        tag: 'Dinner',
      },
    ],
  },

  {
    day: 'Thursday',
    accent: 'blue',
    location: 'office',
    tagline: 'Gym Day',
    taglineIcon: 'dumbbell',
    items: [
      BREAKFAST,
      {
        time: '11:30 - 12:00',
        icon: '🍫🍌',
        text: 'Fulfil Bar + Banana or Rice Cakes',
        tag: 'Pre-Workout',
      },
      {
        time: '12:00 - 12:40',
        icon: '🏋️',
        text: 'Gym Session',
        note: '30-40 min',
        tag: 'Workout',
        feature: true,
      },
      {
        time: '13:00 - 13:30',
        icon: '🥗🐟',
        text: 'Takeaway Chicken & Green Salad + 1 Tin of Tuna',
        note: 'At Desk',
        tag: 'Lunch',
      },
      {
        time: '19:00 - 20:00',
        icon: '🍗',
        text: 'Chicken & Veg',
        tag: 'Dinner',
      },
    ],
  },

  {
    day: 'Friday',
    accent: 'amber',
    location: 'wfh',
    tagline: 'End of Week',
    items: [
      {
        time: '07:00 - 08:00',
        icon: '📏',
        text: 'Fasted Waist Tape Measurement',
        tag: 'Check-in',
        feature: true,
      },
      BREAKFAST,
      {
        time: '11:30 - 12:00',
        icon: '🍮🐟',
        text: 'Protein Pudding + 1 Tin of Tuna',
        tag: 'Mid-Morning',
      },
      {
        time: '12:30 - 13:30',
        icon: '🥗',
        text: 'Chicken & Green Salad + Oil',
        tag: 'Lunch',
      },
    ],
  },

  // Weekends aren't planned yet. Add rows here in the same shape as above
  // whenever you want to lock them down.
  {
    day: 'Saturday',
    accent: 'slate',
    location: null,
    tagline: 'Off Plan',
    items: [
      { time: '', icon: '🗓️', text: 'No fixed plan yet', tag: 'Flexible' },
    ],
  },

  {
    day: 'Sunday',
    accent: 'slate',
    location: null,
    tagline: 'Off Plan',
    items: [
      { time: '', icon: '🗓️', text: 'No fixed plan yet', tag: 'Flexible' },
    ],
  },
];

// Cards at the top of the page. Edit freely.
const SUMMARY = [
  { icon: 'dumbbell', label: 'Gym Days', value: 'Tue & Thu', tone: 'emerald' },
  { icon: 'house-laptop', label: 'Remote Days', value: 'Mon & Fri', tone: 'sky' },
  { icon: 'scale-balanced', label: 'Measurements', value: 'Friday AM', tone: 'amber' },
  { icon: 'utensils', label: 'Meal Routine', value: 'Structured', tone: 'purple' },
];
