import type { Entity } from "../../entities/types.js"

/** #12 Persistent Damage — the clearest schema mismatch found while
 * drafting. In PF2e, persistent damage ticks at end-of-turn, then the
 * bearer rolls a flat check (DC 15): SUCCESS removes it, failure means it
 * keeps going. The brief's `conditionalDuration` only has `onFail: "remove"`
 * — there's no `onSuccess` branch, so it can only express "remove when a
 * check fails," which is backwards from how PF2e's own persistent damage
 * works. Modeled here as the honest inverse (the check is "does it keep
 * going", not "is it cured") so `onFail: "remove"` still reads correctly —
 * but that inversion is a workaround, not a fix, and it'll misread to
 * anyone who assumes `check` means "the recovery check" the way PF2e does.
 * Flagged as a schema question for a human, per the brief's deliverable 5. */
export const persistentFire: Entity = {
  id: "core.condition.persistentFire",
  name: "Persistent Fire Damage",
  tags: ["source:core", "condition:persistent-damage", "trait:fire"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  effects: [
    { kind: "value", target: "damage", op: "+", amount: 4 },
    {
      kind: "conditionalDuration",
      // Inverted per the note above: this check asks "does the damage
      // persist", so a FAILED persistence check is what triggers removal.
      check: { against: { kind: "flatDC", dc: 15 }, attribute: "persistenceCheck" },
      onFail: "remove",
    },
  ],
}
