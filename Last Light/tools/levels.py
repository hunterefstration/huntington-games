#!/usr/bin/env python3
"""Builds Last Light's levels and checks that each one can be finished with the moves that world has.

    python3 "Last Light/tools/levels.py"        writes src/js/70-levels.js and prints a report

Levels are drawn with small helpers (ground, pits, ledges, things at coordinates) instead of typed ASCII, so
columns always line up. The checker walks a simplified model of the player's moves over the tiles (jump heights and
distances below are a little shorter than the real ones) and reports anything it cannot reach: the gate, every
spark, every star moth, every lantern."""
import json, os, sys, collections, random

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
    def widen(s, n):
        for r in s.g: r.extend([' '] * n)
        s.w += n
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
    v = Lv('1-10', 'The Old Root', 0, 140, 22, gives='double')
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
    v.ledge(115, 117, 7); v.put(116, 6, '*'); v.rect(114, 2, 114, 4); v.rect(118, 2, 118, 6)     # open on the left: never a box
    v.put(125, 12, 'E')
    return v

@level
def l22():
    v = Lv('2-2', 'Crystal Stair', 1, 120, 30)
    v.rect(0, 0, 119, 1); v.ground(0, 119, 27); v.put(3, 26, 'P')
    v.rect(9, 22, 13, 26); v.rect(16, 17, 20, 26); v.arc(8, 20, 5, 2); v.arc(14, 15, 5, 2)
    v.ledge(23, 26, 13); v.ledge(18, 21, 9); v.rect(24, 22, 26, 26); v.put(19, 8, 'L'); v.row(22, 12, 'o o o o')
    v.rect(27, 9, 40, 9); v.put(33, 8, 'g'); v.rect(27, 10, 27, 26, '#'); v.rect(28, 26, 50, 26, '^')
    v.ledge(32, 34, 21); v.put(33, 20, '*'); v.ledge(37, 39, 17); v.ledge(42, 45, 13)
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
    v = Lv('2-10', 'The Deep Bell', 1, 126, 32, gives='wall')
    v.rect(0, 0, 125, 1); v.ground(0, 125, 28); v.put(3, 27, 'P')
    v.rect(8, 24, 11, 27); v.rect(14, 20, 17, 27); v.rect(20, 16, 23, 27); v.rect(26, 12, 29, 27); v.rect(18, 24, 19, 27); v.rect(24, 20, 25, 27); v.put(28, 11, 'L')
    v.arc(7, 22, 5, 2); v.arc(13, 18, 5, 2); v.arc(19, 14, 5, 2)
    v.pit(30, 50, 2); v.rect(30, 27, 50, 27, '^')
    v.rect(33, 12, 34, 12, 'C'); v.rect(38, 10, 39, 10, 'C'); v.rect(43, 12, 44, 12, 'C'); v.rect(47, 9, 48, 9, 'C')
    v.put(41, 6, 'b'); v.row(33, 9, 'o o o o o o o o', 2); v.put(40, 4, '*'); v.ledge(39, 41, 5)
    v.rect(51, 10, 64, 27); v.put(54, 9, 'L'); v.put(59, 9, 'h'); v.put(63, 9, 'k')
    v.rect(65, 5, 66, 9, 'D'); v.rect(65, 2, 66, 4); v.rect(65, 10, 66, 27); v.rect(67, 10, 72, 27); v.put(70, 9, 'g')
    v.rect(73, 14, 73, 27); v.pit(74, 92, 2); v.rect(74, 27, 92, 27, '^')
    v.put(76, 12, 'M'); v.put(77, 12, 'M'); v.put(74, 12, '|'); v.put(91, 12, '|'); v.put(82, 8, 'b'); v.put(84, 5, '*'); v.ledge(83, 85, 6)
    v.rect(93, 12, 125, 27); v.put(96, 11, 'L'); v.put(101, 11, 't'); v.put(108, 11, 'g')
    v.rect(112, 17, 116, 20, ' '); v.rect(112, 12, 116, 16, ' '); v.put(114, 20, '*'); v.rect(112, 21, 116, 21, '#'); v.put(112, 12, '#'); v.put(116, 12, '#'); v.ledge(112, 113, 16)
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
    v.pit(81, 91, 9); v.put(83, 8, 'M'); v.put(84, 8, 'M'); v.put(81, 8, '|'); v.put(91, 8, '|'); v.put(86, 3, '*'); v.put(87, 5, 'b')
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
    v = Lv('3-10', 'The Sun Shrine', 2, 130, 34, gives='dash')
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
    v = Lv('4-10', 'Heart of Embers', 3, 150, 30, gives=None)
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

