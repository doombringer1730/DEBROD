# Builds words.json for the word games (Words.html) from SCOWL
# (npm wordlist-english 1.2.1): python3 build.py <unpacked package dir> words.json
import json, random, re, sys, itertools
P = sys.argv[1] + '/package/'
def level(n):
    out = set()
    for r in ['english', 'american']:
        out |= set(json.load(open(f'{P}{r}-words-{n}.json')))
    return {w for w in out if re.fullmatch('[a-z]+', w)}
L = {n: level(n) for n in [10, 20, 35, 40, 50, 55, 60, 70]}
upto = lambda n: set().union(*(L[k] for k in L if k <= n))
common, mid, wide = upto(35), upto(50), upto(70)
# Never an answer (and never shown): swears, slurs and crude words.
BAN = set('''fuck shit bitch bastard ass arse dick cock pussy cunt twat wanker prick slut whore piss bollocks douche dildo
blowjob handjob jizz porn nigger nigga faggot fag retard tranny chink spic kike wetback dyke gook coon beaner paki kys
anal anus boob boobs butt crap damn fart hell horny nude nudes penis poop rape raped rapes rapist semen sex sexy sperm tit
tits titty vagina vulva xxx turd wank horny homo queer negro nazi kill dead death drug drugs suicide gay gays lesbian
lust orgasm pubic sexual sexually breast breasts naked strip stripper booze crack bong weed heroin cocaine meth'''.split())
def clean(ws): return {w for w in ws if w not in BAN and not any(w.startswith(b) and len(b) >= 4 for b in BAN)}
rng = random.Random(1984)

# ── Five (Wordle-like) ──
five_all = {w for w in wide if len(w) == 5}
answers = sorted(w for w in clean(common) if len(w) == 5 and not (w.endswith('s') and not w.endswith('ss')) and not w.endswith('ed'))
rng.shuffle(answers)
five_extra = sorted(five_all - set(answers))

# ── Hive (Spelling Bee-like): 7 letters, no s, 20-55 common answers, a pangram ──
hive_pool = sorted(w for w in clean(common) if len(w) >= 4 and 's' not in w and len(set(w)) <= 7)
by_set = {}
for w in hive_pool:
    if len(set(w)) == 7: by_set.setdefault(frozenset(w), []).append(w)
sets = sorted(by_set, key=lambda s: ''.join(sorted(s)))
rng.shuffle(sets)
hive = []
seen = set()
for s in sets:
    words_in = [w for w in hive_pool if set(w) <= s]
    best = None
    for c in sorted(s):
        ans = [w for w in words_in if c in w]
        if 20 <= len(ans) <= 55 and (not best or abs(len(ans) - 35) < abs(len(best[1]) - 35)):
            best = (c, ans)
    if not best or s in seen: continue
    seen.add(s)
    c, ans = best
    others = ''.join(sorted(s - {c}))
    hive.append([c + others, sorted(ans)])
    if len(hive) >= 400: break

# ── Letter Box: 12 letters on 4 sides of 3; a two-word solution ──
box_words = sorted(w for w in clean(mid) if 3 <= len(w) <= 12 and all(a != b for a, b in zip(w, w[1:])))
seed_words = [w for w in clean(common) if 5 <= len(w) <= 9 and all(a != b for a, b in zip(w, w[1:]))]
by_first = {}
for w in seed_words: by_first.setdefault(w[0], []).append(w)
box = []
used = set()
tries = 0
while len(box) < 300 and tries < 400000:
    tries += 1
    w1 = rng.choice(seed_words)
    cands = by_first.get(w1[-1], [])
    if not cands: continue
    w2 = rng.choice(cands)
    letters = set(w1) | set(w2)
    if len(letters) != 12 or w1 == w2 or (w1, w2) in used: continue
    pairs = {frozenset(p) for w in (w1, w2) for p in zip(w, w[1:])}
    lst = sorted(letters)
    for _ in range(200):
        rng.shuffle(lst)
        sides = [lst[i:i + 3] for i in (0, 3, 6, 9)]
        side_of = {ch: k for k, sd in enumerate(sides) for ch in sd}
        if all(side_of[a] != side_of[b] for p in pairs for a, b in [tuple(p)]):
            used.add((w1, w2))
            box.append([' '.join(''.join(sd) for sd in sides), f'{w1} {w2}'])
            break

data = {
    'about': 'Word lists from SCOWL (wordlist-english 1.2.1). Copyright 2000-2016 by Kevin Atkinson. Permission to use, copy, modify, distribute and sell these word lists, the associated scripts, the output created from the scripts, and its documentation for any purpose is hereby granted without fee, provided that the above copyright notice appears in all copies and that both that copyright notice and this permission notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability of this array for any purpose. It is provided "as is" without express or implied warranty.',
    'five': {'answers': ' '.join(answers), 'extra': ' '.join(five_extra)},
    'hive': hive,
    'box': {'puzzles': box, 'words': ' '.join(box_words)},
}
json.dump(data, open(sys.argv[2], 'w'), separators=(',', ':'))
print('five answers', len(answers), 'five extra', len(five_extra), 'hive', len(hive), 'box', len(box), 'box words', len(box_words))
print('sample five', answers[:12]); print('sample hive', hive[0][0], hive[0][1][:12]); print('sample box', box[:3])
