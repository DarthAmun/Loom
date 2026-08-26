import type { Entity } from "../../entities/types.js"

/** #5 Sneak Attack — this is the deliverable-4 proof case: trigger-based,
 * subscribes to "strike.hit", checks a condition against the *event's*
 * target (not the caster), then adds onto the in-flight Strike's damage
 * total. See src/main.ts for the end-to-end run. */
export const sneakAttack: Entity = {
  id: "core.sneakAttack",
  name: "Sneak Attack",
  tags: ["source:core", "category:passive", "skirmisher"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  trigger: { event: "strike.hit" },
  condition: [{ kind: "hasTag", tag: "condition:flat-footed", on: "event.target" }],
  effects: [
    {
      kind: "value",
      target: "damage",
      op: "+",
      // 1d6 at level 1, scaling roughly toward pf2e's 1/5/11/17 thresholds —
      // approximated by the ScalingRule shape (base + perStep*floor(level/stepSize)),
      // which can't hit uneven thresholds exactly. Flagged in README.
      amount: { by: "level", base: 3, perStep: 3, stepSize: 5 },
    },
  ],
}