#@@NEW@@
# =====================================================================  1.2: THE NEW MIDDLE LEVELS (6 per world)
# Built from a few small, checked pieces (a Course walks left to right along a ground line that steps up and down), then
# dressed by hand per level. The checker below still has the last word: it must be able to reach everything.
def stairs(v, x, row, n, w=3, rise=2, back=False):
    """ascending one-way ledges (to the right, or to the left with back=True); returns the cell just above the last one"""
    for i in range(n):
        if back: v.ledge(x - i * w - w + 1, x - i * w, row - i * rise)
        else: v.ledge(x + i * w, x + i * w + w - 1, row - i * rise)
    return (x + (n - 1) * w + w // 2 if not back else x - (n - 1) * w - w // 2), row - (n - 1) * rise - 1

def spark_arc(v, x0, y0, n, h=2):
    for i in range(n):
        t = i / max(1, n - 1); x, y = x0 + i, y0 - round(4 * h * t * (1 - t))
        if 0 <= x < v.w and 0 <= y < v.h and v.g[y][x] == ' ': v.g[y][x] = 'o'

class Course:
    """b = the row of the ground's top; you stand on row b-1."""
    def __init__(s, v, b, x=0, ceil=0):
        s.v, s.b, s.x, s.ceil = v, b, x, ceil
        if ceil: v.rect(0, 0, v.w - 1, ceil - 1)
    def room(s, n):
        v = s.v
        if s.x + n + 2 > v.w:
            old = v.w; v.widen(s.x + n + 2 - v.w)
            if s.ceil: v.rect(old, 0, v.w - 1, s.ceil - 1)
    def run(s, n, lamp=None, foes='', dec=None, sparks=0, ch='#'):
        s.room(n); v, x0 = s.v, s.x; v.ground(x0, x0 + n - 1, s.b, ch)
        if lamp is not None: v.put(x0 + lamp, s.b - 1, 'L')
        for dx, c in (foes if isinstance(foes, (list, tuple)) else []): v.put(x0 + dx, s.b - 1, c)
        if sparks:
            for i in range(sparks): v.put(x0 + 2 + i * 2, s.b - 3, 'o')
        s.x += n; return x0, s.b
    def gap(s, n, h=2, floor=None, ch='C'):
        """a pit n wide; sparks arc over it; floor='^' puts spikes at the bottom (looks scarier, same jump)"""
        s.room(n); spark_arc(s.v, s.x - 1, s.b - 2, n + 2, h)
        if ch == 'C' and floor == 'C': s.v.rect(s.x, s.b, s.x + n - 1, s.b, 'C')
        s.x += n
    def up(s, d): s.b -= d
    def down(s, d): s.b += d
    def spikes(s, x0, n): s.v.rect(x0, s.b - 1, x0 + n - 1, s.b - 1, '^'); spark_arc(s.v, x0 - 1, s.b - 2, n + 2, 2)
    def perch(s, x0, b, off, k, rise=2, w=3, moth=True):
        """a staircase of ledges up from the ground (b = that ground's top): the star hangs over the last one"""
        cx, cy = stairs(s.v, x0 + off, b - rise, k, w, rise)
        if moth: s.v.put(cx, cy - 1, '*')
        return cx, cy

# ---------------- world 1: Glowwood (run and jump; no double jump yet): rises of 2, gaps of 4 at most
@level
def n14():
    v = Lv('1-4', 'Lantern Lane', 0, 132, 20, hint='Hoppers squat before they jump: land on them from above'); c = Course(v, 15)
    c.run(17, lamp=11, sparks=3); v.put(3, 14, 'P'); c.gap(3)
    c.run(13, foes=[(8, 'j')], sparks=3)
    x0, b = c.run(16, lamp=2, foes=[(13, 'j')]); c.up(2)                                   # step up two
    x0, b = c.run(16); c.perch(x0, b, 1, 3); c.gap(4)
    c.run(10, sparks=3); c.spikes(c.x - 6, 3); c.down(0); c.run(10, lamp=3, foes=[(7, 'j')], sparks=2); c.down(2)
    c.run(14, foes=[(9, 'j')]); c.gap(3); v.put(c.x - 2, c.b - 4, '*')                    # a star hanging over a short gap
    c.run(20, lamp=4, foes=[(11, 'j'), (16, 'g')], sparks=4)
    c.gap(3); x0, b = c.run(9); c.up(2); x1, b1 = c.run(6, sparks=1); c.up(2); c.run(5, lamp=2); v.put(c.x - 2, c.b - 4, '*')
    c.down(4); c.gap(3); c.run(14, foes=[(6, 'j')], lamp=8); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n15():
    v = Lv('1-5', 'Hollow Log', 0, 140, 22, hint='Crumbling bridges drop soon after you step on them: keep moving'); c = Course(v, 18)
    c.run(16, lamp=11, sparks=3); v.put(3, 17, 'P')
    s = c.x; c.gap(10); v.rect(s, c.b, c.x - 1, c.b, 'C')        # a crumbling bridge
    spark_arc(v, s, c.b - 3, 10, 1)
    c.run(12, lamp=3, foes=[(8, 'j')]); c.up(2)
    x0, b = c.run(18, lamp=3, foes=[(14, 'b')]); c.perch(x0, b, 6, 3)
    c.gap(4); c.run(8, sparks=2); s = c.x; c.gap(9); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 9, 1)
    c.down(2); c.run(14, lamp=4, foes=[(9, 'j'), (12, 'g')])
    # the hollow: a pit in the floor with a lantern at the bottom of it, a hidden room at the top
    c.gap(3); v.put(c.x - 2, c.b - 4, '*'); x0, b = c.run(12, sparks=3); c.spikes(x0 + 5, 3); c.gap(4)
    x0, b = c.run(24, lamp=2, foes=[(12, 'h')]); v.put(x0 + 20, b - 1, 'j')
    cx, cy = stairs(v, x0 + 4, b - 2, 5, 3, 2); v.put(cx + 1, cy - 1, 'z'); v.rect(cx + 3, cy - 2, cx + 3, cy, '#')         # the hidden lantern is up at the top of a long stair
    c.gap(3); x0, b = c.run(8); v.put(c.x - 3, b - 4, '*')
    c.up(2); c.run(8); c.up(2); c.run(8, lamp=2); c.down(4); c.gap(4); c.run(18, foes=[(5, 'j'), (11, 'j')], lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n16():
    v = Lv('1-6', 'Mushroom Hop', 0, 128, 28, hint='Springs throw you high: hold jump to go higher'); c = Course(v, 24)
    c.run(14, lamp=9, sparks=2); v.put(3, 23, 'P')
    c.gap(3); x0, b = c.run(8, sparks=2); v.put(x0 + 4, b - 1, 'S'); v.ledge(x0 + 3, x0 + 8, b - 9); v.put(x0 + 5, b - 11, '*'); v.row(x0 + 3, b - 12, 'o o o', 2)
    c.run(12, foes=[(6, 'j')], lamp=2); c.up(2)
    c.run(10, sparks=3); c.gap(4); c.run(4); c.gap(4); x0, b = c.run(14, lamp=2, foes=[(10, 'j')])
    v.put(x0 + 7, b - 1, 'S'); v.ledge(x0 + 5, x0 + 12, b - 9); v.row(x0 + 6, b - 11, 'o o o o', 2); v.put(x0 + 11, b - 10, 'S')
    v.ledge(x0 + 12, x0 + 17, b - 17); v.put(x0 + 15, b - 19, '*')             # a spring on a ledge on a spring
    c.up(2); c.run(8, sparks=2); c.gap(4); c.run(12, lamp=2, foes=[(7, 'j'), (10, 'g')])
    c.gap(4); x0, b = c.run(10); v.put(x0 + 5, b - 1, 'S'); v.rect(x0 + 3, b - 8, x0 + 8, b - 8, '='); v.row(x0 + 3, b - 9, 'o o o', 2)
    c.down(3); c.run(10, lamp=2, sparks=2); c.gap(3); v.put(c.x - 2, c.b - 4, '*'); c.run(12, foes=[(5, 'j')], sparks=2)
    c.gap(4); c.run(5); c.gap(4); c.run(14, lamp=3, foes=[(9, 'g')]); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n17():
    v = Lv('1-7', 'Briar Patch', 0, 138, 22, hint='Thornbacks are spiky: jump over them, never onto them'); c = Course(v, 18)
    c.run(14, lamp=8); v.put(3, 17, 'P'); c.spikes(c.x - 4, 3)
    c.run(12, foes=[(6, 'h')], sparks=2); c.gap(4)
    # a ledge that slides across a long gap
    s = c.x; c.gap(10); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); v.put(s + 5, c.b, 'M'); spark_arc(v, s - 1, c.b - 3, 12, 1)
    x0, b = c.run(16, lamp=2, foes=[(9, 'h'), (13, 'j')]); c.perch(x0, b, 5, 3)
    c.up(2); c.run(8, sparks=2); c.spikes(c.x - 5, 3); c.run(10, lamp=3, foes=[(6, 'h')])
    c.gap(4); c.run(4); c.gap(4); c.run(4); c.gap(4)
    x0, b = c.run(24, lamp=3, foes=[(8, 'h'), (15, 'h'), (20, 'j')]); c.spikes(x0 + 11, 3); v.put(x0 + 9, b - 4, '*')
    c.down(2); c.gap(3); s = c.x; c.gap(10); v.put(s + 2, c.b, 'M'); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); spark_arc(v, s - 1, c.b - 3, 12, 1)
    c.run(18, lamp=2, foes=[(8, 'h'), (13, 'j')]); x0, b = c.run(14); c.perch(x0, b, 1, 4)
    c.run(10, lamp=2, foes=[(6, 'h')]); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n18():
    v = Lv('1-8', 'Night Orchard', 0, 130, 24, hint='A key opens the door: just walk up to it'); c = Course(v, 20)
    c.run(14, lamp=9, sparks=2); v.put(3, 19, 'P')
    c.gap(3); x0, b = c.run(24, lamp=2, foes=[(18, 'j')]); cx, cy = stairs(v, x0 + 4, b - 2, 4, 3, 2); v.put(cx, cy - 1, '*')
    v.put(cx + 3, cy, 'k'); v.ledge(cx + 2, cx + 5, cy + 1)
    c.gap(3); c.run(10, sparks=2); c.up(2)
    # the door: a wall above it so you cannot hop over
    x0, b = c.run(8, lamp=2); d = c.x; v.rect(d, b - 3, d, b - 1, 'D'); v.rect(d, 0, d, b - 4, '#'); c.run(14, foes=[(5, 'g'), (10, 'j')], lamp=7)
    c.gap(4); c.run(5); c.gap(4); x0, b = c.run(22, lamp=2, foes=[(9, 'h'), (16, 'j')]); c.perch(x0, b, 12, 3)
    c.down(2); c.gap(3); c.run(10, sparks=2); c.up(2); c.run(6); c.up(2); x0, b = c.run(8, lamp=2); v.put(x0 + 6, b - 4, '*'); c.down(4)
    c.gap(3); x0, b = c.run(14, foes=[(7, 'j')]); c.spikes(x0 + 4, 3); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    v.put(8, 14, 'z'); v.ledge(6, 10, 15); stairs(v, 4, 17, 1, 3, 2)
    return v

