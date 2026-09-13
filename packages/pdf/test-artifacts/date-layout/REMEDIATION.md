# Date-layout baseline remediation

- Normal focused runs compare Chikorita/Ditto LTR+RTL JSON coordinates, page counts, and PNG hashes against checked-in artifacts.
- All-template evidence asserts exact `missingMarkers`: `[]` for 14 templates and `['EXP_NO_PERIOD']` for Meowth, the documented blank-period exception.
- Raw PDFs are omitted; renderer `CreationDate` metadata made PDF bytes nondeterministic.
- Original characterization provenance is fixed to generation revision `58ee4eead7843105da20f8a177e7d250b24c3a87` and comparison ref `368858a56fc9c3152b540c39829908e2c3ea04c5`.

Verification:

- Focused Vitest: `pnpm exec vitest run src/templates/shared/date-layout.test.tsx` — 1 file, 7 tests, twice with baseline comparison.
- PDF typecheck: `pnpm --filter @reactive-resume/pdf run typecheck` — pass.
- Targeted Biome: `pnpm exec biome check packages/pdf/src/templates/shared/date-layout.test.tsx` — pass.
- Boundaries: `pnpm exec turbo boundaries` — pass.
- Diff checks: `git diff --check` — pass.

## CVMate Stage 11.1 baseline refresh

- Executable raster baselines were regenerated from `9d9fc7524471a9652935a8d3018b58fe19abd3d7` in the project Docker development image.
- Two isolated generation runs were byte-identical before replacement.
- Semantic JSON differences were limited to `rasterSha256`; structural and coordinate evidence was unchanged.
