// Challenge presets. The player gets a hard budget, a taste profile and must-have items; the C++ backend
// computes the optimal basket + route and /api/evaluate compares the player's run to it.
export const CHALLENGES = [
  {
    id: 'student', title: 'ميزانية الطالب', emoji: '🎓', level: 'سهل',
    blurb: '220 جنيه بس! محتاج عيش وفول، وبتحب الألبان والمخبوزات من غير سناكس.',
    budget: 220,
    catWeights: { bakery: 3, dairy: 2, grocery: 2, snacks: -3 },
    avoid: [], liked: ['budget', 'egyptian'], disliked: [], mustHave: [1, 55],
  },
  {
    id: 'family', title: 'سلة الأسرة', emoji: '👨‍👩‍👧', level: 'متوسط',
    blurb: '600 جنيه لأسرة: لبن وأرز وشاي لازم، وخضار ولحوم وحاجات للبيت.',
    budget: 600,
    catWeights: { meat: 2, produce: 3, household: 1, dairy: 1, snacks: -1 },
    avoid: [], liked: ['family', 'staple'], disliked: [], mustHave: [9, 17, 45, 53],
  },
  {
    id: 'healthy', title: 'رجيم صحي', emoji: '🥗', level: 'صعب',
    blurb: '350 جنيه، أكل صحي ومن غير حلويات وسناكس خالص — وفيه حاجتين لازم تشتريهم.',
    budget: 350,
    catWeights: { produce: 3, dairy: 2, meat: 1, grocery: 1, snacks: -3, bakery: -1 },
    avoid: ['snacks'], liked: ['healthy', 'protein', 'fresh'], disliked: ['sweet'], mustHave: [17, 12],
  },
];