@level
def n19():
    v = Lv('1-9', 'The Last Mile', 0, 150, 22, hint='The guardian is close. Light every lantern on the way'); c = Course(v, 18)
    c.run(12, lamp=8); v.put(3, 17, 'P')
    for k in range(3):                                          # stepping stones with a hopper on the far side of each
        c.gap(4); c.run(4 if k < 2 else 8, sparks=1, foes=[(2, 'j')] if k == 2 else [])
    c.up(2); x0, b = c.run(16, lamp=2, foes=[(8, 'h'), (13, 'j')]); c.perch(x0, b, 5, 3); c.gap(4)
    c.run(5); s = c.x; c.gap(10); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 10, 1)
    x0, b = c.run(20, lamp=3, foes=[(10, 'h'), (14, 'g'), (17, 'j')]); c.spikes(x0 + 6, 3)
    c.down(2); c.gap(4); c.run(5); c.gap(4); c.run(5); c.gap(4); x0, b = c.run(14, lamp=2); v.put(x0 + 8, b - 4, '*')
    c.up(2); c.run(8, foes=[(4, 'j')]); c.up(2); c.run(8); c.down(2); c.run(8, lamp=2, foes=[(5, 'h')]); c.down(2); c.gap(3)
    x0, b = c.run(20, lamp=3, foes=[(9, 'j'), (15, 'h')]); c.perch(x0, b, 9, 3)
    c.gap(4); c.run(14, lamp=2); v.put(c.x - 3, c.b - 1, 'E')
    return v

# ---------------- world 2: Hollow Caves (double jump): rises of 3 or 4, gaps of 6 at most. Stalactites hang from the ceiling.
def drips(v, xs, row=2):
    for x in xs: v.put(x, row, 'v')

@level
def n24():
    v = Lv('2-4', 'Glowworm Gallery', 1, 150, 22, hint='Stalactites tremble before they fall: step out from under them'); c = Course(v, 18, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 17, 'P'); c.gap(5)
    x0, b = c.run(20, foes=[(14, 'g')], lamp=2); drips(v, [x0 + 9, x0 + 16]); c.perch(x0, b, 5, 3, rise=3)
    c.gap(6); x0, b = c.run(18, lamp=3, foes=[(12, 'g')], sparks=3); drips(v, [x0 + 7, x0 + 11, x0 + 15]); c.up(3)
    c.run(10, sparks=2); c.gap(5); v.put(c.x - 3, c.b - 6, '*'); c.run(8); drips(v, [c.x - 4])
    x0, b = c.run(22, lamp=2, foes=[(15, 'h')]); drips(v, [x0 + 6, x0 + 12, x0 + 19]); c.down(3)
    c.gap(6); c.run(5); c.gap(6); x0, b = c.run(16, lamp=2, foes=[(10, 't')]); drips(v, [x0 + 5, x0 + 9]); c.perch(x0, b, 8, 3, rise=3)
    c.spikes(x0 + 12, 3); c.gap(5); x0, b = c.run(12, sparks=3); drips(v, [x0 + 4, x0 + 8]); c.up(3); c.run(14, lamp=3, foes=[(9, 'g')])
    v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n25():
    v = Lv('2-5', 'Echo Chamber', 1, 120, 40, hint='Climb. The way up is a staircase of cliffs'); c = Course(v, 36, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 35, 'P'); c.up(3)
    x0, b = c.run(8, sparks=2); c.up(3); c.run(8, foes=[(4, 'g')]); c.up(3); c.run(8, lamp=3); c.gap(4)
    c.up(3); x0, b = c.run(10); c.perch(x0, b, 1, 3, rise=3); c.up(3); x0, b = c.run(10, foes=[(6, 'g')]); drips(v, [x0 + 3, x0 + 7]); c.run(10, lamp=3)
    c.gap(5); x0, b = c.run(8); v.put(x0 + 4, b - 6, '*'); c.up(3); c.run(8, foes=[(4, 'h')]); c.gap(4); c.up(3); c.run(10, lamp=2)
    x0, b = c.run(10, foes=[(6, 'g')]); drips(v, [x0 + 4, x0 + 7]); c.gap(4)
    c.run(5, sparks=1); c.gap(6); x0, b = c.run(10, sparks=2); v.put(x0 + 7, b - 1, 't')
    c.up(3); x0, b = c.run(12, lamp=2); c.perch(x0, b, 2, 2, rise=3); v.put(x0 + 10, b - 1, 'E')
    return v

