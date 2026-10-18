// JISOGI card data.
// Genki Staff are transcribed from the physical cards (art in /cards).
// Script part titles, Trend, Network and Opportunity cards are stand-ins
// written for this digital version, following the rulebook's structure.

const GENRES = {
  A: { name: 'Action' },
  F: { name: 'Fantasy' },
  S: { name: 'Sci-Fi' },
  H: { name: 'Horror' },
  L: { name: 'Slice of Life' },
};

const STAFF_TYPES = {
  W: { name: 'Writer' },
  A: { name: 'Artist' },
  P: { name: 'Producer' },
  D: { name: 'Director' },
};

// gen: genre bonuses. k: 'pop' (♥) or 'lvl' (animation level). per: the "x" cards (per matching part).
// skill.on: action keys, 'release', 'upkeep' or 'passive'.
const G2 = (g) => [{ g, n: 2, k: 'pop' }];
const G3x = (g) => [{ g, n: 3, k: 'pop', per: true }];
const L1x = (g) => [{ g, n: 1, k: 'lvl', per: true }];
const D33 = (a, b) => [{ g: a, n: 3, k: 'pop' }, { g: b, n: 3, k: 'pop' }];

const GENKI = [
  // ---------- Writers ----------
  { id: 'ghost-stories', name: 'Loves ghost stories', type: 'W', gen: G3x('H') },
  { id: 'alien-lover', name: 'Alien lover', type: 'W', gen: G3x('S') },
  { id: 'melee-weapon-expert', name: 'Melee weapon expert', type: 'W', gen: G3x('F') },
  { id: 'platonic-love', name: 'Platonic love', type: 'W', gen: G3x('L') },
  { id: 'sports-fan', name: 'Sports fan', type: 'W', gen: G3x('A') },
  { id: 'trend-hunter', name: 'Trend hunter', type: 'W', gen: G2('S'),
    skill: { on: ['write', 'research'], text: 'Write, Research: +1 reveal, +1 pick, +2¥', gain: { reveal: 1, pick: 1, money: 2 } } },
  { id: 'visionary', name: 'Visionary', type: 'W', gen: G2('F'),
    skill: { on: ['write', 'research'], text: 'Write, Research: +2 reveal, +1 pick', gain: { reveal: 2, pick: 1 } } },
  { id: 'new-generation', name: 'New generation', type: 'W', gen: G2('H'),
    skill: { on: 'release', id: 'newgen', text: 'Anime Release: if following the Upcoming Trend, +4 Hype' } },
  { id: 'living-in-the-past', name: 'Living in the past', type: 'W', gen: G2('L'),
    skill: { on: 'release', id: 'pastlife', text: 'Anime Release: if following the Fading Trend, +5♥' } },
  { id: 'super-alternative', name: 'Super alternative', type: 'W', gen: G2('S'),
    skill: { on: 'release', id: 'superalt', text: 'Anime Release: if following the Upcoming or Fading Trend, +3♥' } },
  { id: 'history-geek', name: 'History geek', type: 'W', gen: G2('L'),
    skill: { on: 'upkeep', id: 'history', text: 'Upkeep Phase: 2 reveal, +1 pick' } },
  { id: 'chameleon', name: 'Chameleon', type: 'W', gen: [],
    skill: { on: 'release', id: 'chameleon', text: 'Anime Release: copy one of your other Staff genre bonuses' } },
  { id: 'words-magician', name: 'Words magician', type: 'W', gen: G2('F'),
    skill: { on: 'release', id: 'swap', text: 'Anime Release: may exchange any Script Part In Production with any in the common pool' } },

  // ---------- Artists ----------
  { id: 'creature-designer', name: 'Creature designer', type: 'A', gen: L1x('F') },
  { id: 'mecha-designer', name: 'Mecha designer', type: 'A', gen: L1x('S') },
  { id: 'quite-scary', name: 'Quite scary', type: 'A', gen: L1x('H') },
  { id: 'little-things', name: 'Love for the little things', type: 'A', gen: L1x('L') },
  { id: 'on-the-road', name: 'On the road', type: 'A', gen: L1x('A') },
  { id: 'secret-supplier', name: 'Secret Supplier', type: 'A', gen: G2('A'),
    skill: { on: 'passive', id: 'artistsFree', text: 'Production Phase: your Artists ignore High Demand Fees' } },
  { id: 'background-painter', name: 'Background painter', type: 'A', gen: G2('L'),
    skill: { on: ['animate'], text: 'Animate: if level 0, +1 level', gain: { lvl: 1 }, cond: (p) => p.level === 0 } },
  { id: 'digital-master', name: 'Digital master', type: 'A', gen: G2('S'),
    skill: { on: ['animate', 'outsource'], text: 'Animate, Outsource: +3¥', gain: { money: 3 } } },
  { id: 'better-under-pressure', name: 'Better under pressure', type: 'A', gen: G2('H'),
    skill: { on: 'release', id: 'pressure', text: 'Anime Release: if you have 2+ Debt cards, +1 level' } },
  { id: 'slow-starter', name: 'Slow starter', type: 'A', gen: G2('A'),
    skill: { on: ['animate'], text: 'Animate: if you have released an anime, +1 level', gain: { lvl: 1 }, cond: (p) => p.released.length > 0 } },
  { id: 'cultist', name: 'Cultist', type: 'A', gen: G2('H'),
    skill: { on: 'release', id: 'cultist', text: 'Anime Release: you may make a Cult release even with 1 match' } },
  { id: 'toy-lover', name: 'Toy lover', type: 'A', gen: G2('F'),
    skill: { on: 'release', id: 'toy', text: 'Anime Release: +1 Merchandise Deal' } },
  { id: 'influencer', name: 'Influencer', type: 'A', gen: G2('A'),
    skill: { on: 'release', id: 'influencer', text: 'Anime Release: +5¥ if your release has 15+♥' } },

  // ---------- Producers ----------
  { id: 'hard-negotiator', name: 'Hard negotiator', type: 'P', gen: [],
    skill: { on: 'passive', id: 'producersEarn', text: 'Production Phase: your Producers gain High Demand Fees instead of paying them' } },
  { id: 'connected-to-everything', name: 'Connected to everything', type: 'P', gen: [],
    skill: { on: ['staffing', 'networking'], id: 'connected', text: 'Staffing, Networking: also gain the Genki bonus of another action' } },
  { id: 'community-specialist', name: 'Community specialist', type: 'P', gen: [],
    skill: { on: 'release', id: 'community', text: 'Anime Release: +3¥ +3 Hype if you follow a Trend without the +4♥ token' } },
  { id: 'more-moreee', name: 'More! Moreee!', type: 'P', gen: [],
    skill: { on: 'release', id: 'moremore', text: 'Anime Release: if level 2 or less, +5♥' } },
  { id: 'international-connections', name: 'International connections', type: 'P', gen: [],
    skill: { on: ['strategize'], text: 'Strategize: +1 Network card, +4¥', gain: { net: 1, money: 4 } } },
  { id: 'dealer', name: 'Dealer', type: 'P', gen: [],
    skill: { on: ['networking'], text: 'Networking: +1 Merchandise Deal, +2¥', gain: { merch: 1, money: 2 } } },
  { id: 'social-butterfly', name: 'Social butterfly', type: 'P', gen: [],
    skill: { on: ['staffing', 'networking'], text: 'Staffing, Networking: +1 Network card, +1 Hype', gain: { net: 1, hype: 1 } } },
  { id: 'investment-wizard', name: 'Investment wizard', type: 'P', gen: [],
    skill: { on: 'upkeep', id: 'investment', text: 'Upkeep Phase: +1¥ per Debt card. Your debts do not gain interest' } },
  { id: 'invoice-police', name: 'Invoice police', type: 'P', gen: [],
    skill: { on: 'upkeep', id: 'invoice', text: 'Upkeep Phase: +1★ whenever you pay back a Debt card. Your debts do not gain interest' } },
  { id: 'meishi-master', name: 'Meishi master', type: 'P', gen: [],
    skill: { on: 'release', id: 'meishi', text: 'Anime Release: +1♥ per Hype spent to raise ♥' } },
  { id: 'cold-blooded', name: 'Cold-blooded', type: 'P', gen: [],
    skill: { on: 'upkeep', id: 'cold', text: 'Upkeep Phase: -1¥ salary per Genki Staff' } },
  { id: 'mother-hen', name: 'Mother hen', type: 'P', gen: [],
    skill: { on: 'upkeep', id: 'hen', text: 'Upkeep Phase: +6¥, -1¥ per Dead-Inside Staff' } },
  { id: 'analog-only', name: 'Analog only', type: 'P', gen: [],
    skill: { on: 'release', id: 'analog', text: 'Anime Release: +1¥ per Hype spent to raise ♥' } },
  { id: 'fortune-teller', name: 'Fortune teller', type: 'P', gen: [],
    skill: { on: 'passive', id: 'fortune', text: 'Production Phase: whenever you draw Network cards, draw +1 and discard 1 from your hand' } },

  // ---------- Directors ----------
  { id: 'money-driven', name: 'Money driven', type: 'D',
    gen: ['A', 'F', 'H', 'S', 'L'].map((g) => ({ g, n: 1, k: 'pop' })) },
  { id: 'head-in-space', name: 'Head in space', type: 'D', gen: D33('H', 'S') },
  { id: 'dark-works-yet-joyful', name: 'Dark works yet joyful', type: 'D', gen: D33('H', 'L') },
  { id: 'overly-excited', name: 'Overly excited', type: 'D', gen: D33('A', 'S') },
  { id: 'nature-lover', name: 'Nature lover', type: 'D', gen: D33('F', 'L') },
  { id: 'dungeon-master', name: 'Dungeon master', type: 'D', gen: D33('A', 'F') },
  { id: 'age-impossible', name: 'Age impossible to guess', type: 'D', gen: D33('F', 'H') },
  { id: 'politician', name: 'Politician', type: 'D', gen: D33('S', 'L') },
  { id: 'fitness-fanatic', name: 'Fitness fanatic', type: 'D', gen: D33('A', 'L') },
  { id: 'weird-angle', name: 'Weird angle', type: 'D', gen: D33('A', 'H') },
  { id: 'pretentious-references', name: 'Pretentious references', type: 'D', gen: D33('F', 'S') },
  { id: 'harmony-idol', name: 'Harmony bringer idol', type: 'D', gen: [],
    skill: { on: 'release', id: 'idol', text: 'Anime Release: +5 Hype, -1 Hype per Dead-Inside Staff' } },
];

