# Shared pet integration

E-learning and its pet-function dependency use version **0.12.2**. The Git
dependency resolves to release commit `8a1993a66d60087829519c053ee7de0ed3475320`;
`package-lock.json` and the npm build approval must match that commit.

`scripts/prepare-pet.mjs` restores and verifies the installed version's Release
resources before copying non-game assets. The shared Vite plugin serves/emits
game assets. The postbuild script splits oversized WASM and PCK files and patches
every Godot loader, including the shared engine used by Kart Racing. Game URLs
and existing app features remain the same.

```sh
npm install
npm run build
npm run verify:pet
node --test tests/cloudflare-game-assets.test.mjs
```

Verification uses the installed package, compares all emitted game files with
the canonical resources, reconstructs split files byte-for-byte, and checks the
25 MiB deployment limit. It does not use the local pet preview alias or contact
application databases. No remote database migration is required for this update.

Commit the package manifest, lockfile, preparation/compression/verification
scripts and regression tests together. Generated `dist`, cached resources and
`public/pet-function` assets stay untracked. Publishing pet-function alone does
not redeploy E-learning; the host must be built and deployed after this update.