@level
def n26():
    v = Lv('2-6', 'Crystal Garden', 1, 140, 26, hint='Some crystals hide a lost lantern'); c = Course(v, 22, ceil=2)
    c.run(14, lamp=9); v.put(3, 21, 'P')
    for k in range(3): c.gap(6); c.run(4, sparks=1, foes=[(2, 'g')] if k == 1 else [])
    c.gap(6); x0, b = c.run(18, lamp=3, foes=[(12, 'g')]); c.perch(x0, b, 5, 3, rise=3); drips(v, [x0 + 8])
    c.up(3); c.run(6, sparks=2); c.gap(4); c.up(3); x0, b = c.run(14, lamp=2, foes=[(9, 'b')], sparks=2)
    # a hidden lantern high up on a chain of tiny ledges
    v.ledge(x0 + 3, x0 + 4, b - 4); v.ledge(x0 + 6, x0 + 7, b - 8); v.ledge(x0 + 9, x0 + 10, b - 12); v.put(x0 + 10, b - 13, 'z')
    c.down(3); c.gap(5); x0, b = c.run(10, foes=[(6, 'g')]); c.spikes(x0 + 3, 3); c.gap(5); c.run(10, lamp=3); drips(v, [c.x - 6])
    c.gap(6); v.put(c.x - 3, c.b - 6, '*'); c.run(6); c.gap(6); c.run(6); c.gap(6)
    x0, b = c.run(20, lamp=2, foes=[(9, 'h'), (15, 'g')]); c.perch(x0, b, 7, 3, rise=3); v.put(x0 + 18, b - 1, 'E')
    return v

@level
def n27():
    v = Lv('2-7', 'Underground River', 1, 150, 22, hint='Ride the moving ledges: wait for them to come to you'); c = Course(v, 18, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 17, 'P')
    for k, w in enumerate((12, 14, 12)):
        s = c.x; c.gap(w)
        for i in range(3 if k != 1 else 4): v.put(s + 3 + i, c.b, 'M')
        v.rect(s, c.b + 2, s + w - 1, c.b + 3, '^'); v.rect(s, c.b + 4, s + w - 1, v.h - 1, '#')
        spark_arc(v, s - 1, c.b - 3, w + 2, 1)
        x0, b = c.run(10 if k < 2 else 12, lamp=2, foes=[(6, 'g')] if k != 1 else [(6, 'h')])
        if k == 0: c.perch(x0, b, 2, 3, rise=3)
        if k == 1: v.put(x0 + 8, b - 6, '*')
    c.gap(5); x0, b = c.run(16, lamp=2, foes=[(8, 'b')], sparks=3); drips(v, [x0 + 5, x0 + 11])
    s = c.x; c.gap(10); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); v.put(s + 5, c.b, 'M'); v.rect(s, c.b + 2, s + 9, c.b + 3, '^'); v.rect(s, c.b + 4, s + 9, v.h - 1, '#')
    x0, b = c.run(14, lamp=2); c.perch(x0, b, 3, 3, rise=3); c.gap(5); c.run(6, foes=[(3, 'g')]); c.gap(5); c.run(12, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n28():
    v = Lv('2-8', 'Rockfall', 1, 150, 24, hint='Crumbling stone: do not stop. Falling rock: do not stand still'); c = Course(v, 20, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 19, 'P')
    s = c.x; c.gap(12); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 12, 1); drips(v, [s + 4, s + 9])
    x0, b = c.run(16, lamp=2, foes=[(10, 'g')]); drips(v, [x0 + 6, x0 + 13]); c.perch(x0, b, 5, 3, rise=3); c.up(3)
    c.run(10, sparks=2); s = c.x; c.gap(13); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 13, 1); drips(v, [s + 3, s + 7, s + 11])
    x0, b = c.run(16, lamp=2, foes=[(8, 't')]); v.put(x0 + 12, b - 4, '*'); c.down(3); c.gap(6)
    c.run(4); v.rect(c.x, c.b, c.x + 5, c.b, 'C'); c.gap(6); drips(v, [c.x - 3]); x0, b = c.run(14, lamp=2, foes=[(9, 'h')]); drips(v, [x0 + 4, x0 + 7, x0 + 11])
    s = c.x; c.gap(14); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 14, 1); drips(v, [s + 5, s + 10])
    x0, b = c.run(18, lamp=3, foes=[(12, 'g')]); c.perch(x0, b, 7, 3, rise=3); v.put(x0 + 16, b - 1, 'E')
    return v

@level
def n29():
    v = Lv('2-9', 'Black Pool', 1, 150, 24, hint='The guardian is close. Take it slow, and light every lantern'); c = Course(v, 20, ceil=2)
    c.run(12, lamp=8); v.put(3, 19, 'P')
    for k in range(4):
        c.gap(6); x0, b = c.run(3 if k % 2 == 0 else 4, sparks=0, foes=[(1, 'g')] if k == 3 else [])
        if k == 1: v.put(x0 + 1, b - 6, '*')
    c.gap(5); x0, b = c.run(16, lamp=2, foes=[(8, 'h'), (13, 'g')]); drips(v, [x0 + 5, x0 + 10]); c.perch(x0, b, 4, 3, rise=3); c.up(3)
    c.run(5); c.gap(6); c.run(5); c.gap(6); x0, b = c.run(16, lamp=3, foes=[(9, 'g')]); drips(v, [x0 + 7, x0 + 12])
    s = c.x; c.gap(12); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 12, 1); v.put(s + 6, c.b - 6, '*')
    c.down(3); x0, b = c.run(18, lamp=2, foes=[(8, 'h'), (14, 't')]); c.perch(x0, b, 4, 3, rise=3, moth=False)
    c.gap(6); c.run(4, foes=[(1, 'g')]); c.gap(6); c.run(4); c.gap(6); c.run(12, lamp=2); v.put(c.x - 3, c.b - 1, 'E')
    return v

