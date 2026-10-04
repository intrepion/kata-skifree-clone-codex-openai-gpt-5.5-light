# SkiFree Homage

This context defines the product language for a browser-playable downhill skiing game inspired by SkiFree. The game is a recognizable homage, not a simulation of skiing as a sport.

## Language

**Run**:
A single downhill attempt from start until crash, restart, or yeti capture.
_Avoid_: Match, level, session

**Slope Seed**:
The value that determines the repeatable arrangement of gates, jumps, and obstacles for a slope.
_Avoid_: Random map, level code

**New Slope**:
The player command that starts a run on a fresh slope seed.
_Avoid_: New game, shuffle, reroll

**Slope**:
The continuously scrolling snowy playfield where the run happens.
_Avoid_: Map, world, resort

**Skier**:
The player character controlled during a run.
_Avoid_: Avatar, rider, player sprite

**Gate**:
A paired marker that rewards clean navigation when the skier passes through it.
_Avoid_: Checkpoint, hoop, flag pair

**Obstacle**:
A slope object that threatens the run through collision or forced evasion.
_Avoid_: Enemy, hazard, trap

**Tree**:
A fixed obstacle that acts as the most common readability test on the slope.
_Avoid_: Pine, forest tile

**Rock**:
A fixed obstacle with a compact collision profile that breaks up tree-only dodging.
_Avoid_: Boulder, stone

**Stump**:
A low fixed obstacle that adds visual and collision variety without changing the run's core rules.
_Avoid_: Log, trunk

**Moving Hazard**:
A non-yeti obstacle that crosses or drifts through the slope during a run.
_Avoid_: Enemy, NPC, monster

**Jump**:
A slope feature that launches the skier into a brief airborne state.
_Avoid_: Ramp, kicker, launch pad

**Trick**:
A simple airborne action that rewards timing during a jump.
_Avoid_: Combo move, stunt, ability

**Airborne State**:
The brief state after using a jump where the skier can earn trick points and clear low obstacles.
_Avoid_: Flight mode, invulnerability, jump mode

**Crash**:
The run-ending tumble caused by colliding with an obstacle or being caught by the yeti.
_Avoid_: Damage, death, failure state

**Yeti**:
The late-run pressure creature that appears after a distance milestone and can capture the skier.
_Avoid_: Monster, boss, enemy

**Yeti Phase**:
The late-run state where warnings give way to an active chase by the yeti.
_Avoid_: Boss fight, final level, monster round

**Milestone Survival**:
The core success model: ski far enough to trigger the yeti phase, then survive as long and as skillfully as possible.
_Avoid_: Campaign, finish line, pure endless mode

**Prestige Score**:
The score contribution earned by surviving after the yeti phase begins.
_Avoid_: Endgame points, bonus round score

**Nostalgic Presentation**:
The visual identity: early desktop-era clarity, tiny readable sprites, flat snow, and immediate legibility on modern screens.
_Avoid_: Retro filter, ski resort realism, modern sports broadcast

**Deadpan HUD**:
The minimal, straight-faced on-screen display for distance, score, run state, and bests.
_Avoid_: Tutorial panel, announcer overlay, sports broadcast

**Full-Window Canvas**:
The responsive play surface that fills the browser window behind the compact HUD.
_Avoid_: Game frame, embed, viewport panel

**Touch Controls**:
The mobile-sized thumb controls used to steer, jump, and restart without a keyboard.
_Avoid_: Mobile mode, virtual keyboard, accessibility controls

**Local Best**:
A best score or distance stored in the browser for the current device.
_Avoid_: Leaderboard, profile, save file

**Test Surface**:
The narrow browser API used by automated checks to control seeds, inspect state, and force milestone conditions.
_Avoid_: Cheat API, debug console, admin mode
