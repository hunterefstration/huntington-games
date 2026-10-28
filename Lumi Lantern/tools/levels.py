#!/usr/bin/env python3
"""Builds Lumi's Lantern's levels and checks that each one can be finished with the moves that world has.

    python3 "Lumi Lantern/tools/levels.py"        writes src/js/70-levels.js and prints a report

Levels are drawn with small helpers (ground, pits, ledges, things at coordinates) instead of typed ASCII, so
columns always line up. The checker walks a simplified model of the player's moves over the tiles (jump heights and
distances below are a little shorter than the real ones) and reports anything it cannot reach: the gate, every
spark, every star moth, every lantern."""
import json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'js', '70-levels.js')

class Lv:
    def __init__(s, id, name, world, w, h, gives=None, hint=''):
        s.id, s.name, s.world, s.w, s.h, s.gives, s.hint = id, name, world, w, h, gives, hint
        s.g = [[' '] * w for _ in range(h)]
    def put(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = ch
    def text(s, x, y, t):
        for i, ch in enumerate(t):
            if ch != '.': s.put(x + i, y, ch)
    def rect(s, x0, y0, x1, y1, ch='#'):          # inclusive
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, ch)
    def ground(s, x0, x1, top, ch='#'): s.rect(x0, top, x1, s.h - 1, ch)
    def pit(s, x0, x1, top=0): s.rect(x0, top, x1, s.h - 1, ' ')
    def ledge(s, x0, x1, y, ch='='): s.rect(x0, y, x1, y, ch)
    def row(s, x, y, t, step=1):
        for i, ch in enumerate(t.split()): s.put(x + i * step, y, ch)
    def arc(s, x0, y0, n=5, h=2):                 # sparks over a jump
        for i in range(n):
            t = i / max(1, n - 1); s.put(x0 + i, y0 - round(4 * h * t * (1 - t)), 'o')
    def map(s): return [''.join(r).rstrip() for r in s.g]

LEVELS = []
def level(fn): LEVELS.append(fn()); return fn

# =====================================================================  WORLD 1: GLOWWOOD (run + jump)
@level
def l11():
    v = Lv('1-1', 'First Light', 0, 124, 18, hint='Arrows or A/D to run, Space to jump')
    v.ground(0, 123, 14)
    v.put(3, 13, 'P')
    v.rect(10, 13, 11, 13); v.rect(14, 12, 15, 13); v.arc(9, 11, 8, 1)
    v.pit(19, 21, 14); v.arc(18, 12, 5, 2)
    v.put(27, 13, 'L')
    v.put(34, 13, 'g'); v.row(30, 12, 'o o o o o', 2)
    v.ledge(42, 44, 11); v.ledge(46, 48, 8); v.ledge(50, 53, 5); v.put(52, 4, '*'); v.row(42, 10, 'o o o'); v.row(46, 7, 'o o o')
    v.rect(56, 13, 66, 13, '^'); v.rect(60, 12, 62, 13); v.arc(56, 11, 5, 1); v.arc(62, 11, 5, 1)
    v.put(64, 13, 'S'); v.ledge(66, 75, 6, '#'); v.row(67, 5, 'o o o o o', 2); v.put(75, 5, '*'); v.row(63, 9, 'o o o')
    v.put(80, 13, 'L')
    v.pit(85, 103, 14)
    v.rect(88, 12, 89, 12); v.rect(93, 11, 94, 11); v.rect(98, 12, 99, 12)
    v.arc(85, 10, 4, 1); v.arc(90, 9, 4, 1); v.arc(95, 9, 4, 1)
    v.put(99, 11, 'g')
    # a little cave under the last stretch: drop in for the third moth
    v.rect(106, 14, 116, 14, ' '); v.rect(106, 15, 116, 15, ' '); v.put(111, 15, '*'); v.rect(107, 14, 115, 14, '#'); v.put(106, 14, ' ')
    v.put(119, 13, 'E')
    return v

