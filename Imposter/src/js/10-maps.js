// ==========================================
// MAP DATA (tile coordinates). Rooms + halls are walkable; everything else is wall.
// rooms [name, x, y, w, h, floorA, floorB], halls [x,y,w,h], props [x,y,w,h,kind]
// tasks [kind, x, y] (tile), vents [x, y, group], btn/spawn/fix in tile units (float = exact point)
// ==========================================
const KINDS = {
  wires: { name: 'Re-string the Bell Cords', dur: 5 }, swipe: { name: 'Feed the Music Box', dur: 3 }, align: { name: 'Trim the Lamp Wick', dur: 5 },
  upload: { name: 'Copy the Logbook', dur: 8 }, fuel: { name: 'Fill the Lamp Oil', dur: 6 }, rocks: { name: 'Shoo the Gulls', dur: 7 }, simon: { name: 'Ring the Chimes', dur: 8 }
};
const MAPS = {
  ship: {
    name: 'The Lighthouse', w: 80, h: 54,
    rooms: [
      ['Mess Hall', 28, 3, 24, 14, '#4a3322', '#432d1e'], ['Foghorn Room', 60, 4, 14, 10, '#3d2a1e', '#36251a'], ['Chart Room', 62, 22, 14, 10, '#3e3a34', '#37332d'],
      ['Shutter Loft', 58, 38, 14, 10, '#4a3524', '#42301f'], ['Cellar', 34, 40, 18, 11, '#3b2d22', '#34281e'], ['Lamp Room', 4, 38, 12, 10, '#463a26', '#3e3322'],
      ['Boiler Room', 2, 18, 12, 14, '#3a2f2a', '#332924'], ['Clockwork Loft', 6, 3, 14, 10, '#44301f', '#3c2a1b'], ['Infirmary', 24, 22, 10, 9, '#2f3a36', '#293330'], ['Records Office', 44, 26, 12, 9, '#41302c', '#392a26']],
    halls: [[20, 6, 8, 4], [52, 6, 8, 4], [46, 17, 4, 9], [30, 17, 4, 5], [8, 13, 4, 5], [6, 32, 4, 6], [16, 43, 18, 4], [48, 35, 4, 5], [52, 42, 6, 4], [56, 28, 6, 4], [66, 14, 4, 8], [68, 32, 4, 6], [34, 26, 10, 4], [14, 22, 10, 4]],
    props: [[38, 8, 4, 3, 'table'], [32, 12, 3, 2, 'table2'], [46, 12, 3, 2, 'table2'], [6, 23, 4, 4, 'core'], [38, 44, 3, 2, 'crate'], [44, 44, 3, 2, 'crate'], [40, 47, 2, 2, 'crate'],
      [26, 25, 3, 2, 'bed'], [30, 25, 3, 2, 'bed'], [48, 29, 4, 3, 'table'], [68, 25, 4, 2, 'console'], [67, 7, 3, 3, 'gun'], [63, 41, 4, 3, 'console'], [11, 6, 4, 4, 'engine'], [9, 43, 3, 3, 'panel']],
    tasks: [['align', 8, 4], ['fuel', 17, 11], ['simon', 4, 20], ['wires', 11, 30], ['upload', 30, 4], ['wires', 50, 4], ['rocks', 62, 5], ['simon', 72, 5], ['align', 64, 23], ['upload', 74, 30],
      ['swipe', 60, 39], ['rocks', 71, 46], ['fuel', 36, 41], ['wires', 50, 49], ['wires', 5, 39], ['swipe', 6, 46], ['simon', 25, 23], ['rocks', 33, 29], ['swipe', 46, 27], ['fuel', 54, 33], ['upload', 45, 33], ['upload', 40, 49]],
    vents: [[18, 12, 0], [3, 30, 0], [14, 46, 0], [73, 12, 1], [63, 30, 1], [59, 46, 1], [55, 34, 2], [25, 29, 2], [35, 49, 2]],
    btn: [40, 9.5], spawn: [40, 9.5, 4.3, 3.9], lights: [14.5, 39.5], reactor: [[3.5, 25.5], [18.5, 4.5]]
  },
  base: {
    name: 'Cliffside Station', w: 64, h: 44,
    rooms: [
      ['Observatory', 4, 3, 14, 10, '#4a3322', '#432d1e'], ['Conservatory', 24, 2, 16, 8, '#3d2a1e', '#36251a'], ['Signal Room', 46, 3, 14, 10, '#3e3a34', '#37332d'], ['Great Hall', 24, 14, 16, 12, '#4a3524', '#42301f'],
      ['Bunk Room', 4, 18, 14, 10, '#3b2d22', '#34281e'], ['Boathouse', 46, 18, 14, 10, '#463a26', '#3e3322'], ['Coal Store', 4, 32, 14, 9, '#3a2f2a', '#332924'], ['Landing Dock', 26, 32, 12, 9, '#44301f', '#3c2a1b'], ['Warehouse', 46, 32, 14, 9, '#2f3a36', '#293330']],
    halls: [[18, 5, 6, 4], [40, 5, 6, 4], [30, 10, 4, 4], [8, 13, 4, 5], [18, 19, 6, 4], [40, 19, 6, 4], [52, 13, 4, 5], [8, 28, 4, 4], [30, 26, 4, 6], [52, 28, 4, 4], [38, 35, 8, 4], [18, 35, 8, 4]],
    props: [[30, 19, 4, 3, 'table'], [8, 6, 6, 2, 'console'], [28, 5, 3, 2, 'planter'], [35, 5, 3, 2, 'planter'], [6, 21, 3, 2, 'bed'], [6, 24, 3, 2, 'bed'], [50, 21, 6, 3, 'console'], [8, 35, 6, 2, 'engine'], [30, 35, 4, 3, 'core'], [50, 35, 3, 2, 'crate'], [54, 36, 2, 2, 'crate']],
    tasks: [['simon', 5, 4], ['wires', 16, 11], ['fuel', 26, 3], ['wires', 38, 8], ['upload', 47, 4], ['simon', 58, 4], ['swipe', 25, 15], ['align', 39, 25], ['align', 5, 19], ['wires', 10, 26],
      ['fuel', 47, 19], ['rocks', 58, 19], ['wires', 5, 33], ['fuel', 6, 40], ['rocks', 27, 33], ['simon', 37, 40], ['wires', 47, 33], ['upload', 47, 40], ['swipe', 58, 33], ['rocks', 38, 17], ['swipe', 12, 34]],
    vents: [[16, 12, 0], [16, 27, 0], [16, 40, 0], [58, 12, 1], [58, 27, 1], [58, 40, 1], [26, 9, 2], [38, 21, 2], [36, 40, 2]],
    btn: [32, 20.5], spawn: [32, 20.5, 4.4, 3.4], lights: [16.5, 33.5], reactor: [[9.5, 33.5], [53.5, 4.5]]
  }
};
const MAP_KEYS = ['ship', 'base'];
