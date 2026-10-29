
    const MONTHLY_TAX = 200;
    // the corporation track (from 1.x). 2.0: profits follow the economy, and the Conglomerate grows out of the Startup.
    const BIZ1_INIT_COST = 2000;
    const BIZ1_INIT_PROFIT = 150;
    const BIZ1_LVL_PROFIT = 100;
    const BIZ2_INIT_COST = 15000;
    const BIZ2_INIT_PROFIT = 1000;
    const BIZ2_LVL_PROFIT = 600;
    const BIZ2_NEEDS_LVL = 3;

    const JOB_TITLES = ["Intern", "Junior Associate", "Senior Associate", "Lead Specialist", "Manager", "Director", "Vice President", "Senior VP", "CEO", "Board Chairman"];

    // ===================== LIFE SIMULATION DATA =====================
    // Time: one market tick = one day. 7 days = payday, 30 days = monthly bills, 60 days = one year of life.
    const YEAR_DAYS = 60;
    const START_AGE = 16;
    const RETIRE_AGE = 65;
    const EARLY_RETIRE_AGE = 55;
    const BASE_TICK_MS = 3000;
    const SAVE_VERSION = 3;   // 3 = 2.0 market & business (older saves are filled in by fixLife / fixMarket)

    const TRAITS = {
        brainy:   { icon: '🧠', name: 'Brainy',   desc: 'Higher GPA, studying counts 50% more, +10% work performance.' },
        athletic: { icon: '💪', name: 'Athletic', desc: '+8 health. Can go pro in sports more easily.' },
        charming: { icon: '😎', name: 'Charming', desc: 'Better dates, better negotiating, love fades slower.' },
        lucky:    { icon: '🍀', name: 'Lucky',    desc: 'Random events tend to go your way. Better lottery odds.' }
    };
    const AVATARS = ['🧑', '👩', '👨', '🧑‍🦱', '👩‍🦰', '👨‍🦲', '🧔', '👱‍♀️', '👩‍🦱', '🧑‍🦰'];
    const NAMES_A = ['Emma', 'Olivia', 'Ava', 'Mia', 'Sofia', 'Zoe', 'Lily', 'Chloe', 'Maya', 'Aria', 'Nora', 'Ruby', 'Ella', 'Leah', 'Grace', 'Ivy'];
    const NAMES_B = ['Liam', 'Noah', 'Ethan', 'Lucas', 'Mason', 'Leo', 'Owen', 'Caleb', 'Jack', 'Mateo', 'Ryan', 'Ezra', 'Finn', 'Kai', 'Theo', 'Miles'];
    const NAMES = NAMES_A.concat(NAMES_B);
    const PET_NAMES = ['Buddy', 'Max', 'Luna', 'Bella', 'Charlie', 'Daisy', 'Rocky', 'Coco', 'Milo', 'Pepper', 'Biscuit', 'Nugget', 'Ziggy', 'Mochi'];
    const PARTNER_JOBS = [['Teacher', 300], ['Nurse', 420], ['Barista', 140], ['Engineer', 650], ['Artist', 200], ['Accountant', 450], ['Chef', 300], ['Firefighter', 380], ['Designer', 400], ['Veterinarian', 700], ['Musician', 180], ['Pharmacist', 800], ['Mechanic', 320], ['Writer', 250]];

    const STYLES = [
        { icon: '🌴', name: 'Relaxed',  perf: 0.6, pay: 0.9,  health: 6,   hap: 6,  love: 0.5, desc: 'Fewer hours: -10% pay and slower promotions, but healthier and happier.' },
        { icon: '⚖️', name: 'Balanced', perf: 1,   pay: 1,    health: 0,   hap: 0,  love: 1,   desc: 'A normal work week. No bonuses, no penalties.' },
        { icon: '🔥', name: 'Hustle',   perf: 1.5, pay: 1.15, health: -12, hap: -8, love: 2,   desc: '+15% pay and fast promotions, but stress hurts health, happiness, grades and love.' }
    ];

    // Education. req = any one of the listed degrees ('bach' = any Bachelor's, 'assoc' = any Associate's).
    const PROGRAMS = {
        hs:     { name: 'High School Diploma', school: 'High School', icon: '🏫', years: 2, cost: 0, lvl: 'hs', req: [], score: 300 },
        aa:     { name: 'Associate of Arts', school: 'Community College', icon: '📘', years: 2, cost: 500, lvl: 'assoc', req: ['hs'], score: 400 },
        an:     { name: 'Associate of Nursing', school: 'Community College', icon: '💉', years: 2, cost: 700, lvl: 'assoc', req: ['hs'], score: 450 },
        t_cna:  { name: 'Nursing Assistant Certificate', school: 'Trade School', icon: '🩹', years: 1, cost: 300, lvl: 'trade', req: ['hs'], score: 250 },
        t_cul:  { name: 'Culinary Arts Certificate', school: 'Trade School', icon: '🔪', years: 1, cost: 700, lvl: 'trade', req: ['hs'], score: 300 },
        t_pol:  { name: 'Police Academy', school: 'Trade School', icon: '🚨', years: 1, cost: 0, lvl: 'trade', req: ['hs'], minHealth: 50, score: 350 },
        t_code: { name: 'Coding Bootcamp', school: 'Trade School', icon: '⌨️', years: 1, cost: 1800, lvl: 'trade', req: ['hs'], score: 350 },
        t_elec: { name: 'Electrician Apprenticeship', school: 'Trade School', icon: '⚡', years: 2, cost: 600, lvl: 'trade', req: ['hs'], score: 400 },
        t_fly:  { name: 'Flight School', school: 'Trade School', icon: '🛩️', years: 2, cost: 3500, lvl: 'trade', req: ['hs'], minHealth: 60, score: 600 },
        b_bus:  { name: "Bachelor's in Business", school: 'University', icon: '📊', years: 4, cost: 1200, lvl: 'bach', req: ['hs'], score: 800 },
        b_cs:   { name: "Bachelor's in Computer Science", school: 'University', icon: '💻', years: 4, cost: 1300, lvl: 'bach', req: ['hs'], score: 850 },
        b_nur:  { name: "Bachelor's in Nursing", school: 'University', icon: '🩺', years: 4, cost: 1200, lvl: 'bach', req: ['hs'], score: 800 },
        b_edu:  { name: "Bachelor's in Education", school: 'University', icon: '🍎', years: 4, cost: 1000, lvl: 'bach', req: ['hs'], score: 750 },
        b_bio:  { name: "Bachelor's in Biology", school: 'University', icon: '🧬', years: 4, cost: 1300, lvl: 'bach', req: ['hs'], score: 850 },
        b_pol:  { name: "Bachelor's in Political Science", school: 'University', icon: '🏛️', years: 4, cost: 1100, lvl: 'bach', req: ['hs'], score: 750 },
        m_mba:  { name: 'MBA (Master of Business)', school: 'Graduate School', icon: '🎩', years: 2, cost: 3000, lvl: 'grad', req: ['bach'], score: 1200 },
        m_cs:   { name: "Master's in Computer Science", school: 'Graduate School', icon: '🤖', years: 2, cost: 2200, lvl: 'grad', req: ['b_cs'], score: 1200 },
        m_nur:  { name: "Master's in Nursing", school: 'Graduate School', icon: '🏥', years: 2, cost: 2000, lvl: 'grad', req: ['b_nur'], score: 1100 },
        m_edu:  { name: "Master's in Education", school: 'Graduate School', icon: '📚', years: 2, cost: 1500, lvl: 'grad', req: ['b_edu'], score: 1000 },
        jd:     { name: 'Law Degree (JD)', school: 'Graduate School', icon: '⚖️', years: 3, cost: 3500, lvl: 'grad', req: ['bach'], score: 1500 },
        md:     { name: 'Medical Degree (MD)', school: 'Graduate School', icon: '⚕️', years: 4, cost: 5000, lvl: 'grad', req: ['b_bio', 'b_nur'], score: 1800 },
        phd:    { name: 'PhD in Science', school: 'Graduate School', icon: '🔭', years: 5, cost: 0, stipend: 90, lvl: 'grad', req: ['b_bio', 'b_cs'], score: 2000 },
        m_eng:  { name: "Master's in Engineering", school: 'Graduate School', icon: '🛠️', years: 2, cost: 2400, lvl: 'grad', req: ['b_cs', 'mil_academy'], score: 1200 },
        m_pa:   { name: "Master's in Public Administration", school: 'Graduate School', icon: '🏛️', years: 2, cost: 1800, lvl: 'grad', req: ['b_pol', 'b_bus', 'mil_academy'], score: 1100 },
        // 2.1 the military: enlist after Basic Training, or become an officer through the Academy, ROTC or Officer Training School
        mil_boot:    { name: 'Basic Training', school: 'Military', icon: '🪖', years: 1, cost: 0, stipend: 120, lvl: 'mil', req: ['hs'], minHealth: 55, score: 300 },
        mil_academy: { name: 'Military Academy', school: 'Military', icon: '🏰', years: 4, cost: 0, stipend: 60, lvl: 'bach', req: ['hs'], minHealth: 65, score: 1100 },
        mil_ots:     { name: 'Officer Training School', school: 'Military', icon: '🎖️', years: 1, cost: 0, stipend: 150, lvl: 'mil', req: ['bach'], minHealth: 55, score: 400 },
        rotc:        { name: 'ROTC Commission', school: 'Military', icon: '⭐', years: 4, cost: 0, lvl: 'mil', req: ['never'], hidden: true, score: 300 }
    };
    const SCHOOL_GROUPS = ['Community College', 'Trade School', 'University', 'Graduate School', 'Military'];
    const MASTERS_FOR = { b_cs: 'm_cs', b_nur: 'm_nur', b_edu: 'm_edu', b_bus: 'm_mba', b_pol: 'm_pa', b_bio: 'phd', mil_academy: 'm_eng' };   // "stay for a master's" offers
    const COMMISSION = ['mil_academy', 'mil_ots', 'rotc'];

    // Careers: ranks are [title, weekly pay, required degree(s)].
    const CAREERS = {
        retail:    { name: 'Retail', icon: '🛒', sat: -2, ranks: [['Crew Member', 120], ['Shift Lead', 170], ['Assistant Manager', 240], ['Store Manager', 340, ['hs']], ['District Manager', 480, ['hs']], ['Regional Director', 650, ['assoc', 'bach']]] },
        corporate: { name: 'Corporate', icon: '💼', sat: 0, benefits: true, ranks: [[JOB_TITLES[0], 150], [JOB_TITLES[1], 220, ['hs']], [JOB_TITLES[2], 300, ['assoc', 'bach']], [JOB_TITLES[3], 400, ['bach']], [JOB_TITLES[4], 520, ['bach']], [JOB_TITLES[5], 700, ['bach']], [JOB_TITLES[6], 950, ['m_mba']], [JOB_TITLES[7], 1250, ['m_mba']], [JOB_TITLES[8], 1800, ['m_mba']], [JOB_TITLES[9], 2500, ['m_mba']]] },
        software:  { name: 'Software', icon: '💻', sat: 3, benefits: true, minAge: 18, ranks: [['Junior Developer', 330, ['b_cs', 't_code']], ['Developer', 480, ['b_cs', 't_code']], ['Senior Developer', 680, ['b_cs', 't_code']], ['Staff Engineer', 920, ['b_cs']], ['Principal Engineer', 1250, ['b_cs']], ['Chief Technology Officer', 1800, ['m_cs', 'm_mba']]] },
        nursing:   { name: 'Nursing', icon: '🩺', sat: 5, benefits: true, minAge: 18, ranks: [['Nursing Assistant', 200, ['t_cna', 'an', 'b_nur']], ['Registered Nurse', 420, ['an', 'b_nur']], ['Charge Nurse', 560, ['an', 'b_nur']], ['Nurse Manager', 700, ['b_nur']], ['Nurse Practitioner', 950, ['m_nur']], ['Director of Nursing', 1250, ['m_nur']]] },
        medicine:  { name: 'Medicine', icon: '⚕️', sat: 6, benefits: true, minAge: 18, ranks: [['Resident Doctor', 450, ['md']], ['Attending Physician', 1200, ['md']], ['Specialist', 1800, ['md']], ['Department Chief', 2500, ['md']], ['Chief of Medicine', 3200, ['md']]] },
        law:       { name: 'Law', icon: '⚖️', sat: 1, benefits: true, minAge: 18, ranks: [['Paralegal', 260, ['assoc', 'bach']], ['Associate Attorney', 700, ['jd']], ['Senior Associate', 950, ['jd']], ['Partner', 1600, ['jd']], ['Managing Partner', 2400, ['jd']], ['Federal Judge', 2800, ['jd']]] },
        teaching:  { name: 'Teaching', icon: '🍎', sat: 8, benefits: true, minAge: 18, ranks: [['Substitute Teacher', 180, ['assoc', 'bach']], ['Teacher', 340, ['b_edu']], ['Senior Teacher', 420, ['b_edu']], ['Vice Principal', 580, ['m_edu']], ['Principal', 780, ['m_edu']], ['Superintendent', 1100, ['m_edu']]] },
        police:    { name: 'Law Enforcement', icon: '🚓', sat: 4, benefits: true, danger: 4, minAge: 18, ranks: [['Police Cadet', 200, ['t_pol']], ['Patrol Officer', 340, ['t_pol']], ['Detective', 480, ['t_pol']], ['Sergeant', 620, ['t_pol']], ['Lieutenant', 800, ['assoc', 'bach']], ['Police Chief', 1100, ['bach']]] },
        electric:  { name: 'Electrician', icon: '⚡', sat: 3, trade: true, danger: 2, minAge: 18, ranks: [['Apprentice Electrician', 200, ['t_elec']], ['Journeyman', 380, ['t_elec']], ['Master Electrician', 580, ['t_elec']], ['Contractor', 820, ['t_elec']], ['Electrical Company Owner', 1200, ['t_elec']]] },
        chef:      { name: 'Culinary', icon: '🍳', sat: 4, trade: true, ranks: [['Dishwasher', 110], ['Line Cook', 170], ['Sous Chef', 300, ['t_cul']], ['Head Chef', 460, ['t_cul']], ['Executive Chef', 680, ['t_cul']], ['Celebrity Chef', 1400, ['t_cul']]] },
        pilot:     { name: 'Aviation', icon: '✈️', sat: 6, benefits: true, minAge: 18, ranks: [['Flight Instructor', 350, ['t_fly']], ['First Officer', 600, ['t_fly']], ['Captain', 1000, ['t_fly']], ['Senior Captain', 1400, ['t_fly']], ['Chief Pilot', 1900, ['bach']]] },
        science:   { name: 'Science', icon: '🔬', sat: 5, benefits: true, minAge: 18, ranks: [['Lab Technician', 260, ['assoc', 'bach']], ['Research Associate', 400, ['b_bio', 'b_cs']], ['Scientist', 700, ['phd']], ['Senior Scientist', 1000, ['phd']], ['Lab Director', 1500, ['phd']], ['Nobel Laureate', 2200, ['phd']]] },
        creator:   { name: 'Content Creator', icon: '🎥', sat: 6, volatile: true, ranks: [['Newbie Streamer', 50], ['Partnered Streamer', 180], ['Influencer', 500], ['Celebrity', 1300], ['Megastar', 2800]] },
        athlete:   { name: 'Pro Sports', icon: '🏅', sat: 8, danger: 6, minAge: 18, maxJoin: 26, minHealth: 75, endAge: 36, ranks: [['Minor Leaguer', 300], ['Bench Player', 700], ['Starter', 1300], ['All-Star', 2200], ['League MVP', 3200]] }
    };

    CAREERS.army = { name: 'Military (Enlisted)', icon: '🪖', sat: 4, benefits: true, danger: 5, minAge: 18, minHealth: 55, mil: true,
        ranks: [['Private', 230, ['mil_boot']], ['Private First Class', 270, ['mil_boot']], ['Corporal', 330, ['mil_boot']], ['Sergeant', 410, ['mil_boot']],
                ['Staff Sergeant', 500, ['mil_boot']], ['Sergeant First Class', 600, ['mil_boot']], ['Master Sergeant', 720, ['mil_boot']], ['Sergeant Major', 870, ['mil_boot']]] };
    CAREERS.officer = { name: 'Military (Officer)', icon: '🎖️', sat: 5, benefits: true, danger: 4, minAge: 21, minHealth: 55, mil: true,
        ranks: [['Second Lieutenant', 560, COMMISSION], ['First Lieutenant', 680, COMMISSION], ['Captain', 850, COMMISSION], ['Major', 1050, COMMISSION],
                ['Lieutenant Colonel', 1300, COMMISSION], ['Colonel', 1600, COMMISSION], ['Brigadier General', 2000, COMMISSION], ['General', 2700, COMMISSION]] };
    function milYears() { return (L.milDays || 0) / YEAR_DAYS; }
    function giBill() { return milYears() >= 3; }   // three years of service: the GI Bill pays tuition from then on

    // Degrees that let you skip the bottom rungs when you join a career: [[degrees], start rank]
    const STARTS = {
        corporate: [[['bach'], 2], [['m_mba'], 4]],
        software:  [[['m_cs'], 1]],
        nursing:   [[['an', 'b_nur'], 1], [['m_nur'], 2]],
        law:       [[['jd'], 1]],
        teaching:  [[['b_edu'], 1], [['m_edu'], 2]],
        science:   [[['b_bio', 'b_cs'], 1], [['phd'], 2]],
        chef:      [[['t_cul'], 1]],
        retail:    [[['assoc', 'bach'], 1]],
        officer:   [[['m_eng', 'm_pa'], 1]]
    };

    const RENTALS = {
        parents:   { name: "Parents' House", icon: '🏡', rent: 0, hap: 0, rooms: 1, desc: 'Free, but awkward once you are an adult.' },
        room:      { name: 'Shared Room', icon: '🛏️', rent: 90, hap: -3, rooms: 1, desc: 'Cheap, with three roommates.' },
        studio:    { name: 'Studio Apartment', icon: '🏢', rent: 160, hap: 0, rooms: 1, desc: 'Small but all yours.' },
        apt:       { name: 'City Apartment', icon: '🏙️', rent: 280, hap: 4, rooms: 2, desc: 'Two bedrooms near downtown.' },
        loft:      { name: 'Downtown Loft', icon: '🌆', rent: 500, hap: 8, rooms: 2, desc: 'Big windows, great view.' },
        penthouse: { name: 'Luxury Penthouse', icon: '🌃', rent: 1400, hap: 13, rooms: 3, desc: 'Rooftop pool included.' }
    };
    const HOMES = {
        condo:   { name: 'Starter Condo', icon: '🏘️', price: 12000, hap: 6, rooms: 2, score: 500 },
        house:   { name: 'Suburban House', icon: '🏠', price: 25000, hap: 9, rooms: 3, score: 1000 },
        family:  { name: 'Family Home', icon: '🏡', price: 45000, hap: 11, rooms: 5, score: 1500 },
        villa:   { name: 'Lakeside Villa', icon: '🏞️', price: 120000, hap: 14, rooms: 5, score: 3000 },
        mansion: { name: 'Hilltop Mansion', icon: '🏰', price: 350000, hap: 17, rooms: 8, score: 6000 },
        island:  { name: 'Private Island', icon: '🏝️', price: 1500000, hap: 20, rooms: 10, score: 15000 }
    };
    const MORTGAGE = { down: 0.2, rate: 0.01, n: 60 };
    const CAR_LOAN = { down: 0.2, rate: 0.015, n: 24 };
    const STUDENT_LOAN = { rate: 0.008, n: 40 };
    const MAX_PROPS = 6;

    const CARS = {
        beater: { name: 'Used Hatchback', icon: '🚗', price: 1500, upkeep: 30, hap: 1, wear: 0.3, score: 50 },
        sedan:  { name: 'Compact Sedan', icon: '🚙', price: 7000, upkeep: 45, hap: 3, wear: 0.15, score: 150 },
        pickup: { name: 'Work Pickup', icon: '🛻', price: 12000, upkeep: 60, hap: 3, wear: 0.15, score: 200, perk: '+15% performance for trade careers' },
        suv:    { name: 'Family SUV', icon: '🚐', price: 18000, upkeep: 70, hap: 5, wear: 0.12, score: 300, perk: 'Room for the whole family (+2 happiness with kids)' },
        ev:     { name: 'Electric Car', icon: '🔋', price: 32000, upkeep: 20, hap: 6, wear: 0.08, score: 500, perk: 'Barely needs servicing' },
        sports: { name: 'Sports Car', icon: '🏎️', price: 65000, upkeep: 150, hap: 10, wear: 0.15, score: 1000, perk: 'Better luck on dates' },
        hyper:  { name: 'Hypercar', icon: '🏁', price: 250000, upkeep: 400, hap: 14, wear: 0.12, score: 3000, perk: 'Better luck on dates' }
    };

    const PETS = {
        fish:   { name: 'Goldfish', icon: '🐠', price: 30, hap: 2, cost: 5, life: 5, score: 10 },
        cat:    { name: 'Cat', icon: '🐈', price: 150, hap: 4, cost: 20, life: 16, score: 60 },
        mutt:   { name: 'Shelter Dog', icon: '🐕', price: 100, hap: 4, cost: 25, life: 13, score: 80, dog: true },
        dog:    { name: 'Golden Retriever', icon: '🦮', price: 800, hap: 5, cost: 30, life: 12, score: 100, dog: true },
        parrot: { name: 'Parrot', icon: '🦜', price: 400, hap: 3, cost: 15, life: 40, score: 80 },
        horse:  { name: 'Horse', icon: '🐴', price: 6000, hap: 6, cost: 150, life: 28, score: 600, needHome: true }
    };
    const MAX_PETS = 6;

    // Life Shop (the first four are the original shop items).
    const SHOP = [
        { id: 'food', name: 'Fancy Dinner', price: 50, icon: '🍕', boost: 5, hap: 3, love: 3, desc: '+3 happiness (+3 love with a partner)' },
        { id: 'gift', name: 'Birthday Gift', price: 150, icon: '🎁', boost: 15, love: 8, parents: 6, desc: '+8 love for your partner (or +6 with your parents)' },
        { id: 'pet', name: 'Golden Retriever', price: 800, icon: '🦮', boost: 100, pet: 'dog', desc: 'A loyal best friend. Adds a pet (+happiness, $30/mo)' },
        { id: 'games', name: 'Game Console', price: 400, icon: '🎮', boost: 40, hap: 8, desc: '+8 happiness' },
        { id: 'concert', name: 'Concert Tickets', price: 200, icon: '🎸', boost: 20, hap: 9, friends: true, desc: '+9 happiness, might make a friend' },
        { id: 'checkup', name: 'Doctor Checkup', price: 120, icon: '🩺', boost: 10, health: 10, insured: true, desc: '+10 health (75% off with job benefits)' },
        { id: 'spa', name: 'Spa Day', price: 250, icon: '🧖', boost: 25, hap: 8, health: 6, desc: '+8 happiness, +6 health' },
        { id: 'vacation', name: 'Beach Vacation', price: 1500, icon: '🏖️', boost: 150, hap: 20, health: 5, love: 10, desc: '+20 happiness, +5 health, +10 love' },
        { id: 'watch', name: 'Diamond Watch', price: 5000, icon: '⌚', boost: 500, hap: 6, desc: '+6 happiness. Pure flex.' },
        { id: 'cruise', name: 'Luxury Cruise', price: 8000, icon: '🛳️', boost: 800, hap: 30, health: 5, love: 15, desc: '+30 happiness, +15 love' },
        { id: 'art', name: 'Art Collection', price: 25000, icon: '🖼️', boost: 2500, hap: 8, desc: '+8 happiness, very cultured' },
        { id: 'yacht', name: 'Mega Yacht', price: 250000, icon: '🛥️', boost: 20000, hap: 15, desc: '+15 happiness, the ultimate trophy' }
    ];
    const SUBS = {
        gym:     { name: 'Gym Membership', icon: '🏋️', cost: 60, desc: '+10 health over time' },
        meals:   { name: 'Healthy Meal Plan', icon: '🥗', cost: 90, desc: '+6 health over time' },
        stream:  { name: 'Streaming Bundle', icon: '📺', cost: 20, desc: '+3 happiness' },
        therapy: { name: 'Therapist', icon: '🛋️', cost: 150, desc: '+7 happiness, cancels stress' }
    };

    const TABS = [
        { id: 'life', icon: '🧍', name: 'Life' }, { id: 'career', icon: '💼', name: 'Career' }, { id: 'school', icon: '🎓', name: 'School' },
        { id: 'market', icon: '📈', name: 'Market' }, { id: 'biz', icon: '🏭', name: 'Business' }, { id: 'home', icon: '🏠', name: 'Home' },
        { id: 'cars', icon: '🚗', name: 'Cars' }, { id: 'family', icon: '❤️', name: 'Family' }, { id: 'shop', icon: '🛍️', name: 'Shop' },
        { id: 'stats', icon: '🏆', name: 'Stats' }
    ];

    // ===================== MARKET DATA (2.0) =====================
    // Rates follow the game's loan convention: "per month" = one 30-day bill cycle (a game year is 60 days).
    const SECTORS = {
        fund:    { name: 'Funds',   icon: '🧺', color: '#94a3b8' },
        tech:    { name: 'Tech',    icon: '💻', color: '#38bdf8' },
        energy:  { name: 'Energy',  icon: '⚡', color: '#fbbf24' },
        retail:  { name: 'Retail',  icon: '🛒', color: '#f472b6' },
        health:  { name: 'Health',  icon: '🩺', color: '#34d399' },
        finance: { name: 'Finance', icon: '🏦', color: '#a78bfa' },
        media:   { name: 'Media',   icon: '🎬', color: '#fb923c' },
        crypto:  { name: 'Crypto',  icon: '🪙', color: '#facc15' }
    };
    const STOCK_SECTORS = ['tech', 'energy', 'retail', 'health', 'finance', 'media'];
    // [id, name, sector, start price, daily volatility, value growth %/mo, dividend %/mo, description]
    const STOCK_DEFS = [
        ['TOP2', 'TOP2 Index', 'fund', 450, 0, 0, 0.08, 'Follows the two most expensive stocks. One click, two giants.'],
        ['MKT', 'Total Market Fund', 'fund', 100, 0, 0, 0.12, 'Owns a slice of every stock. The calm, diversified choice.'],
        ['NVDA', 'Nvidia-ish', 'tech', 150, 0.06, 1.6, 0, 'Graphics chips for gamers and AI.'],
        ['FRUIT', 'Pear Computer', 'tech', 180, 0.03, 1.0, 0.05, 'Sleek phones and laptops. Fans line up for days.'],
        ['AI', 'Neural-Net', 'tech', 300, 0.12, 2.0, 0, 'Hyped AI startup. Huge swings both ways.'],
        ['SRCH', 'Gaggle Search', 'tech', 210, 0.035, 1.0, 0, 'The search engine everyone uses.'],
        ['SOCL', 'FriendSpace', 'tech', 95, 0.05, 0.7, 0, 'Social network. Mostly ads and cat videos.'],
        ['CLOUD', 'Nimbus Cloud', 'tech', 130, 0.045, 1.3, 0, 'Rents servers to half the internet.'],
        ['OIL', 'Black Gold', 'energy', 90, 0.05, 0.2, 0.35, 'Oil driller. Slow growth, fat dividends.'],
        ['UTEL', 'Utility Grid', 'energy', 110, 0.01, 0.3, 0.3, 'Boring, steady power company. Grandma loves it.'],
        ['TSLA', 'Electro-Car', 'energy', 120, 0.08, 1.4, 0, 'Electric cars and very big promises.'],
        ['SUNP', 'SolarFlare Power', 'energy', 45, 0.06, 1.2, 0, 'Solar panels on every roof.'],
        ['WIND', 'Breezeway Turbines', 'energy', 38, 0.045, 0.9, 0.1, 'Giant wind turbines, giant contracts.'],
        ['GAS', 'PipeDream Gas', 'energy', 62, 0.035, 0.3, 0.3, 'Natural gas pipelines. Steady payouts.'],
        ['AMZN', 'Jungle Retail', 'retail', 140, 0.04, 1.1, 0, 'Sells everything, ships it tomorrow.'],
        ['GAME', 'GME-Stop', 'retail', 25, 0.25, -0.4, 0, 'Meme stock. Pure chaos.'],
        ['MART', 'Mega-Mart', 'retail', 85, 0.015, 0.5, 0.2, 'Giant discount stores in every town.'],
        ['SHOE', 'Swoosh Sneakers', 'retail', 105, 0.03, 0.8, 0.1, 'Sneakers that cost more than your rent.'],
        ['BURG', 'Burger Planet', 'retail', 70, 0.02, 0.6, 0.25, 'Fast food, faster profits.'],
        ['BREW', 'Bean & Brew Coffee', 'retail', 55, 0.03, 0.8, 0.12, 'The coffee chain on every corner.'],
        ['PILL', 'BigPharma Co', 'health', 160, 0.025, 0.6, 0.25, 'Makes the medicine in your cabinet.'],
        ['GENE', 'GeneSplice Bio', 'health', 48, 0.09, 1.5, 0, 'Biotech gamble: drug trials make or break it.'],
        ['CARE', 'CareFirst Hospitals', 'health', 120, 0.02, 0.6, 0.15, 'Runs hospitals across the country.'],
        ['VAX', 'ImmunoLabs', 'health', 75, 0.05, 1.0, 0, 'Vaccines and research labs.'],
        ['MEDX', 'MedDevice X', 'health', 135, 0.03, 0.9, 0.08, 'Robots that help surgeons.'],
        ['SMILE', 'BrightSmile Dental', 'health', 40, 0.025, 0.6, 0.15, 'Dentist offices. Floss daily.'],
        ['GOLD', 'Safe Haven', 'finance', 200, 0.01, 0.4, 0, 'Gold fund. Tends to rise when everything else falls.'],
        ['BANK', 'Vault Bank', 'finance', 65, 0.025, 0.6, 0.3, 'A big, old bank. Likes higher interest rates.'],
        ['INSR', 'Umbrella Insurance', 'finance', 90, 0.02, 0.6, 0.25, 'Insurance for homes, cars and pets.'],
        ['CARD', 'PlasticCard Payments', 'finance', 220, 0.03, 1.1, 0.05, 'Takes a tiny cut of every swipe.'],
        ['EXCH', 'StockSwap Exchange', 'finance', 115, 0.035, 0.9, 0.1, 'Runs the stock exchange itself.'],
        ['LOAN', 'QuickCash Lending', 'finance', 18, 0.07, 0.2, 0.4, 'Risky lender. High dividends, high drama.'],
        ['STRM', 'Streamflix', 'media', 160, 0.05, 1.0, 0, 'Binge-worthy shows, monthly subscription.'],
        ['TOON', 'Mouse House Studios', 'media', 110, 0.025, 0.7, 0.12, 'Cartoons, theme parks and princesses.'],
        ['PLAY', 'PixelPlay Games', 'media', 75, 0.06, 1.2, 0, 'Video game publisher. One hit away from glory.'],
        ['BEAT', 'BeatBox Music', 'media', 30, 0.05, 0.8, 0, 'Music streaming for every playlist.'],
        ['BITB', 'BitBuck', 'crypto', 2400, 0.08, 1.5, 0, 'The original digital coin. Wild, but the biggest.'],
        ['ETHR', 'Ethereal', 'crypto', 180, 0.1, 1.5, 0, 'Smart-contract coin that powers a thousand apps.'],
        ['DOGE', 'MemeCoin', 'crypto', 5, 0.3, -0.5, 0, 'Started as a joke. Still a joke. Sometimes a rich joke.'],
        ['MOON', 'MoonToken', 'crypto', 0.8, 0.2, 0, 0, 'Promises to go to the moon every single day.'],
        ['HAMS', 'HamsterCoin', 'crypto', 0.05, 0.25, -0.5, 0, 'Tiny coin with a hamster mascot. Big pumps, big dumps.'],
        ['PIXL', 'PixelPunks NFT', 'crypto', 12, 0.18, -1.0, 0, 'Token for pixel-art pictures. The craze is fading...']
    ];
    const SDEF = {};
    for (const a of STOCK_DEFS) SDEF[a[0]] = { id: a[0], name: a[1], sec: a[2], p: a[3], v: a[4], g: a[5], y: a[6], d: a[7], gd: Math.pow(1 + a[5] / 100, 1 / 30) - 1 };
    SDEF.GOLD.haven = true;
    const CRYPTO_FEE = 0.01;
    const H_DAYS = 120, HL_STEP = 15, HL_MAX = 220;   // daily history, then one point every 15 days for the whole life
    const SPLIT_AT = 2500;
    const MAX_ORDERS = 12;
    const TRADE_SIZES = [1, 10, 100, 1000, 0];        // 0 = as many as possible
    const BANK_AMTS = [100, 1000, 10000, 100000, 0];  // 0 = all of it
    const REGIMES = {
        calm: { name: 'Calm market', icon: '😐', drift: 0, vol: 1, econ: 0, days: [60, 200] },
        bull: { name: 'Bull market', icon: '🐂', drift: 0.0004, vol: 0.9, econ: 0.12, days: [90, 300] },
        bear: { name: 'Bear market', icon: '🐻', drift: -0.0008, vol: 1.25, econ: -0.18, days: [40, 150] }
    };
    // Market news: [sector or '*' for everything, 1 = one company / 0 = whole sector, 1 good / -1 bad, headline]
    const NEWS = [
        ['tech', 1, 1, '{N} unveils a gadget everyone wants'], ['tech', 1, -1, '{N} hit by a massive data breach'],
        ['tech', 0, 1, 'AI boom: investors pile into tech'], ['tech', 0, -1, 'New privacy law worries tech giants'],
        ['tech', 0, 1, 'Chip shortage ends, tech stocks rally'], ['tech', 1, -1, '{N} delays its big launch'],
        ['energy', 0, 1, 'Fuel prices spike after a pipeline shutdown'], ['energy', 0, -1, 'Mild winter: energy demand slumps'],
        ['energy', 1, 1, '{N} wins a giant government contract'], ['energy', 1, -1, '{N} faces a huge cleanup bill'],
        ['energy', 0, 1, 'Green energy subsidies approved'], ['energy', 0, -1, 'Energy glut sends prices tumbling'],
        ['retail', 0, 1, 'Record holiday shopping season'], ['retail', 0, -1, 'Shoppers tighten their belts'],
        ['retail', 1, 1, "{N}'s new product goes viral"], ['retail', 1, -1, '{N} recalls a faulty product'],
        ['health', 1, 1, "{N}'s new treatment gets approved"], ['health', 1, -1, "{N}'s drug trial fails"],
        ['health', 0, 1, 'Aging population boosts healthcare demand'], ['health', 0, -1, 'Price caps squeeze healthcare profits'],
        ['finance', 0, 1, 'Banks post record profits'], ['finance', 0, -1, 'Loan defaults rise, banks wobble'],
        ['finance', 1, 1, '{N} smashes earnings expectations'], ['finance', 1, -1, '{N} fined for sneaky fees'],
        ['media', 1, 1, "{N}'s new release is a smash hit"], ['media', 1, -1, "{N}'s big release flops"],
        ['media', 0, 1, 'Streaming wars: everyone is subscribing'], ['media', 0, -1, 'Advertisers slash media budgets'],
        ['*', 1, 1, '{N} beats quarterly earnings'], ['*', 1, -1, '{N} misses earnings, CEO apologizes'],
        ['*', 1, -1, "{N}'s CEO quits suddenly"], ['*', 1, 1, '{N} announces a big share buyback'],
        ['*', 0, 1, 'Economy booming: stocks rally across the board'], ['*', 0, -1, 'Recession fears grip Wall Street'],
        ['crypto', 1, 1, 'Celebrity posts about {N}: to the moon!'], ['crypto', 1, -1, 'Exchange hack: {N} plunges'],
        ['crypto', 1, 1, 'A big bank starts accepting {N}'], ['crypto', 1, -1, '{N} developers vanish overnight'],
        ['crypto', 0, -1, 'Regulators crack down on crypto'], ['crypto', 0, 1, 'Crypto mania: every coin is pumping']
    ];
    const BONDS = {
        t1:   { name: '1-Year Treasury', icon: '📄', days: 60, prem: 0.05, desc: 'Short and perfectly safe.' },
        t5:   { name: '5-Year Treasury', icon: '📜', days: 300, prem: 0.2, desc: 'Locks in a better rate for 5 years.' },
        t10:  { name: '10-Year Treasury', icon: '🏛️', days: 600, prem: 0.35, desc: 'The best safe rate, the longest wait.' },
        junk: { name: 'High-Yield Corporate', icon: '🎲', days: 180, prem: 0.9, risk: 0.006, desc: 'Big interest, but the company might default (you would get 40% back).' }
    };
    const BOND_MIN = 500, MAX_BONDS = 8, BOND_EARLY = 0.05;

    // ===================== BUSINESS DATA (2.0) =====================
    // dem = customers/week at level 1, cap = customers one worker can serve, mar = profit per customer,
    // wage = per employee per week, rent = weekly fixed costs at level 1, per = staff slots, mgrW = manager pay, mkU = marketing unit cost
    const BIZ = {
        lemon:  { name: 'Lemonade Stand', icon: '🍋', cost: 200, minAge: 16, dem: 30, cap: 25, mar: 1.0, wage: 15, rent: 3, per: 1, mgrW: 25, mkU: 5, vol: 0.2, maxL: 3, sec: 'retail', score: 100, desc: 'A first taste of business. Hire a friend or two.' },
        truck:  { name: 'Food Truck', icon: '🚚', cost: 5000, minAge: 18, dem: 150, cap: 80, mar: 2.2, wage: 110, rent: 40, per: 2, mgrW: 180, mkU: 25, vol: 0.2, maxL: 4, sec: 'retail', deg: ['t_cul'], score: 300, desc: 'Tacos on wheels. Culinary school gives +25% margins.' },
        cafe:   { name: 'Coffee Shop', icon: '☕', cost: 12000, minAge: 18, dem: 500, cap: 160, mar: 1.6, wage: 130, rent: 140, per: 3, mgrW: 260, mkU: 50, vol: 0.15, maxL: 5, sec: 'retail', score: 600, desc: 'Lots of customers, small margins. Staffing is everything.' },
        shop:   { name: 'Clothing Boutique', icon: '👗', cost: 25000, minAge: 18, dem: 160, cap: 45, mar: 8.5, wage: 160, rent: 350, per: 3, mgrW: 320, mkU: 90, vol: 0.2, maxL: 5, sec: 'retail', score: 900, desc: 'Fewer customers who spend a lot. Loves marketing.' },
        app:    { name: 'App Studio', icon: '📱', cost: 30000, minAge: 18, dem: 60, cap: 18, mar: 38, wage: 450, rent: 250, per: 3, mgrW: 500, mkU: 120, vol: 0.45, maxL: 5, sec: 'tech', deg: ['b_cs', 'm_cs', 't_code'], score: 1000, desc: 'Hit or miss: big weeks and bad weeks. Coders get +25% margins.' },
        gym:    { name: 'Fitness Gym', icon: '🏋️', cost: 45000, minAge: 18, dem: 300, cap: 110, mar: 7.5, wage: 220, rent: 900, per: 3, mgrW: 400, mkU: 150, vol: 0.12, maxL: 5, sec: 'health', score: 1200, desc: 'Steady members, big rent. Free gym access (+3 health).' },
        rest:   { name: 'Restaurant', icon: '🍽️', cost: 80000, minAge: 21, dem: 700, cap: 160, mar: 5.5, wage: 180, rent: 1800, per: 4, mgrW: 600, mkU: 250, vol: 0.18, maxL: 5, sec: 'retail', deg: ['t_cul'], score: 2000, desc: 'A big kitchen and a big staff. Chefs get +25% margins.' },
        law:    { name: 'Law Firm', icon: '⚖️', cost: 120000, minAge: 24, req: ['jd'], dem: 90, cap: 25, mar: 70, wage: 700, rent: 1500, per: 3, mgrW: 900, mkU: 200, vol: 0.15, maxL: 5, sec: 'finance', score: 3000, desc: 'Needs a law degree (JD). Few clients, huge fees.' },
        clinic: { name: 'Private Clinic', icon: '🏥', cost: 200000, minAge: 24, req: ['md', 'm_nur'], dem: 220, cap: 45, mar: 55, wage: 900, rent: 3500, per: 4, mgrW: 1200, mkU: 300, vol: 0.1, maxL: 5, sec: 'health', score: 4000, desc: "Needs a medical degree or nursing master's." },
        hotel:  { name: 'Boutique Hotel', icon: '🏨', cost: 500000, minAge: 25, dem: 400, cap: 70, mar: 45, wage: 400, rent: 6000, per: 5, mgrW: 2000, mkU: 800, vol: 0.15, maxL: 5, sec: 'media', score: 8000, desc: 'The big leagues. Tourists follow the economy.' }
    };
    const MKT_TIERS = [
        { name: 'None', icon: '🚫', boost: 0, cost: 0 },
        { name: 'Flyers', icon: '📄', boost: 0.2, cost: 1 },
        { name: 'Social ads', icon: '📱', boost: 0.45, cost: 2.5 },
        { name: 'TV campaign', icon: '📺', boost: 0.8, cost: 6 }
    ];
    const MAX_FIRMS = 5;