@level
def l12():
    v = Lv('1-2', 'Mossy Steps', 0, 130, 22)
    v.ground(0, 18, 18); v.put(3, 17, 'P')
    v.rect(19, 15, 25, 21); v.rect(26, 12, 31, 21); v.rect(32, 9, 37, 21); v.row(20, 13, 'o o o'); v.row(27, 10, 'o o o'); v.row(32, 7, 'o o')
    v.put(35, 8, 'L')
    v.pit(38, 46, 0); v.ledge(40, 41, 9); v.ledge(44, 45, 7); v.row(40, 8, 'o o'); v.row(44, 6, 'o o')
    v.rect(47, 9, 60, 21); v.put(52, 8, 'g'); v.put(58, 8, 'g')
    v.rect(53, 3, 54, 3); v.put(53, 2, '*')                 # a high perch: reach it from the ledges
    v.ledge(49, 51, 5)
    v.pit(61, 67, 0); v.rect(63, 12, 64, 21); v.put(64, 11, 'S')
    v.rect(68, 4, 76, 4); v.row(69, 3, 'o o o o o', 2); v.put(76, 3, 'L')
    v.rect(68, 12, 90, 21); v.rect(72, 11, 74, 11, '^'); v.rect(80, 11, 82, 11, '^'); v.put(77, 11, 'g'); v.arc(71, 9, 5, 1); v.arc(79, 9, 5, 1)
    v.put(84, 11, 'L')
    v.ledge(77, 79, 7); v.ledge(70, 72, 7)                 # back up to the top route from below
    v.rect(77, 4, 84, 4); v.ledge(85, 87, 4); v.put(87, 3, '*')
    v.pit(91, 99, 0); v.rect(93, 13, 94, 21); v.rect(97, 11, 98, 21); v.arc(91, 11, 4, 1)
    v.rect(99, 11, 129, 21); v.put(104, 10, 'g'); v.put(110, 10, 'g')
    v.rect(112, 8, 113, 10, '#'); v.rect(116, 6, 117, 10, '#'); v.ledge(119, 121, 6)
    v.rect(118, 12, 122, 13, ' '); v.put(120, 13, '*'); v.rect(118, 14, 122, 14, '#'); v.rect(123, 11, 123, 13, '#'); v.put(118, 11, ' '); v.put(117, 11, '#')
    v.put(126, 10, 'E')
    return v

@level
def l13():
    v = Lv('1-3', 'Firefly Hollow', 0, 136, 22)
    v.ground(0, 12, 18); v.put(3, 17, 'P')
    v.ground(13, 16, 16); v.row(9, 15, 'o o o')
    # a crumbling bridge under a bat
    v.pit(17, 30, 0); v.rect(17, 16, 30, 16, 'C'); v.put(24, 12, 'b'); v.row(18, 14, 'o o o o o o o', 2)
    v.ground(31, 40, 16); v.put(34, 15, 'L')
    # ledges over a spike floor; the first moth floats over the highest one
    v.pit(41, 62, 0); v.ground(41, 62, 21); v.rect(41, 20, 62, 20, '^')
    v.ledge(43, 45, 14); v.ledge(48, 50, 12); v.ledge(53, 55, 14); v.ledge(58, 60, 15)
    v.put(49, 9, '*'); v.row(43, 13, 'o o o'); v.row(53, 13, 'o o o')
    v.ground(63, 80, 16); v.put(66, 15, 'L'); v.put(72, 15, 'g'); v.put(78, 15, 't')
    # up the old tree for the key
    v.ground(81, 82, 13); v.ground(83, 84, 10); v.ground(85, 96, 7); v.put(92, 6, 'k'); v.row(86, 5, 'o o o o o', 2)
    v.rect(95, 2, 97, 2); v.put(96, 1, '*'); v.ledge(92, 93, 4)
    # down the far side into the hollow, then the locked door
    v.ledge(97, 99, 10); v.ground(100, 104, 13); v.ground(105, 108, 16); v.put(106, 15, 'g')
    v.ground(109, 122, 13); v.rect(109, 10, 109, 12, 'D'); v.rect(109, 0, 109, 9)
    v.put(113, 12, 'L'); v.row(115, 12, 'o o o o', 1)
    v.pit(110, 112, 14); v.rect(110, 16, 112, 16); v.rect(110, 17, 112, 21); v.put(111, 15, '*'); v.put(110, 13, ' ')
    v.ground(123, 135, 13); v.put(128, 12, 'g'); v.put(132, 12, 'E')
    return v

@level
def l14():
    v = Lv('1-4', 'The Old Root', 0, 140, 22, gives='double')
    v.ground(0, 22, 18); v.put(3, 17, 'P')
    v.ledge(10, 12, 15); v.ledge(15, 17, 13); v.put(16, 10, '*')
    # stepping stones over a drop, a bat in the way
    v.pit(23, 37, 0); v.ground(25, 26, 16); v.ground(30, 31, 15); v.ground(35, 36, 16); v.put(28, 11, 'b')
    v.arc(22, 14, 4, 1); v.arc(27, 13, 4, 1); v.arc(32, 13, 4, 1)
    v.ground(38, 52, 16); v.put(41, 15, 'L'); v.put(46, 15, 'h'); v.row(43, 12, 'o o o o')
    # a spring up to the high road over a field of spikes
    v.put(52, 15, 'S'); v.ground(53, 76, 16); v.rect(54, 15, 75, 15, '^')
    v.rect(53, 8, 60, 8); v.rect(64, 8, 76, 8); v.row(54, 7, 'o o o o o o'); v.put(62, 5, '*')
    v.put(68, 7, 'g'); v.put(74, 7, 'L')
    # stepping stones again, higher this time
    v.pit(77, 86, 0); v.ground(80, 81, 10); v.ground(84, 86, 9); v.arc(76, 6, 5, 1); v.arc(81, 6, 4, 1)
    v.ground(87, 105, 9); v.put(92, 6, 'b'); v.put(98, 8, 't'); v.put(102, 8, 'L')
    v.ground(106, 139, 12); v.rect(109, 11, 111, 11, '^'); v.arc(108, 9, 5, 1)
    v.put(118, 11, 'g'); v.put(124, 11, 'g')
    v.rect(126, 9, 128, 9); v.put(127, 8, '*')
    v.put(131, 11, 'u'); v.put(136, 11, 'E')
    return v

