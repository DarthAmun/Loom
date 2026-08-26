import { getDb } from "./db.js"
import { EntityRegistry } from "../entities/registry.js"
import type { Entity, EntityRef } from "../entities/types.js"

export const entityStore = {
  async list(): Promise<Entity[]> {
    return getDb().entities.toArray()
  },
  async get(id: EntityRef): Promise<Entity | undefined> {
    return getDb().entities.get(id)
  },
  async findByTag(tag: string): Promise<Entity[]> {
    return getDb().entities.where("tags").equals(tag).toArray()
  },
  async put(entity: Entity): Promise<void> {
    await getDb().entities.put(entity)
  },
  async putAll(entities: Entity[]): Promise<void> {
    await getDb().entities.bulkPut(entities)
  },
  async delete(id: EntityRef): Promise<void> {
    await getDb().entities.delete(id)
  },
}

/** Bridges Layer 1 storage into the Phase 0 in-memory resolution engine:
 * load every stored Entity into a fresh EntityRegistry so GameEngine can run
 * against persisted content instead of only the static draft data. */
export async function loadRegistryFromDb(): Promise<EntityRegistry> {
  const registry = new EntityRegistry()
  registry.registerAll(await entityStore.list())
  return registry
}