const DEAD = {
  W: { id: 'dead-writer', name: 'Dead-Inside', type: 'W', dead: true, gen: [] },
  A: { id: 'dead-artist', name: 'Dead-Inside', type: 'A', dead: true, gen: [] },
  P: { id: 'dead-producer', name: 'Dead-Inside', type: 'P', dead: true, gen: [] },
  D: { id: 'dead-director', name: 'Dead-Inside', type: 'D', dead: true, gen: [] },
};

const SCRIPT_TYPES = { set: 'Setting', plot: 'Plot', twist: 'Twist' };

const SCRIPT_NAMES = {
  set: {
    A: ['Martial Arts Tournament', 'Underground Fight Club', 'War-Torn Border Town', 'Pirate Archipelago'],
    F: ['Floating Sky Kingdom', 'Witch Academy', 'Enchanted Forest', "Dragon's Mountain Pass"],
    S: ['Orbital Colony', 'Neo-Tokyo 2099', 'Big City Corporation', 'Deep-Sea Research Base'],
    H: ['Abandoned Hospital', 'Cursed Mountain Village', 'Haunted Boarding School', 'Fog-Bound Lighthouse'],
    L: ['Countryside Village', 'Seaside Café', 'Shared Tokyo Apartment', 'Small-Town Bathhouse'],
  },
  plot: {
    A: ['A rookie must win the national championship', 'A disgraced swordsman seeks revenge', 'A courier must cross a warzone', 'Rival gangs fight over one city block'],
    F: ['Transported to a magical world, must adapt to a new life', 'A young witch opens a delivery service', 'The chosen hero refuses the call', 'A cursed prince must break the spell'],
    S: ['A failed experiment leads to a parallel universe', 'A pilot bonds with a sentient mecha', 'An android learns to feel', 'Colonists lose contact with Earth'],
    H: ['Students vanish one by one', 'A family moves into a house that wants them gone', 'Trapped inside a social survival game', 'Survivors hide from something in the dark'],
    L: ['A retired chef teaches a widower to cook', 'Three friends start a band', 'A shy girl joins the gardening club', 'A salaryman quits to run a ramen stall'],
  },
  twist: {
    A: ['The mentor was the final boss all along', 'The tournament is rigged by the government', 'The weakest fighter awakens a hidden power', 'The hero dies at the halfway point'],
    F: ['The magic world is a dying game server', 'A mysterious companion will help out', 'The dragon is the last of its kind', 'Magic is fueled by forgotten memories'],
    S: ['It was a simulation the entire time', 'The AI has been manipulating the crew', 'Time loops every seven days', 'The aliens are humans from the future'],
    H: ['The narrator has been dead since episode one', 'The monster is protecting them', 'Everyone in town is part of the cult', 'The curse spreads to whoever watches'],
    L: ['An old letter reveals a family secret', 'The café closes at the end of the season', 'The two rivals were in love all along', 'The quiet neighbor is a famous mangaka'],
  },
};