# =====================================================================  WORLD 2: HOLLOW CAVES (+ double jump)
@level
def l21():
    v = Lv('2-1', 'Into the Dark', 1, 130, 22)
    v.rect(0, 0, 129, 1); v.ground(0, 15, 18); v.put(3, 17, 'P')
    v.ground(16, 30, 13); v.row(17, 9, 'o o o'); v.put(25, 12, 'g'); v.put(28, 12, 'L')     # too tall for one jump: jump twice
    v.pit(31, 44, 0); v.ground(31, 44, 21); v.rect(31, 20, 44, 20, '^')
    v.ledge(33, 35, 11); v.ledge(38, 40, 9); v.ledge(42, 44, 11); v.put(39, 4, '*'); v.row(33, 10, 'o o o'); v.row(38, 8, 'o o o')
    v.ground(45, 60, 13); v.put(48, 12, 'L'); v.put(53, 9, 'b'); v.put(57, 12, 'g')
    v.ground(61, 64, 7); v.row(61, 5, 'o o o o')
    v.ground(65, 80, 15); v.put(70, 14, 'g'); v.put(76, 14, 'L'); v.arc(65, 12, 6, 2)
    v.pit(81, 92, 0); v.ground(83, 84, 12); v.ground(88, 89, 10); v.put(86, 7, 'b'); v.put(90, 4, '*'); v.arc(81, 9, 4, 2); v.arc(86, 7, 4, 2)
    v.ground(93, 129, 13); v.put(98, 12, 'g'); v.put(104, 12, 't'); v.put(110, 12, 'L')
    v.ledge(115, 117, 7); v.put(116, 6, '*'); v.rect(114, 2, 114, 6); v.rect(118, 2, 118, 6)
    v.put(125, 12, 'E')
    return v

@level
def l22():
    v = Lv('2-2', 'Crystal Stair', 1, 120, 30)
    v.rect(0, 0, 119, 1); v.ground(0, 119, 27); v.put(3, 26, 'P')
    v.rect(9, 22, 13, 26); v.rect(16, 17, 20, 26); v.arc(8, 20, 5, 2); v.arc(14, 15, 5, 2)
    v.ledge(23, 26, 13); v.ledge(18, 21, 9); v.put(19, 8, 'L'); v.row(22, 12, 'o o o o')
    v.rect(27, 9, 40, 9); v.put(33, 8, 'g'); v.rect(27, 10, 27, 26, '#'); v.rect(28, 26, 50, 26, '^')
    v.ledge(32, 34, 21); v.put(33, 20, '*'); v.ledge(37, 39, 17)
    v.rect(41, 5, 41, 9); v.ledge(42, 46, 9); v.put(44, 4, 'b')
    v.rect(47, 12, 52, 26); v.put(50, 11, 'L')
    v.pit(53, 70, 2); v.ledge(55, 57, 9); v.ledge(60, 62, 6); v.ledge(65, 67, 9); v.put(66, 13, 'b')
    v.arc(53, 7, 5, 2); v.arc(58, 4, 5, 2); v.arc(63, 7, 5, 2); v.put(61, 3, '*')
    v.rect(71, 11, 82, 26); v.put(74, 10, 't'); v.put(79, 10, 'L')
    # a shaft down to a moth, with ledges to climb back out
    v.ledge(84, 86, 15); v.ledge(89, 91, 19); v.ledge(85, 87, 22); v.rect(83, 26, 96, 26, '^'); v.put(86, 21, '*')
    v.ledge(92, 94, 15); v.ledge(88, 90, 11)
    v.rect(95, 11, 119, 26); v.put(102, 10, 'h'); v.put(116, 10, 'E')
    v.row(100, 8, 'o o o o o o', 2)
    return v

