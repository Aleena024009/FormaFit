'use strict';

// Push Pull Legs templates. Each exercise is [name, sets, reps].
// A program with `week` (Sunday first) and `labels` sets its own days and
// day names instead of using SCHEDULES; `phases` and `rules` are optional.
const PROGRAMS = [
  {
    id: 'boxom',
    name: 'BOXOM 8-Week Plan',
    about: 'Your coach\'s plan: Push, Pull, Legs, a light recovery day and a full-body day. 2 sets each, light weights.',
    labels: { push: 'Push', pull: 'Pull', legs: 'Legs + Core', recovery: 'Recovery', full: 'Full Body' },
    week: [null, 'push', 'pull', 'legs', 'recovery', 'full', null],
    weekDetail: 'Mon to Fri, weekends rest',
    push: [['Chest Press', 2, '10-12'], ['Incline Dumbbell Press', 2, '10'], ['Shoulder Press', 2, '10'], ['Lateral Raise', 2, '12'], ['Tricep Pushdown', 2, '12']],
    pull: [['Lat Pulldown', 2, '10-12'], ['Seated Cable Row', 2, '10-12'], ['One-arm Dumbbell Row', 2, '10 each side'], ['Face Pull', 2, '12-15'], ['Dumbbell Biceps Curl', 2, '12']],
    legs: [['Goblet Squat', 2, '10-12'], ['Leg Press', 2, '12'], ['Leg Curl', 2, '12'], ['Glute Bridge', 2, '12-15'], ['Calf Raise', 2, '15'], ['Dead Bug', 2, '8-10 each side']],
    recovery: [['Easy treadmill walk', 1, '10-15 min'], ['Easy cycling', 1, '5-10 min'], ['Mobility and stretching', 1, '5-10 min']],
    full: [['Goblet Squat', 2, '10'], ['Chest Press', 2, '10'], ['Lat Pulldown', 2, '10'], ['Dumbbell Romanian Deadlift', 2, '10'], ['Glute Bridge', 2, '12'], ['Plank', 2, '15-25 sec']],
    phases: [
      [1, 2, 'Learn machine setup, posture, breathing and technique. Light weights, 2 sets.'],
      [3, 4, 'Build consistency and controlled reps. Don\'t add weight if form isn\'t steady.'],
      [5, 6, 'If technique is good, add a little weight or 1–2 reps on some exercises.'],
      [7, 8, 'Keep good form, progress gradually, and review strength, stamina and sleep.']
    ],
    rules: [
      'Warm up with 5–7 minutes of easy walking or cycling first. Keep it light enough to talk.',
      'Rest about 60–90 seconds between sets, longer if you need it.',
      'Stop each set with 2–3 good reps still left. No training to failure.',
      'Add weight only when you can do every rep with steady form and no pain.',
      'Day 4 is easy on purpose. It is recovery, not a hard workout.',
      'If you only get 3 days in a week, do Push, Pull, Legs in order and continue from there next time.',
      'Stop for sharp pain, dizziness, chest discomfort or unusual breathlessness.',
      'Ask your coach to watch the Romanian deadlift and other free-weight lifts.',
      'Lift what is right for you. Don\'t match anyone else\'s weights.'
    ]
  },
  {
    id: 'beginner',
    name: 'Beginner PPL',
    about: 'New to the gym. 5 exercises a day, 3 sets each.',
    push: [['Bench Press', 3, '8-10'], ['Incline Dumbbell Press', 3, '10-12'], ['Shoulder Press', 3, '10'], ['Lateral Raise', 3, '12-15'], ['Tricep Pushdown', 3, '12']],
    pull: [['Lat Pulldown', 3, '10-12'], ['Barbell Row', 3, '8-10'], ['Seated Cable Row', 3, '10'], ['Barbell Curl', 3, '10'], ['Hammer Curl', 3, '12']],
    legs: [['Squat', 4, '6-8'], ['Leg Press', 3, '10-12'], ['Walking Lunges', 3, '12'], ['Leg Curl', 3, '12'], ['Calf Raise', 4, '15-20']]
  },
  {
    id: 'intermediate',
    name: 'Intermediate 6-Day PPL',
    about: 'Training for 6+ months. More volume, adds deadlifts.',
    push: [['Bench Press', 4, '6-8'], ['Incline DB Press', 4, '8-12'], ['Cable Fly', 3, '12-15'], ['Shoulder Press', 4, '8-10'], ['Lateral Raise', 4, '12-15'], ['Tricep Pushdown', 4, '10-12']],
    pull: [['Deadlift', 4, '5-6'], ['Lat Pulldown', 4, '10-12'], ['Barbell Row', 4, '8-10'], ['Face Pull', 3, '15'], ['Barbell Curl', 4, '8-10'], ['Preacher Curl', 3, '12']],
    legs: [['Squat', 4, '6-8'], ['Romanian Deadlift', 4, '8-10'], ['Leg Press', 4, '10-12'], ['Leg Curl', 3, '12'], ['Standing Calf Raise', 4, '15-20']]
  },
  {
    id: 'advanced',
    name: 'Advanced Bodybuilding PPL',
    about: 'Experienced lifters. Heavy compounds and high volume.',
    push: [['Flat Bench Press', 5, '5-8'], ['Incline Bench Press', 4, '8-10'], ['Weighted Dips', 4, '10'], ['Machine Chest Fly', 4, '12-15'], ['Arnold Press', 4, '10'], ['Cable Lateral Raise', 5, '15']],
    pull: [['Heavy Deadlift', 5, '3-5'], ['Pull-Ups', 4, 'Failure'], ['T-Bar Row', 4, '8-10'], ['Cable Row', 4, '12'], ['EZ Bar Curl', 4, '10'], ['Incline Curl', 4, '12']],
    legs: [['Back Squat', 5, '5-8'], ['Hack Squat', 4, '10'], ['Bulgarian Split Squat', 4, '12'], ['Romanian Deadlift', 4, '10'], ['Seated Calf Raise', 5, '20']]
  },
  {
    id: 'fatloss',
    name: 'Fat Loss PPL',
    about: 'Lighter weights, 15–20 reps to burn more calories.',
    push: [['Push-Ups', 4, '15'], ['DB Shoulder Press', 3, '15'], ['Cable Fly', 3, '15'], ['Tricep Rope Pushdown', 3, '15']],
    pull: [['Lat Pulldown', 4, '15'], ['Seated Row', 4, '15'], ['Face Pull', 3, '20'], ['Hammer Curl', 3, '15']],
    legs: [['Bodyweight Squat', 4, '20'], ['Leg Press', 4, '15'], ['Walking Lunges', 4, '20'], ['Leg Curl', 3, '15'], ['Calf Raise', 4, '20']]
  },
  {
    id: 'machine',
    name: 'Machine-Only PPL',
    about: 'Only machines. Easy to learn and safe for form.',
    push: [['Chest Press Machine', 4, '10-12'], ['Incline Press Machine', 4, '10'], ['Shoulder Press Machine', 4, '10'], ['Pec Deck', 3, '15'], ['Tricep Pushdown', 4, '12']],
    pull: [['Lat Pulldown Machine', 4, '12'], ['Low Row Machine', 4, '10'], ['Rear Delt Machine', 3, '15'], ['Bicep Curl Machine', 4, '12']],
    legs: [['Leg Press', 4, '12'], ['Leg Extension', 4, '15'], ['Leg Curl', 4, '15'], ['Calf Machine', 5, '20']]
  },
  {
    id: 'home',
    name: 'Home Workout PPL',
    about: 'No gym needed. Bodyweight and resistance bands.',
    push: [['Push-Ups', 4, '15-20'], ['Pike Push-Ups', 4, '12'], ['Chair Dips', 4, '15'], ['Resistance Band Press', 3, '15']],
    pull: [['Resistance Band Row', 4, '15'], ['Pull-Ups', 4, 'Failure'], ['Band Curl', 3, '15'], ['Rear Delt Fly', 3, '15']],
    legs: [['Air Squats', 5, '20'], ['Jump Squats', 4, '15'], ['Walking Lunges', 4, '20'], ['Glute Bridge', 4, '15'], ['Calf Raise', 5, '20']]
  }
];

// Weekday index (0 = Sunday) → which PPL day, or null for rest.
const SCHEDULES = {
  six: { label: '6 days a week', detail: 'Mon to Sat, Sunday rest', days: [null, 'push', 'pull', 'legs', 'push', 'pull', 'legs'] },
  three: { label: '3 days a week', detail: 'Mon, Wed, Fri', days: [null, 'push', null, 'pull', null, 'legs', null] }
};

const TRAINING_TIPS = [
  'Warm up before every workout',
  'Use proper form before increasing weight',
  'Rest 45–90 seconds between normal sets',
  'Rest 2–3 minutes during heavy compound lifts',
  'Eat enough protein and stay hydrated',
  'Sleep 7–8 hours daily for recovery',
  'Increase weight or reps gradually every week'
];

const REP_RANGES = [
  ['Strength', '4–6 reps'],
  ['Muscle gain', '8–12 reps'],
  ['Endurance / fat loss', '15–20 reps']
];
