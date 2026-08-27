import { strike } from "./strike.js"
import { powerAttack } from "./powerAttack.js"
import { reactiveStrike } from "./reactiveStrike.js"
import { rage, ragingBuff } from "./rage.js"
import { sneakAttack } from "./sneakAttack.js"
import { chainmail } from "./armor.js"
import { flatFooted, frightened } from "./conditions.js"
import { forceBolt } from "./spellcasting.js"
import { layOnHands } from "./healing.js"
import { persistentFire } from "./persistentDamage.js"
import { finesse } from "./weaponTraits.js"
import { breathWeapon } from "./monsterAbilities.js"
import { battleMedicine } from "./skillFeats.js"
import { fireImmunity, fireResistance, fireWeakness } from "./resistances.js"
import type { Entity } from "../../entities/types.js"

// #6 Proficiency and #10 Spell Slots are deliberately absent here — both are
// Layer 0/Layer 4 concepts, not Entities:
//  - Proficiency: pure math, see src/core/proficiency.ts. Confirmed correct
//    to model as NOT an Entity — every check/DC *references* a proficiency
//    key, nothing ever authors one as content.
//  - Spell Slots: per-character countable state, modeled as
//    Character.resources (Layer 4), e.g. resources.set("spellSlots.rank1",
//    { current: 3, max: 3 }). Entities like Force Bolt reference/consume a
//    resource key the same way core.condition.persistentFire's flat-check
//    does — they don't define the resource themselves.

export const allMechanics: Entity[] = [
  strike,
  powerAttack,
  reactiveStrike,
  rage,
  ragingBuff,
  sneakAttack,
  chainmail,
  flatFooted,
  frightened,
  forceBolt,
  layOnHands,
  persistentFire,
  finesse,
  breathWeapon,
  battleMedicine,
  fireImmunity,
  fireResistance,
  fireWeakness,
]
