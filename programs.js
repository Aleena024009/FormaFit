'use strict';

// Push Pull Legs templates. Each exercise is [name, sets, reps].
const PROGRAMS = [
  {
    id: 'beginner',
    name: 'Beginner PPL',
    push: [['Bench Press', 3, '8-10'], ['Incline Dumbbell Press', 3, '10-12'], ['Shoulder Press', 3, '10'], ['Lateral Raise', 3, '12-15'], ['Tricep Pushdown', 3, '12']],
    pull: [['Lat Pulldown', 3, '10-12'], ['Barbell Row', 3, '8-10'], ['Seated Cable Row', 3, '10'], ['Barbell Curl', 3, '10'], ['Hammer Curl', 3, '12']],
    legs: [['Squat', 4, '6-8'], ['Leg Press', 3, '10-12'], ['Walking Lunges', 3, '12'], ['Leg Curl', 3, '12'], ['Calf Raise', 4, '15-20']]
  },
  {
    id: 'intermediate',
    name: 'Intermediate 6-Day PPL',
    push: [['Bench Press', 4, '6-8'], ['Incline DB Press', 4, '8-12'], ['Cable Fly', 3, '12-15'], ['Shoulder Press', 4, '8-10'], ['Lateral Raise', 4, '12-15'], ['Tricep Pushdown', 4, '10-12']],
    pull: [['Deadlift', 4, '5-6'], ['Lat Pulldown', 4, '10-12'], ['Barbell Row', 4, '8-10'], ['Face Pull', 3, '15'], ['Barbell Curl', 4, '8-10'], ['Preacher Curl', 3, '12']],
    legs: [['Squat', 4, '6-8'], ['Romanian Deadlift', 4, '8-10'], ['Leg Press', 4, '10-12'], ['Leg Curl', 3, '12'], ['Standing Calf Raise', 4, '15-20']]
  },
  {
    id: 'advanced',
    name: 'Advanced Bodybuilding PPL',
    push: [['Flat Bench Press', 5, '5-8'], ['Incline Bench Press', 4, '8-10'], ['Weighted Dips', 4, '10'], ['Machine Chest Fly', 4, '12-15'], ['Arnold Press', 4, '10'], ['Cable Lateral Raise', 5, '15']],
    pull: [['Heavy Deadlift', 5, '3-5'], ['Pull-Ups', 4, 'Failure'], ['T-Bar Row', 4, '8-10'], ['Cable Row', 4, '12'], ['EZ Bar Curl', 4, '10'], ['Incline Curl', 4, '12']],
    legs: [['Back Squat', 5, '5-8'], ['Hack Squat', 4, '10'], ['Bulgarian Split Squat', 4, '12'], ['Romanian Deadlift', 4, '10'], ['Seated Calf Raise', 5, '20']]
  },
  {
    id: 'fatloss',
    name: 'Fat Loss PPL',
    push: [['Push-Ups', 4, '15'], ['DB Shoulder Press', 3, '15'], ['Cable Fly', 3, '15'], ['Tricep Rope Pushdown', 3, '15']],
    pull: [['Lat Pulldown', 4, '15'], ['Seated Row', 4, '15'], ['Face Pull', 3, '20'], ['Hammer Curl', 3, '15']],
    legs: [['Bodyweight Squat', 4, '20'], ['Leg Press', 4, '15'], ['Walking Lunges', 4, '20'], ['Leg Curl', 3, '15'], ['Calf Raise', 4, '20']]
  },
  {
    id: 'machine',
    name: 'Machine-Only PPL',
    push: [['Chest Press Machine', 4, '10-12'], ['Incline Press Machine', 4, '10'], ['Shoulder Press Machine', 4, '10'], ['Pec Deck', 3, '15'], ['Tricep Pushdown', 4, '12']],
    pull: [['Lat Pulldown Machine', 4, '12'], ['Low Row Machine', 4, '10'], ['Rear Delt Machine', 3, '15'], ['Bicep Curl Machine', 4, '12']],
    legs: [['Leg Press', 4, '12'], ['Leg Extension', 4, '15'], ['Leg Curl', 4, '15'], ['Calf Machine', 5, '20']]
  },
  {
    id: 'home',
    name: 'Home Workout PPL',
    push: [['Push-Ups', 4, '15-20'], ['Pike Push-Ups', 4, '12'], ['Chair Dips', 4, '15'], ['Resistance Band Press', 3, '15']],
    pull: [['Resistance Band Row', 4, '15'], ['Pull-Ups', 4, 'Failure'], ['Band Curl', 3, '15'], ['Rear Delt Fly', 3, '15']],
    legs: [['Air Squats', 5, '20'], ['Jump Squats', 4, '15'], ['Walking Lunges', 4, '20'], ['Glute Bridge', 4, '15'], ['Calf Raise', 5, '20']]
  }
];

// Weekday index (0 = Sunday) → which PPL day, or null for rest.
const SCHEDULES = {
  six: { label: '6 days (Mon–Sat, Sun rest)', days: [null, 'push', 'pull', 'legs', 'push', 'pull', 'legs'] },
  three: { label: '3 days (Mon, Wed, Fri)', days: [null, 'push', null, 'pull', null, 'legs', null] }
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