# ---------------- world 3: Sky Ruins (double + wall jump). New here: updraft vents ('W'): stand in the wind and it lifts you
def climb(v, c, h, star=False):
    """a wall-jump shaft: walls 4 apart (3 open between). The left wall stops 3 short of the floor so you walk in under it, and the
    landing is on top of the right wall. Leaves the course at the landing (h higher); call c.run() next."""
    x, b = c.x, c.b
    c.run(4); v.rect(x, b - h, x, b - 4, '#')
    v.row(x + 1, b - 3, 'o o o', 1); v.row(x + 1, b - h + 2, 'o o o', 1)
    if star: v.put(x + 2, b - h // 2, '*')
    c.x = x + 4; c.b = b - h

@level
def n34():
    v = Lv('3-4', 'Gale Gardens', 2, 150, 28, hint='Stand in the wind and it lifts you'); c = Course(v, 24)
    c.run(14, lamp=9, sparks=2); v.put(3, 23, 'P'); c.gap(5)
    x0, b = c.run(12, foes=[(9, 'g')], lamp=2); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 8); v.put(x0 + 8, b - 10, '*')
    c.gap(6); x0, b = c.run(14, lamp=3, foes=[(9, 'b')], sparks=2); v.put(x0 + 4, b - 1, 'W'); c.up(8)
    c.x = x0 + 8; x1, b1 = c.run(14, lamp=4, foes=[(8, 'h')])
    c.gap(6); c.run(5); c.gap(6); x0, b = c.run(10, lamp=2, sparks=2); c.down(8)
    c.gap(5); x0, b = c.run(16, foes=[(9, 'g')], lamp=2); c.perch(x0, b, 4, 3, rise=3); c.spikes(x0 + 11, 3)
    c.gap(6); x0, b = c.run(8); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 9); v.put(x0 + 7, b - 11, 'o'); v.put(x0 + 8, b - 11, 'o')
    c.gap(6); c.run(5); c.gap(6); x0, b = c.run(14, lamp=3); v.put(x0 + 8, b - 4, '*'); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n35():
    v = Lv('3-5', 'Pillar Run', 2, 150, 34, hint='Walls are for jumping off: press jump against a wall'); c = Course(v, 30)
    c.run(14, lamp=9, sparks=2); v.put(3, 29, 'P'); c.gap(5)
    x0, b = c.run(8, lamp=2); climb(v, c, 12, star=True); x0, b = c.run(10, foes=[(5, 'g')], lamp=3, sparks=2)
    c.gap(6); c.run(4); c.gap(6); x0, b = c.run(12, foes=[(8, 'h')]); c.perch(x0, b, 1, 3, rise=3); c.down(6)
    c.gap(6); x0, b = c.run(16, lamp=2, foes=[(10, 'g')]); climb(v, c, 10); x0, b = c.run(10, lamp=2, foes=[(6, 'b')])
    c.gap(6); c.run(4); c.gap(6); c.run(4); c.gap(6); x0, b = c.run(14, lamp=2); v.put(x0 + 7, b - 6, '*'); c.down(6)
    c.gap(5); x0, b = c.run(18, lamp=3, foes=[(10, 'h')]); climb(v, c, 14); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n36():
    v = Lv('3-6', 'Windmill Stair', 2, 140, 40, hint='Ride the wind from ledge to ledge'); c = Course(v, 36)
    c.run(14, lamp=9, sparks=2); v.put(3, 35, 'P')
    x, b = c.x, c.b
    c.gap(5); x0, b = c.run(10, lamp=2); v.put(x0 + 1, b - 1, 'W')
    for k in range(3):                                           # a stair of windy ledges, each lifting you to the next
        lx = x0 + 3 + 7 * k; ly = b - 8 - 8 * k
        v.ledge(lx, lx + 5, ly); v.put(lx + 5, ly - 1, 'W'); v.row(lx + 1, ly - 3, 'o o', 2)
        if k == 1: v.put(lx + 3, ly - 3, '*')
    lx = x0 + 3 + 7 * 3; ly = b - 8 - 8 * 3 + 8 - 8
    c.x = lx; c.b = b - 8 - 8 * 2 - 8 + 0
    x1, b1 = c.run(12, lamp=2, foes=[(7, 'g')]); v.put(x1 + 6, b1 - 4, '*')
    c.gap(6); c.run(5); c.gap(6); x0, b = c.run(10, lamp=2); c.down(8); c.gap(4)
    x0, b = c.run(14, foes=[(9, 'b'), (11, 'g')]); v.put(x0 + 5, b - 1, 'W'); v.ledge(x0 + 3, x0 + 8, b - 9); v.put(x0 + 5, b - 11, '*')
    c.gap(6); x0, b = c.run(12, lamp=2); climb(v, c, 9); c.run(8, foes=[(4, 'h')]); c.gap(6); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n37():
    v = Lv('3-7', 'Cracked Causeway', 2, 150, 30, hint='The causeway crumbles. Do not stop, and watch the bats'); c = Course(v, 26)
    c.run(14, lamp=9, sparks=2); v.put(3, 25, 'P')
    s = c.x; c.gap(14); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 14, 1); v.put(s + 5, c.b - 6, 'b')
    x0, b = c.run(14, lamp=2, foes=[(9, 'g')]); c.perch(x0, b, 4, 3, rise=3); c.up(3)
    c.run(6, sparks=2); s = c.x; c.gap(10); v.rect(s, c.b, c.x - 1, c.b, 'C'); spark_arc(v, s, c.b - 3, 10, 1); v.put(s + 5, c.b - 6, '*')
    x0, b = c.run(12, lamp=2, foes=[(7, 'h')]); climb(v, c, 10); c.run(8, lamp=2); c.down(5)
    s = c.x; c.gap(16); v.rect(s, c.b, s + 3, c.b, 'C'); v.rect(s + 6, c.b, s + 9, c.b, 'C'); v.rect(s + 12, c.b, s + 15, c.b, 'C'); spark_arc(v, s, c.b - 3, 16, 1)
    v.put(s + 4, c.b - 7, 'b'); v.put(s + 11, c.b - 7, 'b')
    x0, b = c.run(14, lamp=2, foes=[(9, 'g')]); c.gap(6); x0, b = c.run(10, foes=[(5, 'h')]); c.perch(x0, b, 1, 3, rise=3)
    c.gap(6); c.run(5); c.gap(6); c.run(12, lamp=2); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n38():
    v = Lv('3-8', 'Cloud Library', 2, 150, 34, hint='Bookcases hold a key. The door is further on'); c = Course(v, 30)
    c.run(14, lamp=9, sparks=2); v.put(3, 29, 'P'); c.gap(5)
    x0, b = c.run(14, lamp=2, foes=[(9, 'g')]); climb(v, c, 12, star=True)
    x0, b = c.run(14, lamp=3, foes=[(8, 'h')]); v.ledge(x0 + 3, x0 + 6, b - 4); v.put(x0 + 5, b - 5, 'k')
    c.gap(5); x0, b = c.run(12, lamp=2); d = c.x; v.rect(d, b - 3, d, b - 1, 'D'); v.rect(d, b - 20, d, b - 4, '#'); x0, b = c.run(12, foes=[(5, 'g')], lamp=7)
    c.perch(x0, b, 2, 3, rise=3); c.gap(6); c.run(5); c.gap(6); x0, b = c.run(10, lamp=2)
    c.down(6); c.gap(5); x0, b = c.run(14, foes=[(8, 'b')]); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 9); v.put(x0 + 8, b - 10, 'z')
    c.gap(5); x0, b = c.run(16, lamp=2, foes=[(10, 'h')]); climb(v, c, 10); c.run(8, foes=[(3, 'g')]); v.put(c.x - 4, c.b - 4, '*')
    c.gap(6); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n39():
    v = Lv('3-9', 'Storm Gate', 2, 150, 40, hint='The guardian is close. Everything you learned is here'); c = Course(v, 36)
    c.run(12, lamp=8); v.put(3, 35, 'P')
    c.gap(6); c.run(4); c.gap(6); x0, b = c.run(14, lamp=2, foes=[(9, 'h')]); climb(v, c, 12); x0, b = c.run(10, lamp=2, foes=[(5, 'g')]); v.put(x0 + 6, b - 4, '*')
    c.gap(6); x0, b = c.run(8); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 9); v.put(x0 + 7, b - 11, 'o'); v.put(x0 + 8, b - 11, 'o')
    c.gap(6); c.run(4, foes=[(1, 'b')]); s = c.x; c.gap(12); v.rect(s, c.b, s + 4, c.b, 'C'); v.rect(s + 7, c.b, s + 11, c.b, 'C'); spark_arc(v, s, c.b - 3, 12, 1)
    x0, b = c.run(14, lamp=2, foes=[(9, 'g')]); c.perch(x0, b, 4, 3, rise=3); c.down(6)
    c.gap(6); x0, b = c.run(10, lamp=2); climb(v, c, 12, star=True); x0, b = c.run(8, lamp=2, foes=[(4, 'h')])
    c.gap(6); c.run(4); c.gap(6); c.run(4, foes=[(1, 'b')]); c.gap(6); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

