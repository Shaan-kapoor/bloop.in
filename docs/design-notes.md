# Design notes

Working notes for bloop.in: what each idea is, why it was chosen, what was rejected, and what is still open. Kept in the repo so the thinking is not lost between sessions. Newest work first.

## The grump duel (in progress)

**Status:** built and playable, not yet tuned or reviewed. README still describes the older boss and must be updated when this settles.

### The brief

The owner asked for boss fights that are more interesting, with good rewards, that feel like a multiplayer match: "he is also racing to defeat you", "something like a PvP battle with the boss, he has his own drops".

### The concept

The grump plays your own game back at you, upside down.

- You are Oom at the top, dropping drops down. The grump floats in the pool at the bottom and throws drops up.
- A wall of pods hangs between you. Both sides chew through it. Each grump has its own wall shape.
- The grump's drops are your drops mirrored and slowed: same bounces, same wear, floating up instead of falling. It shows a dotted aim line before it throws, so you can read the shot and answer it.
- Its goal: reach Oom. Every drop that gets there makes Oom yawn. Three yawns and Oom nods off, which ends the dive.
- Your goal: wake the grump by knocking goo off it, as before. What you knock off stays off between dives.
- When one of your drops meets one of its drops, both burst ("clash"). A big drop goes straight through. Little free drops do not count.
- The grump gets as many drops per dive as you have, shown as pips over its head.
- After each handful of throws it has to yawn. The spot is marked just before. A real drop in the mouth counts triple, stuns it, gives you a big drop and takes one yawn off Oom.

Why this shape: it reuses everything the player already knows (aim line, bounces, wear, pods), so the fight needs no tutorial, and it gives the grump visible intent, a hand of drops and a win condition, which is what makes an opponent feel like a player.

### Rewards as built

- Goo knocked off the grump falls as goo you keep.
- Stake: the whole dive's goo is doubled if Oom never yawned, x1.5 after one yawn, x1.25 after two, x1 after three.
- Clashes pay gold goo and add to the combo.
- Waking a grump: a 40-drop jackpot, one pearl every time, and the first time it comes along for good with its own trick.
- The upgrade sheet after a win says who woke up and what they bring.

### The six grumps

| Grump | Wall | Handful | Tricks |
| --- | --- | --- | --- |
| grum | blanket with a belly | 2 | none |
| snorl | arch | 2 | throws two at once |
| glug | two banks, open lane | 2 | last drop of a handful is fat and takes two hits; yawns to one side |
| hush | net | 3 | drifts sideways; yawns to one side |
| knot | four rows thick | 3 | twin throws; wall grows back; yawns to one side |
| dooze | five rows with slanting lanes | 4 | fat drop; drifts; wall grows back; yawns to one side |

Numbers live in the `GRUMPS` table in `public/js/game.js` (`clip`, `gap`, `pace`, `wit`).

### What has been checked

- Balance bot, 70 to 160 rounds, several settings: no stuck rounds. Grumps take 1 to 5 dives each. Dives last roughly 10 to 35 seconds.
- Screenshots of: the aim line, drops in flight, the yawn, Oom's yawn, the knock-out, each wall, the shop text.
- Not checked: played by hand; sound in a real browser; the desktop layout.

### Known weak points (my own, before review)

1. The grump almost never knocks Oom out. In bot runs Oom takes 0 to 2 yawns, so the threat is mostly a lost multiplier.
2. With a strong build the swarm of player drops cancels nearly every grump drop without the player meaning to.
3. Grump drops and wall pods are both violet. A pulsing pink ring marks the drops, but it is faint.
4. The three "z" slots on Oom's forehead are hard to read against its highlight.
5. A first-timer at depth 5 gets one hint line and nothing else.
6. Dumping every drop at once still works as a way to avoid the fight.

### Ideas held in reserve

- One tug-of-war bar instead of a bar plus z slots: grump awake from one end, Oom sleepy from the other.
- The grump eats what it pops: wall pods it bursts feed it, so the wall becomes a real race for goo.
- A final rush: at the last 10% the grump throws its whole hand at once.
- Rematch reward scaled by how few dives the win took.

### Review loop

A critic agent is asked for a ranked list of problems and fixes after each build. Its findings and what was done about them are recorded here.

- Round 1 (earlier boss, before the duel): fights were waiting, the yawn took no skill, dumping drops skipped the mechanics, the companions were generic. All addressed, then the whole boss was rebuilt as the duel above.
- Round 2 (the duel, build 23edb5d): verdict "a timed pinata, not a duel". Scores: PvP feel 3, satisfaction 5, clarity 4, rewards 4 (out of 10).

