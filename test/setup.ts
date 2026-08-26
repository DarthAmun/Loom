// Loaded via vitest's `setupFiles` before any test module runs — Dexie
// detects IndexedDB support once, at import time, so this has to be in
// place before any test imports "dexie" (directly or via src/storage).
import "fake-indexeddb/auto"