# ---------------- world 4: Ember Forge (+ dash): gaps of up to 8 with lava below. New: fire jets ('f') with a flicker before they fire
def lava(c, n, h=2):
    s = c.x; c.gap(n, h); c.v.rect(s, c.b + 2, s + n - 1, c.v.h - 1, 'l'); return s

@level
def n44():
    v = Lv('4-4', 'Slag Walk', 3, 150, 24, hint='Fire jets flicker first, then burst. Wait, or dash through'); c = Course(v, 18, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 17, 'P'); lava(c, 5)
    x0, b = c.run(20, lamp=2, foes=[(8, 'f'), (15, 'g')]); c.perch(x0, b, 10, 3, rise=3)
    lava(c, 6); x0, b = c.run(8, foes=[(4, 'f')]); lava(c, 6); c.up(2); x0, b = c.run(16, lamp=2, foes=[(6, 'f'), (11, 'h')], sparks=3)
    lava(c, 8, 1); v.put(c.x - 4, c.b - 5, '*'); x0, b = c.run(14, lamp=2, foes=[(8, 'g')]); c.down(2)
    x0, b = c.run(22, foes=[(5, 'f'), (11, 'f'), (17, 'h')], lamp=2); c.spikes(x0 + 13, 2)
    lava(c, 6); c.run(5); lava(c, 8, 1); x0, b = c.run(16, lamp=2, foes=[(9, 't')]); c.perch(x0, b, 4, 3, rise=3)
    lava(c, 6); c.run(14, lamp=3, foes=[(8, 'f')]); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n45():
    v = Lv('4-5', 'Rivet Row', 3, 150, 26, hint='Hop the rivets. Dash is the fast way over'); c = Course(v, 20, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 19, 'P')
    for k in range(4):
        lava(c, 6); x0, b = c.run(3, foes=[(1, 'f')] if k == 2 else [])
        if k == 1: v.put(x0 + 1, b - 5, '*')
    lava(c, 7); x0, b = c.run(16, lamp=2, foes=[(9, 'h'), (13, 'f')]); c.perch(x0, b, 4, 3, rise=3); c.up(2)
    for k in range(3):
        lava(c, 6); x0, b = c.run(3, foes=[(1, 'b')] if k == 1 else [])
    lava(c, 8, 1); x0, b = c.run(16, lamp=2, foes=[(8, 'g'), (11, 'f')]); v.put(x0 + 14, b - 4, '*'); c.down(2)
    for k in range(3): lava(c, 6); c.run(4)
    lava(c, 8, 1); c.run(14, lamp=3, foes=[(8, 'f')]); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n46():
    v = Lv('4-6', 'Chain Lift', 3, 140, 30, hint='Ride the lifts. They stop at the top and the bottom'); c = Course(v, 24, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 23, 'P')
    s = lava(c, 12); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); v.put(s + 5, c.b, 'M'); 
    x0, b = c.run(14, lamp=2, foes=[(9, 'g')]); c.perch(x0, b, 4, 3, rise=3)
    # a lift that goes up and down between two ledges
    c.gap(1); x1 = c.x; v.rect(x1, c.b - 6, x1 + 7, c.v.h - 1, 'l') if False else None
    lx = c.x + 2; c.gap(8); v.put(lx, c.b - 1, 'N'); v.put(lx + 1, c.b - 1, 'N'); v.put(lx, c.b - 12, '|'); v.put(lx, c.b + 1, '|'); v.rect(c.x - 8, c.b + 2, c.x - 1, v.h - 1, 'l')
    spark_arc(v, lx, c.b - 4, 4, 1)
    c.up(8); x0, b = c.run(14, lamp=2, foes=[(8, 'h')]); v.put(x0 + 8, b - 4, '*')
    lava(c, 7); x0, b = c.run(8, foes=[(4, 'f')]); lava(c, 7); c.down(4); x0, b = c.run(16, lamp=2, foes=[(9, 'g'), (13, 'f')])
    s = lava(c, 12); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); v.put(s + 5, c.b, 'M'); v.put(s + 5, c.b - 6, '*')
    c.run(12, lamp=2, foes=[(6, 'h')]); lava(c, 7); c.run(14, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n47():
    v = Lv('4-7', 'Bellows', 3, 140, 40, hint='The bellows blow upward. Ride them, and mind the jets'); c = Course(v, 36, ceil=2)
    c.run(14, lamp=9, sparks=2); v.put(3, 35, 'P'); lava(c, 6)
    x0, b = c.run(14, lamp=2, foes=[(9, 'f')]); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 9); v.put(x0 + 8, b - 11, '*')
    c.x = x0 + 12; c.up(9); x0, b = c.run(12, lamp=2, foes=[(7, 'g')]); lava(c, 6)
    x0, b = c.run(10, foes=[(5, 'f')]); v.put(x0 + 2, b - 1, 'W'); v.ledge(x0 + 4, x0 + 9, b - 9); v.put(x0 + 7, b - 10, 'o')
    c.x = x0 + 11; c.up(9); x0, b = c.run(14, lamp=2, foes=[(8, 'h')]); lava(c, 7)
    x0, b = c.run(8, foes=[(4, 'f')]); c.perch(x0, b, 1, 2, rise=3); lava(c, 6); x0, b = c.run(14, lamp=2); v.put(x0 + 3, b - 1, 'W'); v.ledge(x0 + 5, x0 + 10, b - 9); v.put(x0 + 8, b - 10, 'z')
    c.x = x0 + 12; c.down(0); lava(c, 6); c.run(14, lamp=3, foes=[(8, 'f')]); v.put(c.x - 3, c.b - 1, 'E'); v.put(c.x - 8, c.b - 4, '*')
    return v

@level
def n48():
    v = Lv('4-8', 'Molten Run', 3, 150, 24, hint='Long jumps over the lava: jump, then dash'); c = Course(v, 18, ceil=2)
    c.run(12, lamp=8); v.put(3, 17, 'P')
    for k in range(4):
        lava(c, 8, 1); x0, b = c.run(5 if k % 2 == 0 else 7, foes=[(3, 'g')] if k == 3 else [], lamp=2 if k == 1 else None)
        if k == 2: v.put(x0 + 3, b - 5, '*')
    x0, b = c.run(18, lamp=2, foes=[(8, 'f'), (14, 'h')]); c.perch(x0, b, 4, 3, rise=3); c.up(3)
    lava(c, 7); c.run(5); lava(c, 8, 1); x0, b = c.run(16, lamp=2, foes=[(9, 'f')]); c.down(3)
    for k in range(3): lava(c, 8, 1); x0, b = c.run(4, foes=[(1, 'b')] if k == 1 else [])
    lava(c, 8, 1); x0, b = c.run(16, lamp=2, foes=[(10, 'g')]); v.put(x0 + 12, b - 4, '*'); c.run(8, lamp=3); v.put(c.x - 3, c.b - 1, 'E')
    return v