@level
def l23():
    v = Lv('2-3', 'Drip Tunnels', 1, 150, 22)
    v.rect(0, 0, 149, 2); v.ground(0, 149, 18); v.put(3, 17, 'P')
    v.rect(10, 3, 12, 12); v.rect(16, 14, 22, 17); v.arc(13, 12, 4, 2)
    v.pit(23, 40, 18); v.put(26, 15, 'M'); v.put(27, 15, 'M'); v.put(23, 15, '|'); v.put(39, 15, '|'); v.row(26, 13, 'o o o o o o', 2)
    v.rect(41, 14, 50, 17); v.put(44, 13, 'L'); v.put(48, 13, 'g')
    v.rect(51, 3, 52, 10); v.rect(54, 14, 54, 17); v.pit(55, 70, 18); v.rect(55, 17, 70, 17, '^')
    v.ledge(57, 58, 14); v.ledge(62, 63, 12); v.ledge(67, 68, 14); v.put(62, 9, 'b'); v.put(63, 5, '*'); v.ledge(60, 65, 6)
    v.rect(71, 14, 90, 17); v.put(75, 13, 'L'); v.put(80, 13, 'h'); v.put(86, 13, 't')
    v.rect(91, 3, 92, 11); v.pit(91, 108, 18); v.put(95, 16, 'N'); v.put(96, 16, 'N'); v.put(95, 7, '|'); v.put(95, 17, '|')
    v.ledge(100, 102, 7); v.put(101, 6, '*'); v.ledge(104, 106, 10)
    v.rect(109, 10, 125, 17); v.put(112, 9, 'L'); v.put(118, 9, 'g'); v.put(122, 9, 'g'); v.row(113, 6, 'o o o o o', 2)
    v.rect(126, 13, 149, 17); v.rect(130, 12, 133, 12, '^'); v.rect(137, 12, 140, 12, '^'); v.put(135, 12, 'b')
    v.rect(141, 4, 143, 4); v.put(142, 3, '*'); v.ledge(138, 139, 8)
    v.put(146, 12, 'E')
    return v

@level
def l24():
    v = Lv('2-4', 'The Deep Bell', 1, 126, 32, gives='wall')
    v.rect(0, 0, 125, 1); v.ground(0, 125, 28); v.put(3, 27, 'P')
    v.rect(8, 24, 11, 27); v.rect(14, 20, 17, 27); v.rect(20, 16, 23, 27); v.rect(26, 12, 29, 27); v.put(28, 11, 'L')
    v.arc(7, 22, 5, 2); v.arc(13, 18, 5, 2); v.arc(19, 14, 5, 2)
    v.pit(30, 50, 2); v.rect(30, 27, 50, 27, '^')
    v.rect(33, 12, 34, 12, 'C'); v.rect(38, 10, 39, 10, 'C'); v.rect(43, 12, 44, 12, 'C'); v.rect(47, 9, 48, 9, 'C')
    v.put(41, 6, 'b'); v.row(33, 9, 'o o o o o o o o', 2); v.put(40, 4, '*'); v.ledge(39, 41, 5)
    v.rect(51, 10, 64, 27); v.put(54, 9, 'L'); v.put(59, 9, 'h'); v.put(63, 9, 'k')
    v.rect(65, 5, 66, 9, 'D'); v.rect(65, 2, 66, 4); v.rect(67, 10, 72, 27); v.put(70, 9, 'g')
    v.rect(73, 14, 73, 27); v.pit(74, 92, 2); v.rect(74, 27, 92, 27, '^')
    v.put(76, 12, 'M'); v.put(77, 12, 'M'); v.put(74, 12, '|'); v.put(91, 12, '|'); v.put(82, 8, 'b'); v.put(84, 5, '*'); v.ledge(83, 85, 6)
    v.rect(93, 12, 125, 27); v.put(96, 11, 'L'); v.put(101, 11, 't'); v.put(108, 11, 'g')
    v.rect(112, 17, 116, 20, ' '); v.rect(112, 12, 116, 16, ' '); v.put(114, 20, '*'); v.rect(112, 21, 116, 21, '#'); v.put(112, 12, '#'); v.put(116, 12, '#')
    v.put(118, 11, 'u'); v.put(122, 11, 'E')
    return v

# =====================================================================  WORLD 3: SKY RUINS (+ wall jump)
@level
def l31():
    v = Lv('3-1', 'Cloud Steps', 2, 140, 30)
    v.ground(0, 22, 26); v.put(3, 25, 'P')
    v.rect(15, 9, 15, 22); v.rect(19, 11, 19, 25)              # first shaft: jump from wall to wall (walls 3 apart)
    v.row(16, 20, 'o o o'); v.row(16, 14, 'o o o')
    v.rect(20, 11, 30, 11); v.put(24, 10, 'L'); v.put(28, 10, 'g')
    v.ledge(33, 35, 13); v.ledge(38, 40, 11); v.put(39, 6, '*')
    v.rect(41, 10, 57, 10); v.rect(47, 9, 49, 9, '^'); v.put(44, 9, 'g'); v.put(53, 9, 'L')
    # a well: drop in for a moth, climb out the other side (or just jump over it)
    v.rect(57, 11, 57, 24); v.rect(61, 8, 61, 24); v.rect(58, 25, 60, 25); v.put(59, 24, '*'); v.row(58, 18, 'o o o')
    v.rect(62, 8, 76, 8); v.put(68, 6, 'b'); v.put(74, 7, 'L')
    v.rect(79, 10, 80, 10, 'C'); v.rect(84, 10, 85, 10, 'C'); v.rect(89, 10, 90, 10, 'C'); v.put(87, 4, '*')
    v.arc(77, 8, 4, 1); v.arc(81, 8, 4, 1); v.arc(86, 8, 4, 1)
    v.rect(93, 9, 113, 9); v.put(97, 8, 't'); v.put(104, 8, 'h'); v.put(110, 8, 'L')
    # down the far side and up the last tower
    v.ground(114, 118, 20); v.rect(115, 2, 115, 14); v.rect(119, 6, 119, 20); v.row(116, 12, 'o o o')
    v.rect(120, 6, 139, 6); v.put(128, 5, 'g'); v.put(136, 5, 'E')
    return v

