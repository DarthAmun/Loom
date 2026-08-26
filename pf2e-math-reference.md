# Layer 0 Seed Data — pulled from foundryvtt/pf2e

Source: github.com/foundryvtt/pf2e (`src/module/dc.ts`, `src/module/actor/modifiers.ts`, `packs/pf2e/classes/*.json`). This is the reference implementation's actual runtime logic, not a secondary summary — safe to treat as ground truth for PF2e's own math.

## Proficiency formula
```
bonus(rank, level) = rankBonus[rank] + (rank > 0 ? level : 0)
rankBonus = { untrained: 0, trained: 2, expert: 4, master: 6, legendary: 8 }
```
This is the single formula every attack roll, save, skill check, and class DC in PF2e derives from. It's the first thing to port into your Layer 0.

## DC by level (the other half of the chassis — what those bonuses are checked against)
| Level | DC | Level | DC | Level | DC |
|---|---|---|---|---|---|
| -1 | 13 | 8 | 24 | 17 | 36 |
| 0 | 14 | 9 | 26 | 18 | 38 |
| 1 | 15 | 10 | 27 | 19 | 39 |
| 2 | 16 | 11 | 28 | 20 | 40 |
| 3 | 18 | 12 | 30 | 21 | 42 |
| 4 | 19 | 13 | 31 | 22 | 44 |
| 5 | 20 | 14 | 32 | 23 | 46 |
| 6 | 22 | 15 | 34 | 24 | 48 |
| 7 | 23 | 16 | 35 | 25 | 50 |

## Simple DCs by rank (untethered from level — used for generic "how hard is this" checks)
`untrained: 10, trained: 15, expert: 20, master: 30, legendary: 40`
(A "Proficiency Without Level" variant exists too: master 25, legendary 30 — worth knowing exists, not needed unless you want that variant's flatter math.)

## HP per level, by class (the durability envelope — every class in the current game)
```
6  hp: Wizard, Sorcerer, Witch, Psychic
8  hp: Rogue, Bard, Oracle, Gunslinger, Magus, Alchemist, Necromancer, Inventor,
       Thaumaturge, Cleric, Druid, Commander, Animist, Runesmith, Investigator, Kineticist
10 hp: Swashbuckler, Champion, Fighter, Ranger, Monk, Summoner
12 hp: Barbarian, Guardian
```
Clear three-tier pattern: 6 = pure caster, 8 = hybrid/skill-focused, 10-12 = martial. Worth preserving as a shape even if your exact numbers diverge.

## What's not in this codebase
Treasure/wealth-by-level exists in PF2e as GM-facing guidance, not as a table the app computes from — it's not structured data here, so it wasn't pulled. If you want it, that's a manual reference-book pull rather than something to extract from this repo.

## Note on use
These are PF2e's numbers, not numbers derived for your system. They're the right starting envelope to build Layer 0 against — copy the *shape* (the formula, the tiering) with confidence, but treat the exact constants as a tunable starting point, not a locked-in target, per the balance-tuning distinction from earlier.