@level
def n49():
    v = Lv('4-9', 'Anvil Hall', 3, 150, 30, hint='The guardian is close. Jets, lava and lifts: you know it all'); c = Course(v, 24, ceil=2)
    c.run(12, lamp=8); v.put(3, 23, 'P'); lava(c, 6)
    x0, b = c.run(16, lamp=2, foes=[(7, 'f'), (12, 'h')]); c.perch(x0, b, 3, 4, rise=3); lava(c, 8, 1)
    x0, b = c.run(8, foes=[(4, 'f')]); lava(c, 6); x0, b = c.run(6); lava(c, 6)
    x0, b = c.run(18, lamp=2, foes=[(9, 'f'), (14, 'g')]); v.put(x0 + 4, b - 1, 'W'); v.ledge(x0 + 6, x0 + 11, b - 9); v.put(x0 + 9, b - 10, 'z')
    s = lava(c, 12); v.put(s + 3, c.b, 'M'); v.put(s + 4, c.b, 'M'); v.put(s + 5, c.b, 'M')
    x0, b = c.run(14, lamp=2, foes=[(8, 'h')]); v.put(x0 + 9, b - 4, '*'); c.up(2); lava(c, 6); x0, b = c.run(16, foes=[(5, 'f'), (10, 'f')], lamp=1)
    c.perch(x0, b, 6, 3, rise=3); lava(c, 8, 1); c.run(5); lava(c, 8, 1); c.run(14, lamp=3, foes=[(9, 'f')]); v.put(c.x - 3, c.b - 1, 'E')
    return v

LEVELS.sort(key=lambda v: (v.world, int(v.id.split('-')[1])))

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
    edges = collections.defaultdict(set)          # stand cell -> stand cells you can get to from it (for the trap check)
    def clear_path(x0, y0, x1, y1, top, strict=False):
        # up from (x0,y0) to the top row, across, then down to (x1,y1); or across first. strict: no dropping down
        # through a one-way ledge (most players never find that move, so it must never be the only way out)
        def col(x, a, b): return all(free(x, yy) and not (strict and b > a and yy > a and t(x, yy) == '=') for yy in range(min(a, b), max(a, b) + 1))
        def rowc(y, a, b): return all(free(xx, y) for xx in range(min(a, b), max(a, b) + 1))
        return (col(x0, y0, top) and rowc(top, x0, x1) and col(x1, top, y1)) or (rowc(y0, x0, x1) and col(x1, y0, y1))
    upov = {}
    while q:
        x, y = q.popleft()
        spring = t(x, y) == 'S' or t(x, y + 1) == 'S'
        up = 9 + (3 if ab['double'] else 0) if spring else H1
        if (x, y) in upov: up = upov[(x, y)]
        if t(x, y) == 'W':             # an updraft vent: the whole column is open air, and you can leave from near the top of it
            k = 0
            while k < 9 and y - k - 1 >= 0 and t(x, y - k - 1) not in '#D^l': k += 1
            for kk in range(k + 1): air.add((x, y - kk))
            for kk in range(max(0, k - 1), k + 1):
                top = (x, y - kk)
                edges[(x, y)].add(top); edges[top].add((x, y))
                if top not in seen: seen.add(top); upov[top] = 3; q.append(top)
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
                if stand(nx, ny) and (clear_path(x, y, nx, ny, top, True) or clear_path(x, y, nx, ny, min(y, ny), True)): edges[(x, y)].add((nx, ny))
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
                                    if stand(cx, cy): edges[(x, y)].add((cx, cy))
                                    if stand(cx, cy) and (cx, cy) not in seen: seen.add((cx, cy)); q.append((cx, cy))
                    elif k > H1: break              # a normal jump gets you into the shaft
    if SHOW == v.id:
        for yy in range(H):
            print('%2d ' % yy + ''.join(('!' if (g[yy][xx] in 'E*oLkuG' and (xx, yy) not in air and (xx, yy) not in seen) else g[yy][xx] if g[yy][xx] != ' ' else ('.' if (xx, yy) in seen else (',' if (xx, yy) in air else ' '))) for xx in range(W)))
    if not doors_open and any(g[yy][xx] == 'k' and ((xx, yy) in air or (xx, yy) in seen) for yy in range(H) for xx in range(W)):
        return check(v, ab, True)
    probs = []
    v.seen = seen
    keys = sum(r.count('k') for r in g) and sum(1 for y in range(H) for x in range(W) if g[y][x] == 'k')
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c in 'E*oLkuGnz' and (x, y) not in air and (x, y) not in seen:
                probs.append('%s at %d,%d' % ({'E': 'gate', '*': 'star', 'o': 'spark', 'L': 'lantern', 'k': 'key', 'u': 'shrine', 'G': 'boss', 'n': 'person', 'z': 'secret'}[c], x, y))
    # traps: places you can get to but never get out of to the gate (falling into a pit is fine: that is a death and a
    # respawn, but a box with no way out leaves you stuck). Walk backwards from the gate over the same moves.
    gate = [(x, y) for y in range(H) for x in range(W) if g[y][x] == 'E']
    back = collections.defaultdict(set)
    for a, bs in edges.items():
        for b2 in bs: back[b2].add(a)
    ok = {c for c in seen if any(abs(c[0] - e[0]) <= 2 and abs(c[1] - e[1]) <= 2 for e in gate)}
    if g[start[1]][start[0]] and v.world == 4 and not gate: ok = set(seen)     # the boss arena has no gate
    def falls_out(c):        # a pit within a few steps: dropping in is a death and a respawn at the lantern, not a trap
        x0, y0 = c
        for d in (-1, 1):
            for k in range(0, 4):
                x = x0 + d * k
                if not free(x, y0): break
                if all(free(x, yy) for yy in range(y0, H)): return True
        return False
    ok |= {c for c in seen if falls_out(c)}
    q2 = collections.deque(ok)
    while q2:
        c = q2.popleft()
        for a in back[c]:
            if a not in ok: ok.add(a); q2.append(a)
    stuck = sorted(c for c in seen if c not in ok)
    if stuck:
        groups = []
        for c in stuck:
            if groups and abs(groups[-1][-1][0] - c[0]) <= 3: groups[-1].append(c)
            else: groups.append([c])
        probs += ['TRAP %d,%d (%d cells)' % (gr[0][0], gr[0][1], len(gr)) for gr in groups]
    nm = sum(r.count('*') for r in g)
    if v.world < 4 and nm != 3: probs.append('%d moths (want 3)' % nm)
    if not any(c == 'E' for r in g for c in r): probs.append('no gate')
    return probs