@level
def l32():
    v = Lv('3-2', 'Bell Towers', 2, 100, 36)
    v.ground(0, 99, 33); v.put(3, 32, 'P')
    v.rect(10, 6, 10, 29); v.rect(14, 4, 14, 32); v.put(12, 18, '*'); v.row(11, 26, 'o o o'); v.row(11, 12, 'o o o')
    v.rect(15, 4, 30, 4); v.put(18, 3, 'L'); v.put(24, 3, 'g'); v.row(19, 1, 'o o o o o', 2)
    v.put(33, 32, 'L'); v.rect(36, 32, 41, 32, '^'); v.rect(46, 32, 51, 32, '^'); v.rect(38, 29, 39, 29, 'C'); v.rect(48, 29, 49, 29, 'C')
    v.put(44, 32, 'g'); v.put(54, 32, 'g'); v.arc(35, 28, 8, 1); v.arc(45, 28, 8, 1)
    v.rect(57, 8, 57, 29); v.rect(61, 6, 61, 32); v.put(59, 14, '*'); v.row(58, 24, 'o o o')
    v.rect(62, 6, 80, 6); v.put(66, 5, 'h'); v.put(72, 5, 't'); v.put(77, 5, 'L')
    v.put(83, 8, 'M'); v.put(84, 8, 'M'); v.put(81, 8, '|'); v.put(91, 8, '|'); v.put(86, 3, '*'); v.put(87, 5, 'b')
    v.rect(92, 8, 99, 8); v.put(96, 7, 'E')
    return v

@level
def l33():
    v = Lv('3-3', 'Wind Temple', 2, 140, 28)
    v.ground(0, 12, 24); v.put(3, 23, 'P')
    v.put(15, 21, 'M'); v.put(16, 21, 'M'); v.put(13, 21, '|'); v.put(27, 21, '|'); v.row(15, 18, 'o o o o o o', 2)
    v.ground(28, 44, 18); v.put(31, 17, 'L'); v.put(36, 17, 'g')
    v.rect(41, 2, 41, 15); v.rect(45, 5, 45, 17); v.row(42, 13, 'o o o'); v.row(42, 8, 'o o o')
    v.rect(46, 5, 60, 5); v.put(49, 4, 'L'); v.put(54, 4, 'h'); v.put(58, 2, 'b')
    v.pit(61, 78, 6); v.ground(61, 78, 27); v.rect(61, 26, 78, 26, '^')
    v.ledge(63, 65, 9); v.ledge(68, 70, 12); v.ledge(73, 75, 9); v.put(69, 7, '*'); v.arc(62, 7, 4, 1); v.arc(72, 7, 4, 1)
    v.ground(79, 95, 10); v.put(82, 9, 'L'); v.put(88, 9, 't'); v.put(93, 9, 'k')
    v.rect(96, 6, 96, 9, 'D'); v.rect(96, 0, 96, 5)
    v.ground(97, 110, 10); v.put(104, 9, 'g'); v.put(108, 9, 'L'); v.ledge(101, 103, 5); v.put(102, 4, '*')
    v.pit(111, 125, 0); v.ground(112, 114, 13); v.put(113, 12, 'S'); v.rect(117, 4, 123, 4); v.put(121, 3, '*'); v.put(124, 7, 'b')
    v.ground(126, 139, 8); v.put(131, 7, 'h'); v.put(136, 7, 'E')
    return v

@level
def l34():
    v = Lv('3-4', 'The Sun Shrine', 2, 130, 34, gives='dash')
    v.ground(0, 22, 30); v.put(3, 29, 'P'); v.put(9, 29, 'L')
    v.rect(19, 9, 19, 26); v.rect(23, 11, 23, 29); v.row(20, 22, 'o o o'); v.row(20, 15, 'o o o')
    v.rect(24, 11, 38, 11); v.put(27, 10, 'L'); v.put(33, 10, 'h')
    v.rect(41, 13, 42, 13, 'C'); v.rect(46, 11, 47, 11, 'C'); v.rect(51, 13, 52, 13, 'C'); v.rect(56, 11, 57, 11, 'C')
    v.put(49, 7, 'b'); v.ledge(45, 49, 5); v.put(47, 4, '*'); v.row(41, 10, 'o o o o o o o o', 2)
    v.rect(59, 11, 75, 11); v.put(62, 10, 'L'); v.put(68, 10, 't')
    v.rect(76, 12, 76, 26); v.rect(80, 12, 80, 26); v.rect(77, 27, 79, 27); v.put(78, 26, '*'); v.row(77, 20, 'o o o')
    v.rect(81, 12, 97, 12); v.put(85, 11, 'g'); v.put(91, 11, 'h'); v.put(95, 11, 'L')
    v.put(101, 13, 'N'); v.put(102, 13, 'N'); v.put(101, 5, '|'); v.put(101, 17, '|'); v.ledge(104, 106, 7); v.put(105, 6, '*')
    v.ground(107, 129, 9); v.put(112, 8, 'L'); v.put(119, 8, 'u'); v.put(126, 8, 'E')
    return v

