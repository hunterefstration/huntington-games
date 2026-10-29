
"use strict";
/* Bean & Brew Tycoon - Visual Edition (polished build). One self-contained file, pure ASCII. */

// ======================================================================
// CONSTANTS AND DATA
// ======================================================================
const GRID_W = 15, GRID_H = 15, TS = 32, TICK_MS = 200;
const DAY_TICKS = 1200;                 // one game day = 240 seconds
const SAVE_VER = 5;                     // v5: career, latte art, championships (v4: cities, recipes, staff skills, franchises; older saves migrate)
const GAME_VER = '2.0';
const MAP_PX = GRID_W * TS, FRAME = 8, CANVAS_PX = MAP_PX + FRAME * 2;
const BREW_TICKS = 15;                  // 3 seconds
const WAIT_TICKS = 75;                  // 15 seconds
const MAX_SHOPS = 8;
const QUEUE_PER_COUNTER = 2;           // one customer being served plus one waiting in line
const TILE = { EMPTY: 0, FLOOR: 1, DOOR: 2, COUNTER: 3, BREWER: 4, PARKING: 5, PLANT: 6, TABLE: 7, RUG: 8, LAMP: 9, SHELF: 10, SOFA: 11, ART: 12, FOUNTAIN: 13, PIANO: 14, AQUARIUM: 15,
  FLOWERS: 16, PARASOL: 17, PUMPKIN: 18, SNOWMAN: 19, TROPHY: 20 };
