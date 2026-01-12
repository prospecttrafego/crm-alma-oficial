# Architectural Cleanup and Refactor Plan

Status key: [ ] pending, [x] done, [~] in progress

## Milestone 1: Inventory and Plan Alignment
- [ ] Confirm scope and decide on feature removals (e.g., Companies UI)
- [~] Map all validation sources, API call sites, and legacy layers
- [~] Identify response-shape inconsistencies and client-side unwrap gaps

## Milestone 2: Single Source of Truth for Schemas
- [x] Generate/centralize insert/update schemas from Drizzle in shared
- [x] Update server validation to consume shared schemas only
- [~] Align DTOs to shared schemas (add missing fields like companyName)
- [x] Remove unused client validation layer or replace with shared schemas

## Milestone 3: API Client and Response Consistency
- [x] Make ApiClient unwrap `{ success, data }` consistently
- [x] Replace manual `fetch`/`apiRequest` usage across pages/components
- [~] Normalize query keys + query functions to avoid raw response usage

## Milestone 4: Remove Dead/Legacy Layers
- [~] Remove deprecated API call paths and unused hooks/wrappers
- [x] Remove disabled/unused routes/pages/components (e.g., Companies UI)
- [ ] Prune unused types/DTOs after client/server alignment

## Milestone 5: Storage Refactor (God Class Split)
- [x] Split `server/storage.ts` into domain modules
- [x] Extract shared helpers (pagination, normalization, tenant utils)
- [x] Preserve public storage interface and update imports

## Milestone 6: Validation and Sanity Checks
- [ ] Run typecheck and lint
- [ ] Fix regressions or unsafe assumptions discovered by refactor