# =====================================================================  WORLD 4: EMBER FORGE (+ dash)
@level
def l41():
    v = Lv('4-1', 'Furnace Gate', 3, 140, 22)
    v.rect(0, 0, 139, 1); v.ground(0, 16, 18); v.put(3, 17, 'P'); v.put(10, 17, 'L')
    v.rect(17, 19, 26, 21, 'l'); v.row(18, 14, 'o o o o o', 2)                          # first dash: jump, then dash across
    v.ground(27, 44, 18); v.put(31, 17, 'g'); v.put(40, 17, 'L')
    v.rect(45, 19, 60, 21, 'l'); v.ground(48, 49, 15); v.ground(53, 54, 12); v.ground(58, 59, 15); v.put(53, 8, 'b')
    v.ledge(52, 56, 6); v.put(54, 5, '*'); v.arc(45, 13, 4, 1); v.arc(50, 10, 4, 1); v.arc(55, 10, 4, 1)
    v.ground(61, 83, 18); v.put(66, 17, 'h'); v.put(72, 17, 'h'); v.put(77, 17, 'L')
    v.ground(84, 98, 18); v.rect(84, 17, 95, 17, 'l'); v.ledge(86, 87, 14); v.ledge(92, 93, 14); v.put(89, 8, '*')
    v.ground(99, 139, 18); v.put(103, 17, 't'); v.put(108, 17, 'L'); v.put(114, 17, 'g')
    v.rect(118, 17, 124, 17, 'l'); v.row(118, 14, 'o o o o', 2)
    v.ledge(127, 129, 12); v.put(128, 11, '*')
    v.put(136, 17, 'E')
    return v

@level
def l42():
    v = Lv('4-2', 'Cooling Pipes', 3, 126, 36)
    v.rect(0, 0, 125, 1); v.rect(15, 33, 125, 35, 'l'); v.ground(0, 14, 32); v.put(3, 31, 'P'); v.put(8, 31, 'L')
    v.ground(15, 18, 29); v.ground(22, 25, 26); v.ground(29, 37, 23)
    v.rect(34, 8, 34, 20); v.rect(38, 6, 38, 23); v.row(35, 17, 'o o o'); v.row(35, 11, 'o o o')
    v.rect(39, 6, 58, 6); v.put(43, 5, 'h'); v.put(49, 5, 'L'); v.put(54, 3, 'b')
    v.rect(58, 7, 58, 19); v.rect(62, 7, 62, 19); v.rect(59, 20, 61, 20); v.put(60, 19, '*'); v.rect(59, 6, 61, 6, ' ')
    v.rect(63, 7, 78, 7); v.put(67, 6, 't'); v.put(73, 6, 'L')
    v.put(81, 9, 'M'); v.put(82, 9, 'M'); v.put(79, 9, '|'); v.put(96, 9, '|'); v.put(90, 4, '*'); v.put(85, 6, 'b')
    v.ground(97, 125, 10); v.rect(97, 33, 125, 35, '#'); v.put(101, 9, 'h'); v.put(107, 9, 'g'); v.rect(110, 9, 112, 9, 'l'); v.row(110, 6, 'o o o')
    v.rect(114, 11, 118, 13, ' '); v.put(113, 10, ' '); v.rect(113, 11, 113, 13, ' '); v.put(116, 13, '*')
    v.put(122, 9, 'E')
    return v

@level
def l43():
    v = Lv('4-3', 'The Crucible', 3, 150, 26)
    v.rect(0, 0, 149, 1); v.ground(0, 12, 22); v.put(3, 21, 'P'); v.put(9, 21, 'L'); v.rect(13, 24, 149, 25, 'l')
    v.rect(16, 18, 17, 18, 'C'); v.rect(21, 16, 22, 16, 'C'); v.rect(26, 18, 27, 18, 'C'); v.rect(31, 15, 32, 15, 'C'); v.row(15, 14, 'o o o o o o o o o', 2)
    v.ground(35, 46, 15); v.rect(35, 24, 46, 25, '#'); v.put(38, 14, 'L'); v.put(43, 14, 'h')
    v.put(50, 18, 'N'); v.put(51, 18, 'N'); v.put(50, 5, '|'); v.put(50, 20, '|'); v.put(54, 11, 'b')
    v.ground(55, 70, 7); v.rect(55, 24, 70, 25, '#'); v.put(58, 6, 't'); v.put(63, 6, 'g'); v.put(68, 6, 'L'); v.put(63, 3, '*')
    v.ledge(73, 75, 9); v.ledge(80, 82, 7); v.ledge(87, 89, 9); v.put(84, 4, 'b'); v.put(81, 3, '*'); v.row(72, 6, 'o o o o o o o o o', 2)
    v.ground(92, 107, 10); v.rect(92, 24, 107, 25, '#'); v.put(95, 9, 'L'); v.put(100, 9, 'h'); v.put(104, 9, 'h')
    v.rect(107, 11, 107, 21); v.rect(111, 11, 111, 21); v.rect(108, 22, 110, 22); v.put(109, 21, '*'); v.row(108, 15, 'o o o')
    v.ground(112, 149, 11); v.rect(112, 24, 149, 25, '#'); v.put(118, 10, 'L'); v.put(124, 10, 't'); v.put(130, 10, 'g'); v.rect(134, 10, 138, 10, 'l'); v.row(134, 7, 'o o o')
    v.put(146, 10, 'E')
    return v

