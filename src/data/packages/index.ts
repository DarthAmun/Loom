import { certainStrike } from "./martialWraps.js"
import { emberBurst } from "./casterVariants.js"
import { agile, versatileS } from "./hookHeavy.js"
import type { Entity } from "../../entities/types.js"

// Each package's shared base (Strike, Force Bolt, Finesse) is already
// registered by data/mechanics/index.ts — only each package's *additional*
// entities are listed here to avoid double-registering the same id.
export const allPackageEntities: Entity[] = [certainStrike, emberBurst, agile, versatileS]