const TRENDS = [
  ['Isekai Wave', 'F', 'F', 'A'], ['Mecha Revival', 'S', 'A', 'S'], ['Cozy Café Boom', 'L', 'L', 'F'],
  ['J-Horror Comeback', 'H', 'H', 'L'], ['Cyberpunk Noir', 'S', 'H', 'A'], ['Magical Girls', 'F', 'L', 'A'],
  ['Battle Shōnen', 'A', 'A', 'F'], ['Space Opera', 'S', 'S', 'A'], ['Idol Craze', 'L', 'L', 'S'],
  ['Dark Fantasy', 'F', 'H', 'A'], ['Time Loop Mysteries', 'S', 'L', 'H'], ['Sports Spirit', 'A', 'L', 'L'],
  ['Ghost Stories', 'H', 'F', 'L'], ['Post-Apocalypse', 'S', 'H', 'A'], ['School Comedy', 'L', 'A', 'F'],
  ['Yōkai Tales', 'F', 'H', 'H'], ['Robot Romance', 'S', 'L', 'F'], ['Death Games', 'H', 'A', 'S'],
  ['Iyashikei', 'L', 'F', 'S'], ['Kung-Fu Classics', 'A', 'A', 'H'],
].map(([name, ...g]) => ({ name, g }));

// on: actions that can trigger the card. gain: reward bundle.
const NETWORK = [
  { name: 'Government Rescue', on: ['networking', 'strategize'], gain: { money: 4 } },
  { name: 'New Technology Research', on: ['animate', 'outsource'], gain: { lvl: 1 } },
  { name: 'Senpai Training', on: ['write'], gain: {}, per: { lvl: 1 }, text: '+1 level per anime you have released' },
  { name: 'Achievement Award', on: ['write', 'research'], gain: {}, per: { money: 3 }, text: '+3¥ per anime you have released' },
  { name: 'Fan Translation Buzz', on: ['write', 'research'], gain: { pick: 1 } },
  { name: "Writers' Retreat", on: ['write'], gain: { reveal: 2, pick: 1 } },
  { name: 'Overtime Crunch', on: ['animate'], gain: { lvl: 1, hype: 1 } },
  { name: 'Cheap Overseas Studio', on: ['outsource'], gain: { money: 3 } },
  { name: 'Toy Company Meeting', on: ['outsource', 'networking'], gain: { merch: 1 } },
  { name: 'Talent Agency', on: ['staffing'], gain: { money: 2, hype: 1 } },
  { name: 'Industry Party', on: ['networking'], gain: { hype: 3 } },
  { name: 'Viral Teaser', on: ['animate', 'write'], gain: { hype: 3 } },
  { name: 'Investor Lunch', on: ['strategize'], gain: { money: 3 } },
  { name: 'Convention Booth', on: ['strategize', 'staffing'], gain: { merch: 1 } },
  { name: 'Sakuga Legend', on: ['animate'], gain: { lvl: 1, money: 1 } },
  { name: 'Bank Connection', on: ['networking', 'staffing'], gain: { money: 4 } },
  { name: 'Library Deep Dive', on: ['research'], gain: { reveal: 2, pick: 1 } },
  { name: 'Ex-Colleague Favor', on: ['staffing', 'networking'], gain: { hype: 3 } },
  { name: 'Production Committee', on: ['outsource', 'strategize'], gain: { money: 4 } },
  { name: 'Studio Tour', on: ['research', 'networking'], gain: { merch: 1 } },
];

