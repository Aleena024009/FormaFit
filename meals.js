'use strict';

// Kerala meal plan, timed for a 5:00 wake-up and 5:30 workout.
// kcal and protein are rough estimates per option; edit them in the app if needed.
// An option with `water` adds to the water count instead of the food log.
const MEAL_TEMPLATE = [
  {
    id: 'wake',
    time: '05:00',
    name: 'Wake up',
    note: 'Before the gym.',
    options: [
      { text: '1 glass warm water', water: 250 },
      { text: 'Warm water with fenugreek (uluva)', water: 250 },
      { text: 'Warm water with lemon', water: 250 }
    ]
  },
  {
    id: 'workout',
    time: '05:30',
    name: 'Workout',
    workout: true,
    note: 'If you feel weak, have 1 small banana or 2 dates before you start.',
    options: [
      { text: '1 small banana', kcal: 90, protein: 1 },
      { text: '2 dates', kcal: 45, protein: 0 }
    ]
  },
  {
    id: 'breakfast',
    time: '07:00',
    name: 'Breakfast',
    note: 'Right after the gym. Always add the boiled egg. Tea or coffee with half a spoon of sugar.',
    options: [
      { text: '2 dosa + kadala curry + 1 boiled egg', kcal: 450, protein: 19 },
      { text: '2 idli + cherupayar curry + 1 boiled egg', kcal: 350, protein: 19 },
      { text: 'Puttu + kadala curry + 1 boiled egg', kcal: 430, protein: 17 },
      { text: '2 appam + kadala curry + 1 boiled egg', kcal: 470, protein: 18 },
      { text: 'Tea / coffee (half spoon sugar)', kcal: 40, protein: 2 }
    ]
  },
  {
    id: 'midmorning',
    time: '10:30',
    name: 'Mid-morning',
    note: 'Pick one.',
    options: [
      { text: '1 glass coconut water (karikku)', kcal: 45, protein: 0 },
      { text: '1 glass buttermilk (sambharam)', kcal: 40, protein: 2 },
      { text: '1 apple', kcal: 80, protein: 0 },
      { text: '1 guava', kcal: 60, protein: 2 },
      { text: '1 orange', kcal: 60, protein: 1 }
    ]
  },
  {
    id: 'lunch',
    time: '13:00',
    name: 'Lunch',
    note: 'Rice: ¾ of what you usually eat (matta / kuthari). Half the plate should be vegetables. Thoran or mezhukkupuratti with less oil.',
    options: [
      { text: '¾ rice + thoran + fish curry', kcal: 430, protein: 26 },
      { text: '¾ rice + thoran + chicken curry', kcal: 480, protein: 27 },
      { text: '¾ rice + mezhukkupuratti + parippu curry', kcal: 410, protein: 12 }
    ]
  },
  {
    id: 'evening',
    time: '16:30',
    name: 'Evening snack',
    note: 'No fried snacks (ennakkadi) at all.',
    options: [
      { text: 'Tea / coffee (half spoon sugar)', kcal: 40, protein: 2 },
      { text: 'Handful boiled cherupayar', kcal: 110, protein: 7 },
      { text: 'Handful boiled kadala', kcal: 120, protein: 7 },
      { text: 'Handful peanuts (nilakkadala)', kcal: 160, protein: 7 },
      { text: 'Half steamed ethapazham', kcal: 60, protein: 1 }
    ]
  },
  {
    id: 'dinner',
    time: '20:00',
    name: 'Dinner',
    note: 'Finish by 8:30 PM.',
    options: [
      { text: '2 wheat chapati + vegetable curry', kcal: 300, protein: 9 },
      { text: '2 wheat chapati + chicken curry', kcal: 400, protein: 28 },
      { text: 'Half of lunch rice + thoran + fish curry', kcal: 330, protein: 22 },
      { text: 'Half of lunch rice + thoran + 1 egg', kcal: 260, protein: 10 }
    ]
  }
];

const FOOD_RULES = [
  ['No need to stop rice and sweets', 'Just eat 20–30% less of them than you do now. Stopping completely is hard to keep up.'],
  ['Less fried food', 'Have fish and chicken as curry instead of fried. You get the same protein with far fewer calories.'],
  ['Half the plate vegetables', 'Fill half your lunch and dinner plate with thoran, mezhukkupuratti or vegetable curry.'],
  ['Half a spoon of sugar', 'In every tea and coffee.'],
  ['No ennakkadi', 'Skip fried evening snacks like pazhampori, vada and banana chips.']
];