#### Round 2 findings (critic's sims and reading of the code)

1. **No opponent, only a timer with a face.** It throws on a fixed clock, ignores your drops, stops when you stop, and its only win (three yawns) resets every dive while your damage persists.
2. **Yawn farming is infinite and free.** A hit in the yawn refunded the drop and armed a big one, and big x crit stacked to x9. Sim at depth 15: 54 crits from 57 shots in one dive, no yawns taken.
3. **Dumping all drops switches it off.** It threw 1 to 2 of its drops before the player's were gone. Careful play was punished instead.
4. **Late game the swarm deletes every drop**, and the grump depth was easier than the depths around it (depth 29 took 15 dives, depth 30 took 2 to 5).
5. **Rewards small, late and unexplained.** From depth 15 the winning dive often paid less than the dive before it. A pearl means nothing at depth 5. Three companion perks were invisible stat bumps.
6. **First-timer is told the wrong thing.** The hint pointed at popping drops, not the yawn, and vanished on the first shot. The z slots on Oom read as "asleep". "grum 0%" reads as health.
7. **Mostly waiting.** Its drops crossed in 3 s or more; a random-aim dive moved the bar 2 to 5%.
8. **A clash deleted the drop you aimed** for three specks of gold.
9. **Knock-out either never comes or feels cheap** (10 of 11 yawns landed after the player had nothing left).
10. **Violet on violet.** Its drops look like loose wall pods.
11. **The wall is cover for it and a tax for you.** Its drops slipped through almost every time.
12. **Bugs:** twin throws were not aimed where it scored; fat drops aimed with the wrong size; big drop did not pop a fat one; "throws faster" barely faster; silent stake recovery; regrow could land on a drop; pips promised parity and did not keep it.

Critic's bold ideas: (A) copycat, it answers each throw with your own throw mirrored; (B) thick beats thin, a fresh drop turns its drop into one of yours; (C) the last yawn, a finishing shot that doubles the jackpot if it lands in the mouth.

#### Round 2 plan (what is being built in answer)

- **Answer-throws and copycat.** Every drop you let go is answered about a second later, often with your own shot mirrored. Dumping means a volley comes back with nothing left to stop it. Holding still is not safe either: it throws anyway after a few seconds.
- **The bar moves both ways.** Each yawn Oom catches lets the grump doze back a little (a knock-out more). That is its lasting win.
- **The wall is your shield.** Its drops now wear out in two knocks, so it needs a lane to score, and every lane you dig toward it is a lane for it.
- **Thick beats thin.** Only drops you aimed can meet its drops. A fresh one turns its drop blue and it falls as yours; a worn one bursts.
- **Yawn hit capped.** Triple damage, no stacking with a big drop; one refunded drop per dive; a crit perks Oom up, with a popup.
- **The last yawn.** At zero it does not pop: one long yawn and one free big drop. Anywhere wakes it; in the mouth doubles the jackpot.
- **Rewards.** Jackpot about six fields' worth, shown as one number. Grump i gives i + 1 pearls, and the sheet says what a pearl does. Every companion does something you can see, and each catches one of a later grump's drops per dive.
- **Clarity.** Its things are pink. Hint appears at its first yawn and says to throw one in. The aim line turns gold when the shot will land in the mouth. A two-line scoreboard (grump, Oom) replaces the z slots. The stake is shown from the start.
- **Tempo.** Faster drops, shorter gaps, less health, no late softening.

## Oom

Oom replaces the tap at the top, which read as rude. It is the oldest drop there is, one wide dome, far too big to fall; every drop the player lets go is a little of it. It sleeps in the shop, watches each drop, winces at a miss and grins at a long chain. The first-run intro is wordless: asleep, wakes, strains twice, lets a crumb fall, then the pods appear.

Rejected on the way: three hardware droppers (still read as rude), and "the roost", "the thaw" and "the paper boat" in `prototypes/dropper-concepts.html`. Hard rule from the owner: the intro must not show who writes the notes.

## Standing rules

- Phone first. Desktop work must not change the phone layout.
- Restrained interface: flat, minimal, no stacked glows or bounce, but not sterile. The upgrade list has no descriptions.
- Option pages are local HTML files in `prototypes/`.
- Every update is pushed to GitHub. The live site is published only when the owner says so.