const TILE_MAX = 20;
const AMB_CAP = 50;                     // most ambience a shop can have (decorations)
const BEANS = ['beans', 'beans_premium', 'beans_luxury'];
const COFFEE = ['brewed', 'brewed_premium', 'brewed_luxury'];
const TIER_NAME = ['Basic', 'Premium', 'Luxury'];
const TIER_COLOR = ['#a16207', '#f59e0b', '#a855f7'];
const SALE = [5, 15, 40];
const SUPPLY = {
  beans: { name: 'Basic Beans', short: 'Basic', price: 10, icon: 'bean', col: 'stone' },
  beans_premium: { name: 'Premium Beans', short: 'Prem.', price: 25, icon: 'bean', col: 'amber' },
  beans_luxury: { name: 'Luxury Beans', short: 'Lux.', price: 50, icon: 'bean', col: 'violet' },
  milk: { name: 'Milk', short: 'Milk', price: 10, icon: 'milk', col: 'blue' },
  cups: { name: 'Cups', short: 'Cups', price: 10, icon: 'cup', col: 'stone' },
  // pantry: extra ingredients for recipe specials (smaller packs)
  choc: { name: 'Chocolate', short: 'Choc', price: 12, icon: 'choc', pantry: true },
  caramel: { name: 'Caramel', short: 'Caramel', price: 12, icon: 'drop', pantry: true },
  cinnamon: { name: 'Cinnamon', short: 'Cinnamon', price: 8, icon: 'leaf', pantry: true },
  ice: { name: 'Ice', short: 'Ice', price: 4, icon: 'snow', pantry: true },
  flour: { name: 'Flour', short: 'Flour', price: 8, icon: 'wheat', pantry: true },
  vanilla: { name: 'Vanilla', short: 'Vanilla', price: 18, icon: 'drop', pantry: true, rank: 1 },
  berries: { name: 'Berries', short: 'Berries', price: 18, icon: 'berry', pantry: true, rank: 1 },
  matcha: { name: 'Matcha', short: 'Matcha', price: 30, icon: 'leaf', pantry: true, rank: 2 },
  // seasonal pantry: only sold in their season (leftovers can still be used)
  honey: { name: 'Honey', short: 'Honey', price: 14, icon: 'drop', pantry: true, season: 0 },
  lemon: { name: 'Lemon', short: 'Lemon', price: 10, icon: 'lemon', pantry: true, season: 1 },
  pumpkin: { name: 'Pumpkin', short: 'Pumpkin', price: 14, icon: 'pumpkin', pantry: true, season: 2 },
  mint: { name: 'Peppermint', short: 'Mint', price: 14, icon: 'candy', pantry: true, season: 3 },
  // 2.1 local pantry: only sold in shops in their own city (leftovers can still be used anywhere)
  maple: { name: 'Maple Syrup', short: 'Maple', price: 12, icon: 'leaf', pantry: true, city: 'home' },
  oat: { name: 'Oat Milk', short: 'Oat', price: 9, icon: 'wheat', pantry: true, city: 'campus' },
  coconut: { name: 'Coconut', short: 'Coconut', price: 14, icon: 'berry', pantry: true, city: 'beach' },
  marsh: { name: 'Marshmallows', short: 'Marsh.', price: 12, icon: 'candy', pantry: true, city: 'pines' },
  nitro: { name: 'Nitro Keg', short: 'Nitro', price: 24, icon: 'snow', pantry: true, city: 'metro' },
  gold: { name: 'Edible Gold', short: 'Gold', price: 60, icon: 'sparkle', pantry: true, city: 'peak' }
};
const MAIN_SUP = Object.keys(SUPPLY).filter(k => !SUPPLY[k].pantry);
const PANTRY = Object.keys(SUPPLY).filter(k => SUPPLY[k].pantry);
const BASE_PRICES = {
  floor: 2, door: 50, counter: 100, brewer: 150, parking: 50, plant: 25, table: 60,
  rug: 30, lamp: 45, shelf: 90, sofa: 140, art: 220, fountain: 450, piano: 900, aquarium: 1600,
  flowers: 160, parasol: 160, pumpkin: 160, snowman: 160, trophy: 250,
  newLocation: 1000,
  staffBase: { barista: 100, cashier: 150, restocker: 200, manager: 1200 }
};
const FREE_ALLOW = { door: 1, floor: 6, counter: 1, brewer: 1, parking: 1, plant: 0, table: 0 };
const THEMES = [
  { name: 'Grass', bg: '#22c55e', deco: 'flowers' },
  { name: 'Sand', bg: '#eab308', deco: 'cactus' },
  { name: 'Forest', bg: '#15803d', deco: 'trees' },
  { name: 'Midnight', bg: '#1e1b4b', deco: 'stars' },
  { name: 'Clay', bg: '#9a3412', deco: 'rocks' },
  { name: 'Tundra', bg: '#94a3b8', deco: 'snow' }
];
const RANKS = [
  { n: 'Street Cart', at: 0 }, { n: 'Corner Cafe', at: 300 }, { n: 'Neighborhood Favorite', at: 1500 },
  { n: 'Local Chain', at: 5000 }, { n: 'City Roaster', at: 15000 }, { n: 'Coffee Mogul', at: 40000 },
  { n: 'Bean Baron', at: 100000 }, { n: 'Coffee Legend', at: 250000 }
];
const ROLES = {
  barista: { name: 'Barista', desc: 'Brews coffee automatically', icon: 'user', col: '#f97316', max: 8 },
  cashier: { name: 'Cashier', desc: 'Serves waiting customers', icon: 'usercheck', col: '#a855f7', max: 8 },
  restocker: { name: 'Restocker', desc: 'Re-orders supplies when low', icon: 'refresh', col: '#10b981', max: 8 },
  manager: { name: 'Manager', desc: 'Runs the shop, earns while away', icon: 'briefcase', col: '#0ea5e9', max: 1, rank: 2 }
};
// Staff skill tree: every staff member levels up (work or training) and spends points in 3 branches of 5 ranks.
const STAFF_MAX_LV = 16;
const SKILLS = {
  spd: { name: 'Speed', icon: 'bolt', col: '#60a5fa' },
  qua: { name: 'Quality', icon: 'star', col: '#fbbf24' },
  cha: { name: 'Charm', icon: 'heart', col: '#f472b6' }
};
const SKILL_FX = {   // [effect per rank, rank-5 perk]
  barista: {
    spd: ['Brews 7% faster per rank.', 'Double Shot: 20% of brews make 2 cups.'],
    qua: ['Every sale in this shop pays 4% more per rank (best barista counts) and the shop rating rises.', 'Latte Art: specials sell for 15% more, some brews get free latte art, +3 in championships.'],
    cha: ['Customers wait 5% longer per rank (best barista counts).', 'Fan Club: 10% more customers visit.']
  },
  cashier: {
    spd: ['Their line loses patience 8% slower per rank.', 'Express Lane: their line is 30% more patient on top.'],
    qua: ['Sales they make pay 3% more per rank.', 'Critic Ready: can serve Coffee Critics for you.'],
    cha: ['+4% tip chance per rank on their sales.', 'Big Tipper: tips they get are 50% bigger.']
  },
  restocker: {
    spd: ['Keeps 4 more of everything in stock per rank.', 'Bulk Runner: orders 2 packs at a time.'],
    qua: ['Supplies they order cost 4% less per rank.', 'Haggler: an extra 15% off every order.'],
    cha: ['3% chance per rank that suppliers add a free pack.', 'Supplier Friend: free packs twice as often.']
  },
  manager: {
    spd: ['Staff in this shop earn 10% more XP per rank.', 'Mentor: training here takes half the time.'],
    qua: ['Shop earns 6% more while you are away per rank.', 'Head Chef: specials sell for 10% more.'],
    cha: ['3% more customers per rank.', 'Local Hero: +1 extra reputation for every favorite served.']
  }
};
const STAFF_NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jade', 'Kai', 'Lena', 'Milo', 'Nia', 'Omar', 'Pia', 'Quinn', 'Remy', 'Sia', 'Theo', 'Uma', 'Vic', 'Wren', 'Zed'];
// likes = flavors this kind of customer can have as a favorite (each customer picks one); look fields drive drawCustomer
const KINDS = {
  regular: { name: 'Regular', pl: 'Regulars', pay: 1, wait: 1, tip: 0.10, body: '#3b82f6', trim: '#1d4ed8', likes: ['cozy', 'sweet', 'strong'] },
  student: { name: 'Student', pl: 'Students', pay: 0.9, wait: 1.35, tip: 0.03, body: '#22c55e', trim: '#15803d', pack: '#be123c', likes: ['sweet', 'food', 'iced'] },
  business: { name: 'Business', pl: 'Business folks', pay: 1.15, wait: 0.75, tip: 0.25, body: '#475569', trim: '#ef4444', tie: '#ef4444', likes: ['strong', 'fancy'] },
  tourist: { name: 'Tourist', pl: 'Tourists', pay: 1.1, wait: 1.1, tip: 0.35, body: '#f59e0b', trim: '#fde68a', hat: 'straw', likes: ['iced', 'food', 'sweet'] },
  star: { name: 'Celebrity', pl: 'Celebrities', pay: 3, wait: 1.3, tip: 0.6, body: '#ec4899', trim: '#fbcfe8', shades: true, likes: ['fancy'] },
  critic: { name: 'Coffee Critic', pl: 'Critics', pay: 3, wait: 1.5, tip: 0, body: '#f8fafc', trim: '#eab308', hat: 'top', likes: ['fancy'] },
  surfer: { name: 'Surfer', pl: 'Surfers', pay: 1.05, wait: 1.2, tip: 0.3, body: '#14b8a6', trim: '#fde047', shades: true, likes: ['iced', 'tea'] },
  hiker: { name: 'Hiker', pl: 'Hikers', pay: 1.0, wait: 1.15, tip: 0.15, body: '#65a30d', trim: '#365314', hat: 'cap', hatCol: '#3f6212', pack: '#92400e', likes: ['food', 'cozy', 'tea'] },
  influencer: { name: 'Influencer', pl: 'Influencers', pay: 1.3, wait: 0.85, tip: 0.3, body: '#d946ef', trim: '#fae8ff', phone: true, likes: ['fancy', 'iced', 'tea'] },
  skier: { name: 'Skier', pl: 'Skiers', pay: 1.35, wait: 1.0, tip: 0.3, body: '#dc2626', trim: '#f8fafc', hat: 'beanie', hatCol: '#1d4ed8', likes: ['cozy', 'fancy', 'food'] },
  prof: { name: 'Professor', pl: 'Professors', pay: 1.0, wait: 1.25, tip: 0.12, body: '#7c5a3a', trim: '#e7d8c4', glasses: true, tie: '#7f1d1d', likes: ['strong', 'cozy', 'tea'] }
};
const TAG_NAME = { sweet: 'sweet', iced: 'iced', fancy: 'fancy', strong: 'strong', food: 'pastries', cozy: 'cozy', tea: 'tea' };
// Cities: every shop and franchise lives in one. Different customers, prices, rent and unlock costs.
const CITIES = [
  { id: 'home', name: 'Maple Grove', short: 'Maple', theme: 'Grass', rank: 0, unlock: 0, rent: 0, price: 1, spawn: 1, supply: 1, fr: 2000, frMult: 1, sea: [1.05, 1, 1, 1],
    desc: 'Your quiet hometown. No rent and friendly locals.', kinds: { regular: 50, student: 22, business: 16, tourist: 10 } },
  { id: 'campus', name: 'College Hill', short: 'Campus', theme: 'Clay', rank: 1, unlock: 1200, rent: 30, price: 0.85, spawn: 1.35, supply: 0.9, fr: 2500, frMult: 1.2, sea: [1, 0.8, 1.25, 1],
    desc: 'Students and professors everywhere: huge crowds, cheap rent, low prices.', kinds: { student: 55, prof: 18, regular: 20, influencer: 4 } },
  { id: 'beach', name: 'Sunset Beach', short: 'Beach', theme: 'Sand', rank: 2, unlock: 3500, rent: 80, price: 1.15, spawn: 1.1, supply: 1.05, fr: 4000, frMult: 1.7, sea: [1.05, 1.35, 0.9, 0.7],
    desc: 'Surfers and tourists who love iced drinks and tip big.', kinds: { surfer: 38, tourist: 34, regular: 18, influencer: 6 } },
  { id: 'pines', name: 'Pine Ridge', short: 'Pines', theme: 'Forest', rank: 3, unlock: 6000, rent: 60, price: 1.1, spawn: 0.95, supply: 1.1, fr: 5000, frMult: 1.9, sea: [1.1, 1, 1.3, 0.85],
    desc: 'A mountain town full of hungry hikers. Pastries and cozy drinks sell great.', kinds: { hiker: 45, regular: 25, tourist: 18, prof: 6 } },
  { id: 'metro', name: 'Metro Downtown', short: 'Metro', theme: 'Midnight', rank: 4, unlock: 15000, rent: 250, price: 1.45, spawn: 1.2, supply: 1.15, fr: 9000, frMult: 3.2, prem: 0.12, sea: [1, 0.95, 1, 1.1],
    desc: 'A busy, impatient business crowd. High prices and high rent.', kinds: { business: 46, influencer: 16, regular: 24, tourist: 10 } },
  { id: 'peak', name: 'Snowpeak Resort', short: 'Snowpeak', theme: 'Tundra', rank: 5, unlock: 40000, rent: 400, price: 1.75, spawn: 0.85, supply: 1.3, fr: 15000, frMult: 4.5, lux: 0.15, sea: [0.8, 0.75, 1, 1.45],
    desc: 'Rich skiers who want Luxury drinks and cozy food. Very pricey to run.', kinds: { skier: 48, tourist: 20, business: 16, star: 3 } }
];
const CITY_BY_ID = {}; CITIES.forEach(c => { CITY_BY_ID[c.id] = c; });
// Recipes: discovered in the Recipe Lab by combining a coffee base (-1 = none) with pantry ingredients.
const RECIPES = [
  { id: 'mocha', name: 'Mocha', base: 0, ing: ['choc'], price: 9, tags: ['sweet', 'cozy'], col: '#7c3f1d' },
  { id: 'caramel', name: 'Caramel Latte', base: 0, ing: ['caramel'], price: 9, tags: ['sweet'], col: '#d97706' },
  { id: 'iced', name: 'Iced Coffee', base: 0, ing: ['ice'], price: 7, tags: ['iced'], col: '#7dd3fc' },
  { id: 'spiced', name: 'Spiced Latte', base: 0, ing: ['cinnamon', 'vanilla'], price: 13, tags: ['cozy', 'sweet'], col: '#b45309' },
  { id: 'cortado', name: 'Cinnamon Cortado', base: 1, ing: ['cinnamon'], price: 20, tags: ['strong', 'cozy'], col: '#9a3412' },
  { id: 'vcloud', name: 'Vanilla Cloud', base: 1, ing: ['vanilla'], price: 22, tags: ['fancy', 'sweet'], col: '#fde68a' },
  { id: 'frappe', name: 'Caramel Frappe', base: 1, ing: ['ice', 'caramel'], price: 25, tags: ['iced', 'sweet'], col: '#fbbf24' },
  { id: 'fusion', name: 'Matcha Espresso', base: 1, ing: ['matcha'], price: 27, tags: ['strong', 'fancy'], col: '#4d7c0f' },
  { id: 'royal', name: 'Royal Mocha', base: 2, ing: ['choc', 'vanilla'], price: 58, tags: ['fancy', 'sweet'], col: '#6b21a8' },
  { id: 'affogato', name: 'Affogato', base: 2, ing: ['vanilla', 'ice'], price: 54, tags: ['fancy', 'iced'], col: '#e9d5ff' },
  { id: 'hotchoc', name: 'Hot Chocolate', base: -1, ing: ['choc'], price: 6, tags: ['sweet', 'cozy'], col: '#78350f' },
  { id: 'matcha', name: 'Matcha Latte', base: -1, ing: ['matcha'], price: 12, tags: ['tea', 'fancy'], col: '#65a30d' },
  { id: 'smoothie', name: 'Berry Smoothie', base: -1, ing: ['berries', 'ice'], price: 12, tags: ['iced', 'tea'], col: '#db2777' },
  { id: 'roll', name: 'Cinnamon Roll', base: -1, ing: ['flour', 'cinnamon'], price: 8, tags: ['food', 'cozy'], col: '#d6a15a', food: true },
  { id: 'cookie', name: 'Choc Chip Cookie', base: -1, ing: ['flour', 'choc'], price: 7, tags: ['food', 'sweet'], col: '#92400e', food: true },
  { id: 'muffin', name: 'Berry Muffin', base: -1, ing: ['flour', 'berries'], price: 10, tags: ['food', 'sweet'], col: '#9d174d', food: true },
  { id: 'brownie', name: 'Caramel Brownie', base: -1, ing: ['flour', 'choc', 'caramel'], price: 15, tags: ['food', 'sweet', 'cozy'], col: '#451a03', food: true },
  { id: 'mcake', name: 'Matcha Cake', base: -1, ing: ['flour', 'matcha', 'vanilla'], price: 19, tags: ['food', 'fancy'], col: '#84cc16', food: true },
  // seasonal specials: customers only order them in their season, and then they pay extra
  { id: 'honeylatte', name: 'Honey Latte', base: 0, ing: ['honey'], price: 11, tags: ['sweet', 'cozy'], col: '#f59e0b', season: 0 },
  { id: 'honeybun', name: 'Honey Bun', base: -1, ing: ['flour', 'honey'], price: 10, tags: ['food', 'sweet'], col: '#e0a43a', food: true, season: 0 },
  { id: 'lemonade', name: 'Lemonade', base: -1, ing: ['lemon', 'ice'], price: 8, tags: ['iced', 'sweet'], col: '#fde047', season: 1 },
  { id: 'coldbrew', name: 'Lemon Cold Brew', base: 1, ing: ['lemon', 'ice'], price: 28, tags: ['iced', 'fancy'], col: '#a3a35a', season: 1 },
  { id: 'psl', name: 'Pumpkin Spice Latte', base: 0, ing: ['pumpkin', 'cinnamon'], price: 14, tags: ['cozy', 'sweet'], col: '#ea580c', season: 2 },
  { id: 'ppie', name: 'Pumpkin Pie', base: -1, ing: ['flour', 'pumpkin'], price: 13, tags: ['food', 'cozy'], col: '#c2410c', food: true, season: 2 },
  { id: 'pmocha', name: 'Peppermint Mocha', base: 0, ing: ['mint', 'choc'], price: 14, tags: ['sweet', 'cozy'], col: '#be123c', season: 3 },
  { id: 'ccookie', name: 'Candy Cane Cookie', base: -1, ing: ['flour', 'mint'], price: 9, tags: ['food', 'sweet'], col: '#f43f5e', food: true, season: 3 },
  // 2.1 local specials: customers only order them in their own city's shops, and pay 20% extra for them there
  { id: 'maplelatte', name: 'Maple Latte', base: 0, ing: ['maple'], price: 11, tags: ['sweet', 'cozy'], col: '#b7791f', city: 'home' },
  { id: 'maplescone', name: 'Maple Pecan Scone', base: -1, ing: ['flour', 'maple'], price: 10, tags: ['food', 'cozy'], col: '#c0843d', food: true, city: 'home' },
  { id: 'studybuddy', name: 'Study Buddy Oat Latte', base: 0, ing: ['oat'], price: 8, tags: ['strong', 'cozy'], col: '#d6c3a1', city: 'campus' },
  { id: 'oatcookie', name: 'Oatmeal Cookie', base: -1, ing: ['flour', 'oat'], price: 6, tags: ['food', 'sweet'], col: '#b08a5a', food: true, city: 'campus' },
  { id: 'cocoiced', name: 'Coconut Iced Coffee', base: 0, ing: ['coconut', 'ice'], price: 13, tags: ['iced', 'sweet'], col: '#f5f0e1', city: 'beach' },
  { id: 'cocosmoothie', name: 'Tropical Coconut Smoothie', base: -1, ing: ['coconut', 'berries', 'ice'], price: 16, tags: ['iced', 'tea'], col: '#f472b6', city: 'beach' },
  { id: 'smores', name: "Campfire S'mores Latte", base: 0, ing: ['marsh', 'choc'], price: 15, tags: ['cozy', 'sweet'], col: '#8b5a2b', city: 'pines' },
  { id: 'smoresbar', name: "S'mores Bar", base: -1, ing: ['flour', 'marsh', 'choc'], price: 14, tags: ['food', 'cozy'], col: '#6b3f1d', food: true, city: 'pines' },
  { id: 'nitrocb', name: 'Nitro Cold Brew', base: 1, ing: ['nitro', 'ice'], price: 30, tags: ['strong', 'iced'], col: '#3b2a1f', city: 'metro' },
  { id: 'nitrovan', name: 'Vanilla Sweet Cream Nitro', base: 1, ing: ['nitro', 'vanilla'], price: 33, tags: ['fancy', 'sweet'], col: '#e7d7b8', city: 'metro' },
  { id: 'goldcocoa', name: 'Gold Leaf Hot Chocolate', base: -1, ing: ['gold', 'choc'], price: 48, tags: ['fancy', 'cozy'], col: '#d4af37', city: 'peak' },
  { id: 'goldtruffle', name: 'Golden Truffle Cake', base: -1, ing: ['flour', 'gold', 'choc'], price: 52, tags: ['food', 'fancy'], col: '#b8860b', food: true, city: 'peak' }
];
const RECIPE_BY_ID = {}; RECIPES.forEach(r => { RECIPE_BY_ID[r.id] = r; });
const CLASSIC_N = RECIPES.filter(r => r.season === undefined && !r.city).length, LOCAL_N = RECIPES.filter(r => r.city).length, SEASONAL_N = RECIPES.length - CLASSIC_N - LOCAL_N;
const BASE_NAME = ['No coffee', 'Basic coffee', 'Premium coffee', 'Luxury coffee'];   // index = base + 1
// Seasons and holidays: the calendar comes from the game clock (4 days per season, 16-day year), so no extra save data.
const SEASON_DAYS = 4, YEAR_DAYS = SEASON_DAYS * 4;
const SEASONS = [
  { id: 'spring', name: 'Spring', col: '#f9a8d4', icon: 'flower', spawn: 1, tourist: 1.15, tip: 0, likes: ['sweet', 'tea'], crave: 0.3,
    desc: 'Blossoms everywhere. Customers crave sweet drinks and tea.' },
  { id: 'summer', name: 'Summer', col: '#fde047', icon: 'sun', spawn: 1.1, tourist: 1.5, tip: 0.03, likes: ['iced'], crave: 0.45,
    desc: 'Hot days and lots of tourists. Iced drinks fly off the counter.' },
  { id: 'autumn', name: 'Autumn', col: '#fb923c', icon: 'leaf', spawn: 1, tourist: 0.9, student: 1.35, tip: 0, likes: ['cozy', 'food'], crave: 0.35,
    desc: 'Back to school! Students return and everyone wants cozy drinks and pastries.' },
  { id: 'winter', name: 'Winter', col: '#bae6fd', icon: 'snow', spawn: 0.95, tourist: 0.8, tip: 0.05, likes: ['cozy', 'sweet'], crave: 0.4,
    desc: 'Snow outside, warm drinks inside. Cozy and sweet orders and generous tips.' }
];
// day = day of the season (0-3). night = extra crowd multiplier after 7 PM.
const HOLIDAYS = [
  { id: 'blossom', name: 'Blossom Festival', season: 0, day: 2, icon: 'flower', spawn: 1.35, tourist: 2, tip: 0.1, likes: ['sweet', 'tea'], crave: 0.5, flags: ['#f9a8d4', '#fdf2f8', '#86efac'],
    desc: 'The cherry trees are in bloom! Tourists flood in and everyone wants something sweet.' },
  { id: 'fireworks', name: 'Summer Fireworks', season: 1, day: 2, icon: 'sparkle', spawn: 1.25, night: 1.8, tip: 0.15, likes: ['iced'], crave: 0.55, fireworks: true, flags: ['#ef4444', '#f8fafc', '#3b82f6'],
    desc: 'Fireworks tonight! Busy all day and packed after dark. Iced drinks are a must.' },
  { id: 'halloween', name: 'Halloween', season: 2, day: 2, icon: 'pumpkin', spawn: 1.3, tip: 0.2, likes: ['sweet'], crave: 0.6, costumes: true, flags: ['#f97316', '#1f2937', '#a855f7'],
    desc: 'Trick or treat! Customers come in costume, crave sweets and tip extra.' },
  { id: 'xmas', name: 'Winter Holidays', season: 3, day: 1, icon: 'gift', spawn: 1.4, tip: 0.25, likes: ['cozy', 'sweet'], crave: 0.55, lights: true, flags: ['#dc2626', '#16a34a', '#fde047'],
    desc: 'The happiest time of the year: big crowds, twinkling lights and generous tips.' },
  { id: 'newyear', name: "New Year's Eve", season: 3, day: 3, icon: 'sparkle', spawn: 1.25, night: 1.6, price: 1.15, tip: 0.1, fireworks: true, flags: ['#fde047', '#e5e7eb', '#c084fc'],
    desc: 'The last day of the year! Party prices (+15%) and fireworks at night.' }
];
const HOL_BY_DAY = {}; HOLIDAYS.forEach(h => { HOL_BY_DAY[h.season * SEASON_DAYS + h.day] = h; });
const SEA_ONE = [1, 1, 1, 1];
// Franchise outlets: run by their own manager, pay passive income (no map, no micromanagement)
const FR_CAP = 12, FR_MAX_LV = 5, FR_MGR_MAX = 5;
const FR_INCOME = [0, 60, 130, 220, 340, 500];       // $/min by outlet level, before city/manager/reputation bonuses
const FR_NAMES = ['Express', 'Corner', 'Kiosk', 'Station', 'Plaza', 'Market', 'Depot', 'Junction', 'Square', 'Avenue'];
const UPGRADES = [
  { id: 'grinder', name: 'Turbo Grinder', desc: 'Brew coffee 10% faster per level.', icon: 'bolt', max: 8, base: 150, mult: 1.7 },
  { id: 'menu', name: 'Menu Pricing', desc: 'All coffee sells for 8% more per level.', icon: 'tag', max: 10, base: 250, mult: 1.75 },
  { id: 'chairs', name: 'Comfy Waiting Area', desc: 'Customers wait 10% longer per level.', icon: 'chair', max: 8, base: 120, mult: 1.7 },
  { id: 'ads', name: 'Local Advertising', desc: '8% more customers per level.', icon: 'megaphone', max: 10, base: 200, mult: 1.75 },
  { id: 'bulk', name: 'Bulk Supplier', desc: 'Each supply order has 5 extra items per level.', icon: 'package', max: 6, base: 300, mult: 1.9 },
  { id: 'tips', name: 'Tip Jar', desc: '+6% tip chance per level.', icon: 'coin', max: 8, base: 180, mult: 1.7 },
  { id: 'specials', name: 'Specials Board', desc: '+1 recipe slot on every shop menu per level.', icon: 'book', max: 4, base: 400, mult: 2.1 },
  { id: 'steamer', name: 'Milk Steamer', desc: '+1 latte art cup per shop and more forgiving pours per level.', icon: 'drop', max: 5, base: 220, mult: 1.8 },
  { id: 'seasonal', name: 'Seasonal Menu', desc: 'In-season specials sell for 10% more and holidays bring 8% more customers per level.', icon: 'leaf', max: 4, base: 500, mult: 2 },
  { id: 'academy', name: 'Barista Academy', desc: 'Staff earn 10% more XP and training costs 8% less per level.', icon: 'star', max: 5, base: 350, mult: 1.9 },
  { id: 'frsupport', name: 'Franchise Support', desc: 'Franchise outlets earn 8% more per level.', icon: 'building', max: 6, base: 1500, mult: 1.85 }
];
const UPGRADE_TOTAL = UPGRADES.reduce((a, u) => a + u.max, 0);
const TOOLS = [
  { id: 'cursor', name: 'Interact', icon: 'cursor', tip: 'Click a Brewer to brew, click a Counter to serve the waiting customer.' },
  { id: 'door', name: 'Door', icon: 'door', tile: TILE.DOOR, tip: 'Customers enter and leave through doors.' },
  { id: 'floor', name: 'Floor', icon: 'grid', tile: TILE.FLOOR, tip: 'People only walk on floors. Click and drag to paint.' },
  { id: 'counter', name: 'Counter', icon: 'counter', tile: TILE.COUNTER, tip: 'Customers queue here to order. More counters = more customers at once.' },
  { id: 'brewer', name: 'Brewer', icon: 'brewer', tile: TILE.BREWER, tip: 'Brews coffee from beans + milk + a cup.' },
  { id: 'parking', name: 'Parking', icon: 'car', tile: TILE.PARKING, tip: 'More parking spots bring more customers.' },
  { id: 'plant', name: 'Plant', icon: 'plant', tile: TILE.PLANT, tip: 'Decoration: raises ambience (happier, more patient customers).' },
  { id: 'table', name: 'Table', icon: 'table', tile: TILE.TABLE, tip: 'Cafe table: lots of ambience. Unlocks at Corner Cafe rank.', rank: 1 },
  { id: 'erase', name: 'Bulldoze', icon: 'trash', tip: 'Remove a tile. Refunds half of its price.' },
  // decorations (own palette): ambience raises the shop rating; different kinds add a variety bonus
  { id: 'rug', name: 'Rug', icon: 'rug', tile: TILE.RUG, deco: true, tip: 'Cozy rug. People can walk on it like a floor.' },
  { id: 'lamp', name: 'Lamp', icon: 'lamp', tile: TILE.LAMP, deco: true, tip: 'Warm floor lamp. Glows at night.' },
  { id: 'shelf', name: 'Books', icon: 'book', tile: TILE.SHELF, deco: true, tip: 'Bookshelf for a reading corner.' },
  { id: 'sofa', name: 'Sofa', icon: 'sofa', tile: TILE.SOFA, deco: true, rank: 1, tip: 'Comfy sofa. Unlocks at Corner Cafe rank.' },
  { id: 'art', name: 'Art', icon: 'frame', tile: TILE.ART, deco: true, rank: 2, tip: 'Local art on an easel. Unlocks at Neighborhood Favorite rank.' },
  { id: 'fountain', name: 'Fountain', icon: 'fountain', tile: TILE.FOUNTAIN, deco: true, rank: 2, tip: 'Splashing fountain. Unlocks at Neighborhood Favorite rank.' },
  { id: 'piano', name: 'Piano', icon: 'piano', tile: TILE.PIANO, deco: true, rank: 3, tip: 'Grand piano. Unlocks at Local Chain rank.' },
  { id: 'aquarium', name: 'Aquarium', icon: 'fish', tile: TILE.AQUARIUM, deco: true, rank: 4, tip: 'Glowing aquarium. Unlocks at City Roaster rank.' },
  // seasonal decorations: a big ambience boost in their own season
  { id: 'flowers', name: 'Flowers', icon: 'flower', tile: TILE.FLOWERS, deco: true, rank: 1, season: 0, tip: 'Flower cart. Blooms brightest in Spring.' },
  { id: 'parasol', name: 'Parasol', icon: 'umbrella', tile: TILE.PARASOL, deco: true, rank: 1, season: 1, tip: 'Beach parasol and deck chair. Best in Summer.' },
  { id: 'pumpkin', name: 'Pumpkins', icon: 'pumpkin', tile: TILE.PUMPKIN, deco: true, rank: 1, season: 2, tip: 'Pumpkin pile with a jack-o-lantern. Best in Autumn.' },
  { id: 'snowman', name: 'Snowman', icon: 'snowman', tile: TILE.SNOWMAN, deco: true, rank: 1, season: 3, tip: 'A jolly snowman. Best in Winter.' },
  { id: 'trophy', name: 'Trophy', icon: 'trophy', tile: TILE.TROPHY, deco: true, need: () => state.stats.champs > 0, needWhy: 'Win a barista championship first', tip: 'Your championship trophy on a stand. Win a barista championship to unlock it.' }
];
const TILE_AMB = new Array(TILE_MAX + 1).fill(0);   // ambience each tile type adds
const TILE_SEASON = new Array(TILE_MAX + 1).fill(-1), SEASON_AMB = 5;   // seasonal decorations add SEASON_AMB more in their season
[[TILE.PLANT, 2], [TILE.TABLE, 3], [TILE.RUG, 1], [TILE.LAMP, 2], [TILE.SHELF, 3], [TILE.SOFA, 4], [TILE.ART, 5], [TILE.FOUNTAIN, 6], [TILE.PIANO, 8], [TILE.AQUARIUM, 10],
  [TILE.FLOWERS, 3], [TILE.PARASOL, 3], [TILE.PUMPKIN, 3], [TILE.SNOWMAN, 3], [TILE.TROPHY, 9]].forEach(a => { TILE_AMB[a[0]] = a[1]; });