@level
def l44():
    v = Lv('4-4', 'Heart of Embers', 3, 150, 30, gives=None)
    v.rect(0, 0, 149, 1); v.ground(0, 14, 26); v.put(3, 25, 'P'); v.put(10, 25, 'L'); v.rect(15, 28, 149, 29, 'l')
    v.put(17, 22, 'M'); v.put(18, 22, 'M'); v.put(15, 22, '|'); v.put(30, 22, '|'); v.put(24, 17, 'b'); v.row(17, 19, 'o o o o o o o', 2)
    v.ground(31, 49, 19); v.rect(31, 28, 49, 29, '#'); v.put(34, 18, 'L'); v.put(39, 18, 'h'); v.put(43, 18, 'k')
    v.rect(46, 3, 46, 15); v.rect(50, 6, 50, 18); v.put(48, 10, '*'); v.row(47, 14, 'o o o')
    v.rect(51, 6, 80, 6); v.put(55, 5, 'L'); v.put(60, 5, 't'); v.rect(64, 2, 64, 5, 'D'); v.put(71, 5, 'h'); v.put(77, 5, 'L')
    v.ledge(83, 85, 9); v.ledge(90, 92, 12); v.ledge(97, 99, 9); v.put(98, 4, '*'); v.put(91, 7, 'b')
    v.ground(102, 116, 10); v.rect(102, 28, 116, 29, '#'); v.put(105, 9, 'L'); v.put(110, 9, 'g'); v.put(114, 9, 'h')
    v.rect(120, 12, 121, 12, 'C'); v.rect(125, 10, 126, 10, 'C'); v.rect(130, 12, 131, 12, 'C'); v.put(126, 5, '*')
    v.ground(134, 149, 10); v.rect(134, 28, 149, 29, '#'); v.put(138, 9, 'L'); v.put(146, 9, 'E')
    return v

# =====================================================================  FINAL: THE GLOOM
@level
def l51():
    v = Lv('5-1', 'The Gloom', 4, 46, 20)
    v.rect(0, 0, 45, 1); v.ground(0, 45, 16); v.rect(0, 2, 0, 15); v.rect(45, 2, 45, 15)
    v.put(4, 15, 'P'); v.put(8, 15, 'L')
    v.ledge(8, 12, 11); v.ledge(33, 37, 11); v.ledge(20, 25, 7)
    v.put(23, 12, 'G'); v.put(40, 15, 'E')
    return v