// test(p, rel) runs right after a release. rel = the release record.
const OPPORTUNITIES = [
  { name: 'Flawless Execution', text: 'Release with 6 levels', rep: 2, test: (p, r) => r.level >= 6 },
  { name: 'Merchandise Mogul', text: 'Have 4 active Merchandise Deals', rep: 2, test: (p) => p.merchActive >= 4 },
  { name: 'Cult Classic', text: 'Make a Cult release', rep: 2, test: (p, r) => r.cult },
  { name: 'Perfect Timing', text: 'Release with 3 genre matches', rep: 1, test: (p, r) => !r.cult && r.matches >= 3 },
  { name: 'Blockbuster', text: 'Release with 25+♥', rep: 2, test: (p, r) => r.pop >= 25 },
  { name: 'Prolific Studio', text: 'Have released 3 anime', rep: 2, test: (p) => p.released.length >= 3 },
  { name: 'Genre Purist', text: 'Release with 3 parts of one genre', rep: 2, test: (p, r) => new Set(r.genres).size === 1 },
  { name: 'Eclectic Mix', text: 'Release with 3 different genres', rep: 1, test: (p, r) => new Set(r.genres).size === 3 },
  { name: 'Dream Team', text: 'Have no Dead-Inside Staff', rep: 2, test: (p) => p.staff.every((s) => !s.card.dead) },
  { name: 'Full House', text: 'Have 6 Staff', rep: 1, test: (p) => p.staff.length >= 6 },
  { name: 'Debt Free', text: 'Have no Debt cards', rep: 1, test: (p) => p.debts.length === 0 },
  { name: 'Hype Machine', text: 'Spend 5+ Hype on one release', rep: 1, test: (p, r) => r.hypeSpent >= 5 },
];