TOOLS.forEach(t => {
  if (t.season !== undefined) TILE_SEASON[t.tile] = t.season;
  if (t.tile !== undefined && TILE_AMB[t.tile]) t.tip += ' +' + TILE_AMB[t.tile] + ' ambience' + (t.season !== undefined ? ' (+' + (TILE_AMB[t.tile] + SEASON_AMB) + ' in ' + SEASONS[t.season].name + ')' : '') + '.';
});
const MAIN_TOOLS = TOOLS.filter(t => !t.deco);
const TOOL_BY_ID = {}; TOOLS.forEach(t => { TOOL_BY_ID[t.id] = t; });
const TILE_TOOL = {}; TOOLS.forEach(t => { if (t.tile !== undefined) TILE_TOOL[t.tile] = t.id; });

// ======================================================================
// SMALL HELPERS
// ======================================================================
const $ = id => document.getElementById(id);
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function num(v, def, min, max) {
  v = Number(v);
  if (!isFinite(v)) return def;
  return clamp(v, min, max);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 9); }
function fmt(n) {
  n = Math.floor(n);
  if (n < 0) return '-' + fmt(-n);
  if (n < 10000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n < 1e6) return (n / 1000).toFixed(n < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + 'M';
  return (n / 1e9).toFixed(2) + 'B';
}
function money(n) { return '$' + fmt(n); }
function hash2(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function icon(name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (sec % 60) + 's';
}
function ago(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  return Math.floor(s / 86400) + ' days ago';
}

