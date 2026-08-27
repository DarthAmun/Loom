import { Injectable, signal } from '@angular/core';
import { characterStore, type Character, type NewCharacterParams, type StoredCharacter } from 'loom';

@Injectable({ providedIn: 'root' })
export class CharacterStoreService {
  readonly characters = signal<StoredCharacter[]>([]);
  readonly loading = signal(false);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.characters.set(await characterStore.list());
    } finally {
      this.loading.set(false);
    }
  }

  get(id: number): Promise<StoredCharacter | undefined> {
    return characterStore.get(id);
  }

  // None of these re-run refresh(): the only consumer of the `characters`
  // list signal is the character list page, which refreshes itself on
  // mount — a builder page editing one character's attributes/active
  // entities has no use for a full IndexedDB re-list on every keystroke.
  async create(params: NewCharacterParams): Promise<StoredCharacter> {
    return characterStore.create(params);
  }

  async update(id: number, changes: Partial<Character>): Promise<void> {
    await characterStore.update(id, changes);
  }

  async remove(id: number): Promise<void> {
    await characterStore.delete(id);
  }
}