// Solo challenges, transcribed from the Solo Challenge cards.
// hd: High-Demand tokens placed each Production Phase; dbl: 2 tokens per space.
const SOLO = [
  { n: 1, name: 'Learning the Game', goal: 'Score 10+★', rounds: 3, hd: 2, dbl: false,
    rules: ['Start the game with 5¥ and no Debt card.', 'You may score any amount of Opportunity cards during the Release Phase.', 'Reveal 1 Script Part in every pile at the very end of the Upkeep Phase.'],
    money: 5, debts: 0, anyOpps: true, upkeepReveal: true, check: (p) => score(p) >= 10 },
  { n: 2, name: 'Low Pressure', goal: 'Score 15+★ and release 3 anime', rounds: 3, hd: 3, dbl: false,
    rules: ['Start with all 6 Opportunity cards revealed.', 'You may score any amount of Opportunity cards during the Release Phase.', 'Reveal 1 Script Part in every pile at the very end of the Upkeep Phase.'],
    allOpps: true, anyOpps: true, upkeepReveal: true, check: (p) => score(p) >= 15 && p.released.length >= 3 },
  { n: 3, name: 'Media Pressure', goal: 'Score 29★ with no Debt cards', rounds: 4, hd: 3, dbl: true,
    rules: ['Reveal 1 Script Part in every pile at the very end of the Upkeep Phase.', 'At the start of the Upkeep, lose 1 Script Part from your Storage (if possible) per Dead-Inside Staff you own.', 'Right after, gain 1 Hype per Genki Staff you own.'],
    upkeepReveal: true, media: true, check: (p) => score(p) >= 29 && p.debts.length === 0 },
  { n: 4, name: 'Bankrupt', goal: 'Score 15+★, have no Debt cards and release 3+ anime', rounds: 4, hd: 3, dbl: false,
    rules: ['Start the game with 4 Debt cards.', 'Replace your initial Dead-Inside Producer with the "Invoice police" Producer.'],
    debts: 4, replace: { P: 'invoice-police' }, check: (p) => score(p) >= 15 && p.debts.length === 0 && p.released.length >= 3 },
  { n: 5, name: 'Studio Boom', goal: 'Score 29★', rounds: 4, hd: 3, dbl: true,
    rules: ['Start with all 6 Opportunity cards revealed.', 'During the Release Phase, if you do not fulfill an Opportunity card, you must discard one.', 'Replace your initial Dead-Inside Artist with the "Influencer" Artist.', 'Start the game with 2 Debt cards.'],
    allOpps: true, boom: true, debts: 2, replace: { A: 'influencer' }, check: (p) => score(p) >= 29 },
  { n: 6, name: 'Crunch Time', goal: 'Score 25+★', rounds: 4, hd: 3, dbl: true,
    rules: ['Whenever a Genki Staff performs an action, choose whether to gain its Genki bonus.', 'Whenever a Staff provides the Genki bonus, replace it with a Dead-Inside Staff of the same type.', 'You may pay 1¥ to move a Staff from the common pool to the bottom of its deck.', 'Replace your initial Dead-Inside Producer with the "Cold-blooded" Producer.'],
    crunch: true, replace: { P: 'cold-blooded' }, check: (p) => score(p) >= 25 },
  { n: 7, name: 'Trend Manipulation', goal: 'Score 25+★', rounds: 4, hd: 2, dbl: true,
    rules: ['You can only release Cult anime.', 'Replace your initial Dead-Inside Artist with the "Cultist" Artist.', 'You may pay 2¥ during the Upkeep Phase to discard a Trend card and draw a new Upcoming Trend.', 'You may keep any amount of Script Parts in your Storage.'],
    cultOnly: true, trendBuy: true, noStorageCap: true, replace: { A: 'cultist' }, check: (p) => score(p) >= 25 },
  { n: 8, name: 'Award Machine', goal: 'Score 29★ and own 6 Genki Staff', rounds: 4, hd: 3, dbl: true,
    rules: ['Return the Director Genki Staff deck to the box.', 'Releases with less than 20♥ give no reward.', 'Replace your initial Dead-Inside Director with the "Money driven" Director.'],
    noDirectors: true, min20: true, replace: { D: 'money-driven' }, check: (p) => score(p) >= 29 && p.staff.filter((s) => !s.card.dead).length >= 6 },
];