SHOW = sys.argv[sys.argv.index('--show') + 1] if '--show' in sys.argv else None
def spice(v):
    """A few more enemies on the open ground of every level after the first (seeded, so the levels never change between
    builds): slimes and bats early, thornbacks and turrets once you can wall-jump. Never near the start, a lantern, the
    gate or anything else, and never two close together."""
    n = {0: 4, 1: 5, 2: 5, 3: 6}.get(v.world, 0)
    if v.id == '1-1': n = 2
    rnd, g, spots = random.Random('spice' + v.id), v.g, []
    for y in range(3, v.h - 1):
        for x in range(10, v.w - 10):
            if all(g[y][xx] in ' o' and g[y - 1][xx] in ' o' and g[y + 1][xx] == '#' for xx in range(x - 2, x + 3)) and \
               not any(g[yy][xx] not in ' #=^Co' for yy in range(max(0, y - 5), min(v.h, y + 2)) for xx in range(x - 6, x + 7)):
                spots.append((x, y))
    rnd.shuffle(spots); used = []
    for x, y in spots:
        if len(used) >= n: break
        if any(abs(x - a) < 9 for a in used): continue
        kind = rnd.choice('ggb' if v.world < 2 else 'gbht')
        if kind == 'b':
            if not all(g[y - k][x] in ' o' for k in range(1, 4)): continue
            y -= 3
        v.put(x, y, kind); used.append(x)
for v in LEVELS: spice(v)

def bats(v):
    """A bat or two hanging over the open jumps (worlds 1-4; never in the first level)."""
    n = {0: 1, 1: 2, 2: 2, 3: 3}.get(v.world, 0)
    if v.id == '1-1': return
    rnd, g, spots = random.Random('bats' + v.id), v.g, []
    used = [x for y in range(v.h) for x in range(v.w) if g[y][x] in 'gbht']
    for y in range(4, v.h - 6):
        for x in range(14, v.w - 12):
            if all(g[yy][xx] in ' o' for yy in range(y - 2, y + 3) for xx in range(x - 3, x + 4)) and \
               all(g[yy][x] in ' o' for yy in range(y + 3, v.h)) and \
               not any(g[yy][xx] not in ' #=^Clo' for yy in range(max(0, y - 4), min(v.h, y + 5)) for xx in range(x - 6, x + 7)):
                spots.append((x, y))
    rnd.shuffle(spots); k = 0
    for x, y in spots:
        if k >= n: break
        if any(abs(x - a) < 10 for a in used): continue
        v.put(x, y, 'b'); used.append(x); k += 1
for v in LEVELS: bats(v)

def arena(v, kind):
    """The end of every world: the gate moves into a walled arena past a guardian (a mini boss). The old gate spot gets a
    lantern, so a fall in the fight starts again right at the door. The door (runtime) closes behind you at column w0+1."""
    ex, ey = next((x, y) for y in range(v.h) for x in range(v.w) if v.g[y][x] == 'E')
    v.put(ex, ey, 'L'); floor = ey + 1; w0 = v.w; v.widen(34); v.w0 = w0
    v.ground(w0, v.w - 1, floor)
    if floor - 12 >= 0: v.rect(w0, 0, v.w - 1, floor - 12)
    if kind == 'bell': v.ledge(w0 + 8, w0 + 11, floor - 4); v.ledge(w0 + 21, w0 + 24, floor - 4)
    v.put(w0 + 20, floor - 1, 'Q'); v.put(w0 + 31, floor - 1, 'E')
    v.guard = kind
for lid, kind in (('1-10', 'moss'), ('2-10', 'shard'), ('3-10', 'bell'), ('4-10', 'cinder')):
    arena(next(v for v in LEVELS if v.id == lid), kind)

ABIL = [dict(double=False, wall=False, dash=False), dict(double=True, wall=False, dash=False), dict(double=True, wall=True, dash=False), dict(double=True, wall=True, dash=True), dict(double=True, wall=True, dash=True)]
# who has somebody to talk to (the lines are in src/js/65-lore.js): the 16 original levels, and 14 of the new ones
PEOPLE_IN = {'1-1', '1-2', '1-3', '1-10', '2-1', '2-2', '2-3', '2-10', '3-1', '3-2', '3-3', '3-10', '4-1', '4-2', '4-3', '4-10',
             '1-5', '1-6', '1-9', '2-5', '2-6', '2-7', '2-9', '3-5', '3-6', '3-8', '3-9', '4-5', '4-6', '4-8', '4-9'}
def npc(v):
    """Somebody to talk to in every level (not the last): standing by a lantern, the safe places on the way. Before a
    guardian, right by the lantern at the arena door. Enemies too close to them are moved out of the way (removed)."""
    if v.world == 4 or v.id not in PEOPLE_IN: return
    g, hi = v.g, getattr(v, 'w0', v.w)
    lan = [(x, y) for y in range(v.h) for x in range(hi) if g[y][x] == 'L']
    if hasattr(v, 'w0'): lan.sort(key=lambda q: -q[0])
    else: lan.sort(key=lambda q: abs(q[0] - hi * 0.4))
    spot = None
    for lx, ly in lan:
        for dx in (-3, 3, -4, 4, -2, 2, -5, 5):
            x, y = lx + dx, ly
            if 2 < x < hi - 2 and g[y][x] == ' ' and g[y - 1][x] == ' ' and g[y + 1][x] in '#=' and g[y][x - 1] != '#' and g[y][x + 1] != '#':
                spot = (x, y); break
        if spot: break
    if not spot:
        check(v, ABIL[v.world])
        c = sorted((q for q in v.seen if hi * 0.15 < q[0] < hi * 0.6 and g[q[1]][q[0]] == ' ' and g[q[1] + 1][q[0]] == '#'), key=lambda q: q[0])
        spot = c[len(c) // 2]
    x, y = spot; v.put(x, y, 'n')
    for yy in range(max(0, y - 6), min(v.h, y + 6)):
        for xx in range(max(0, x - 7), min(v.w, x + 8)):
            if g[yy][xx] in 'gbht': g[yy][xx] = ' '
for v in LEVELS: npc(v)

bad = 0
for v in LEVELS:
    p = check(v, ABIL[v.world])
    sparks = sum(r.count('o') for r in v.g)
    print('%-4s %-18s %3dx%-3d sparks %3d  %s' % (v.id, v.name, v.w, v.h, sparks, 'OK' if not p else 'PROBLEMS: ' + '; '.join(p[:40])))
    bad += len(p)
with open(OUT, 'w') as f:
    f.write('// ==========================================\n// LEVELS (generated by tools/levels.py - edit that, then run it)\n// ==========================================\n')
    f.write('const LEVELS = ' + json.dumps([dict(id=v.id, name=v.name, world=v.world, gives=v.gives, hint=v.hint, guard=getattr(v, 'guard', None), map=v.map()) for v in LEVELS], indent=0) + ';\n')
print('wrote', os.path.relpath(OUT), '-', 'all reachable' if not bad else '%d problem(s)' % bad)
sys.exit(1 if bad and '--strict' in sys.argv else 0)
