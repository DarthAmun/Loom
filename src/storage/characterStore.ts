import { getDb, now, type StoredCharacter } from "./db.js"
import { createCharacter, type NewCharacterParams as CharacterFactoryParams } from "../character/factory.js"
import type { Character } from "../character/types.js"

export interface NewCharacterParams extends CharacterFactoryParams {
  name: string
}

export const characterStore = {
  async list(): Promise<StoredCharacter[]> {
    return getDb().characters.orderBy("updatedAt").reverse().toArray()
  },
  async get(id: number): Promise<StoredCharacter | undefined> {
    return getDb().characters.get(id)
  },
  async create(params: NewCharacterParams): Promise<StoredCharacter> {
    const timestamp = now()
    const record: StoredCharacter = {
      ...createCharacter(params),
      name: params.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    // `add()` only returns the generated key — but every field is already in
    // `record`, so there's nothing a follow-up get() would tell us that we
    // don't already have.
    const id = await getDb().characters.add(record)
    return { ...record, id }
  },
  async update(id: number, changes: Partial<Character>): Promise<void> {
    await getDb().characters.update(id, { ...changes, updatedAt: now() })
  },
  async delete(id: number): Promise<void> {
    await getDb().characters.delete(id)
  },
}