# =====================================================================  checker
SOLIDS = set('#CD')
def check(v, ab, doors_open=False):
    SOLIDS = set('#C') if doors_open else set('#CD')
    g, W, H = v.g, v.w, v.h
    def t(x, y):
        if x < 0 or x >= W: return '#'
        if y < 0 or y >= H: return ' '
        return g[y][x]
    def free(x, y): return t(x, y) not in SOLIDS and t(x, y) not in '^l' and 0 <= x < W and y < H
    mover = set()
    for y in range(H):
        for x in range(W):
            if g[y][x] == 'M':
                a = x
                while a > 0 and t(a - 1, y) == ' ': a -= 1
                b = x
                while b < W - 1 and t(b + 1, y) in ' M': b += 1
                for k in range(a, b + 1): mover.add((k, y))
            if g[y][x] == 'N':
                a = y
                while a > 0 and t(x, a - 1) in ' ': a -= 1
                b = y
                while b < H - 1 and t(x, b + 1) in ' N': b += 1
                for k in range(a, b + 1): mover.add((x, k)); mover.add((x + 1, k))
    def floor(x, y): return t(x, y + 1) in SOLIDS or t(x, y + 1) in '=S' or (x, y + 1) in mover
    def stand(x, y): return free(x, y) and floor(x, y)
    H1 = 3 + (3 if ab['double'] else 0)
    DX = 5 + (2 if ab['double'] else 0) + (4 if ab['dash'] else 0)
    start = next((x, y) for y in range(H) for x in range(W) if g[y][x] == 'P')
    seen, q, air = {start}, collections.deque([start]), set()
    def clear_path(x0, y0, x1, y1, top):
        # up from (x0,y0) to the top row, across, then down to (x1,y1); or across first
        def col(x, a, b): return all(free(x, yy) for yy in range(min(a, b), max(a, b) + 1))
        def rowc(y, a, b): return all(free(xx, y) for xx in range(min(a, b), max(a, b) + 1))
        return (col(x0, y0, top) and rowc(top, x0, x1) and col(x1, top, y1)) or (rowc(y0, x0, x1) and col(x1, y0, y1))
    while q:
        x, y = q.popleft()
        spring = t(x, y) == 'S' or t(x, y + 1) == 'S'
        up = 9 + (3 if ab['double'] else 0) if spring else H1
        # every place in reach from here
        for dy in range(-up, H):
            for dx in range(-DX - 4, DX + 5):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H) or not free(nx, ny): continue
                reach = DX - max(0, -dy - 1) * 0.6 + (max(0, dy) * 0.7 if dy > 0 else 0)
                if spring: reach = 4 + (2 if ab['double'] else 0) + (4 if ab['dash'] else 0)
                if abs(dx) > reach: continue
                top = min(y, ny) - (1 if dy <= 0 and abs(dx) > 1 else 0)
                top = max(top, y - up)
                if not clear_path(x, y, nx, ny, top) and not clear_path(x, y, nx, ny, min(y, ny)): continue
                air.add((nx, ny))
                if stand(nx, ny) and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
        # wall climbing: any air cell next to a wall, straight up, while the wall goes on
        if ab['wall']:
            for side in (-1, 1):
                for k in range(1, H):
                    ny = y - k
                    if ny < 0 or not free(x, ny): break
                    # a shaft: walls on BOTH sides, close enough to jump between (one lone wall cannot be climbed)
                    lw = any(t(x - k, ny) in SOLIDS for k in range(1, 5)); rw = any(t(x + k, ny) in SOLIDS for k in range(1, 5))
                    if lw and rw:
                        air.add((x, ny))
                        for ddx in range(-3, 4):
                            for ddy in range(-2, 1):
                                cx, cy = x + ddx, ny + ddy
                                if free(cx, cy):
                                    air.add((cx, cy))
                                    if stand(cx, cy) and (cx, cy) not in seen: seen.add((cx, cy)); q.append((cx, cy))
                    elif k > H1: break              # a normal jump gets you into the shaft
    if SHOW == v.id:
        for yy in range(H):
            print('%2d ' % yy + ''.join(('!' if (g[yy][xx] in 'E*oLkuG' and (xx, yy) not in air and (xx, yy) not in seen) else g[yy][xx] if g[yy][xx] != ' ' else ('.' if (xx, yy) in seen else (',' if (xx, yy) in air else ' '))) for xx in range(W)))
    if not doors_open and any(g[yy][xx] == 'k' and ((xx, yy) in air or (xx, yy) in seen) for yy in range(H) for xx in range(W)):
        return check(v, ab, True)
    probs = []
    keys = sum(r.count('k') for r in g) and sum(1 for y in range(H) for x in range(W) if g[y][x] == 'k')
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c in 'E*oLkuG' and (x, y) not in air and (x, y) not in seen:
                probs.append('%s at %d,%d' % ({'E': 'gate', '*': 'moth', 'o': 'spark', 'L': 'lantern', 'k': 'key', 'u': 'shrine', 'G': 'boss'}[c], x, y))
    nm = sum(r.count('*') for r in g)
    if v.world < 4 and nm != 3: probs.append('%d moths (want 3)' % nm)
    if not any(c == 'E' for r in g for c in r): probs.append('no gate')
    return probs

SHOW = sys.argv[sys.argv.index('--show') + 1] if '--show' in sys.argv else None
ABIL = [dict(double=False, wall=False, dash=False), dict(double=True, wall=False, dash=False), dict(double=True, wall=True, dash=False), dict(double=True, wall=True, dash=True), dict(double=True, wall=True, dash=True)]
bad = 0
for v in LEVELS:
    p = check(v, ABIL[v.world])
    sparks = sum(r.count('o') for r in v.g)
    print('%-4s %-18s %3dx%-3d sparks %3d  %s' % (v.id, v.name, v.w, v.h, sparks, 'OK' if not p else 'PROBLEMS: ' + '; '.join(p[:40])))
    bad += len(p)
with open(OUT, 'w') as f:
    f.write('// ==========================================\n// LEVELS (generated by tools/levels.py - edit that, then run it)\n// ==========================================\n')
    f.write('const LEVELS = ' + json.dumps([dict(id=v.id, name=v.name, world=v.world, gives=v.gives, hint=v.hint, map=v.map()) for v in LEVELS], indent=0) + ';\n')
print('wrote', os.path.relpath(OUT), '-', 'all reachable' if not bad else '%d problem(s)' % bad)
sys.exit(1 if bad and '--strict' in sys.argv else 0)
