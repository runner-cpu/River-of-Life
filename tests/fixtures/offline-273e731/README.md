# Offline upgrade regression fixture

The `.txt` files are copies of the following files from commit `273e731c5e0fc95594acaa100ce585da17316263`.

| Fixture | Source |
| --- | --- |
| `store.ts.txt` | `src/core/store.ts` |
| `persistence.ts.txt` | `src/core/persistence.ts` |
| `inquiry-badges.ts.txt` | `src/content/inquiry-badges.ts` |
| `sw.js.txt` | `public/sw.js` |

The browser fixture compiles these TypeScript files, resolves their imports to local ES modules, and supplies the old worker with its build revision. Tests can run from a shallow checkout. The current release uses the current store, persistence and writer lock modules.
