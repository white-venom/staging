-- Phase 2: Portal -> BankAccount rename (table/column/constraint/index level)
-- Run against: crediiflow_do_it_services (the only real tenant DB)
-- All operations below are Postgres metadata-only renames (ALTER ... RENAME) --
-- no data is rewritten, no rows are touched, no table lock beyond a brief
-- ACCESS EXCLUSIVE lock during each instant metadata change. Safe to run in
-- a single transaction. PortalGroup / portal_groups is NOT touched here --
-- that rename is Phase 3, not started.
--
-- Verified against live schema via:
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d portals'
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d bank_deposits'
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d collections'

BEGIN;

-- 1. Main table: portals -> bank_accounts
ALTER TABLE portals RENAME TO bank_accounts;
ALTER TABLE bank_accounts RENAME COLUMN portal_name TO bank_account_name;

-- Constraint/index renames on bank_accounts (cosmetic, but keeps \d output
-- consistent with the new name instead of showing stale "portals_*" names)
ALTER TABLE bank_accounts RENAME CONSTRAINT portals_pkey TO bank_accounts_pkey;
ALTER TABLE bank_accounts RENAME CONSTRAINT portals_group_id_fkey TO bank_accounts_group_id_fkey;
ALTER INDEX ix_portals_portal_name RENAME TO ix_bank_accounts_bank_account_name;

-- 2. collections.portal_id -> collections.bank_account_id
ALTER TABLE collections RENAME COLUMN portal_id TO bank_account_id;
ALTER TABLE collections RENAME CONSTRAINT collections_portal_id_fkey TO collections_bank_account_id_fkey;

-- 3. bank_deposits.portal_id / from_portal_id -> bank_account_id / from_bank_account_id
ALTER TABLE bank_deposits RENAME COLUMN portal_id TO bank_account_id;
ALTER TABLE bank_deposits RENAME COLUMN from_portal_id TO from_bank_account_id;
ALTER TABLE bank_deposits RENAME CONSTRAINT bank_deposits_portal_id_fkey TO bank_deposits_bank_account_id_fkey;
ALTER TABLE bank_deposits RENAME CONSTRAINT bank_deposits_from_portal_id_fkey TO bank_deposits_from_bank_account_id_fkey;

COMMIT;

-- Post-migration verification (run manually after COMMIT):
--   \d bank_accounts
--   \d collections
--   \d bank_deposits
--   SELECT count(*) FROM bank_accounts;   -- should match prior "portals" row count
--   SELECT count(*) FROM collections WHERE bank_account_id IS NOT NULL;
--   SELECT count(*) FROM bank_deposits WHERE bank_account_id IS NOT NULL OR from_bank_account_id IS NOT NULL;
