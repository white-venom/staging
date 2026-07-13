-- Phase 3: PortalGroup -> Portal rename (table/column/constraint/index level)
-- Run against: crediiflow_do_it_services (the only real tenant DB)
-- All operations below are Postgres metadata-only renames (ALTER ... RENAME) --
-- no data is rewritten, no rows are touched. Safe to run in a single
-- transaction. This is the second half of the two-phase Portal/BankAccount
-- untangling: Phase 2 renamed the individual-bank-account model
-- (Portal -> BankAccount); this phase renames the aggregator
-- (PortalGroup -> Portal), which is why the "group_id" columns below
-- become "portal_id".
--
-- Verified against live schema via:
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d portal_groups'
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d portal_group_adjustments'
--   docker exec doit_db psql -U doit_admin -d crediiflow_do_it_services -c '\d bank_accounts'

BEGIN;

-- 1. Main table: portal_groups -> portals
ALTER TABLE portal_groups RENAME TO portals;
ALTER TABLE portals RENAME CONSTRAINT portal_groups_pkey TO portals_pkey;
ALTER INDEX ix_portal_groups_name RENAME TO ix_portals_name;

-- 2. bank_accounts.group_id -> bank_accounts.portal_id
ALTER TABLE bank_accounts RENAME COLUMN group_id TO portal_id;
ALTER TABLE bank_accounts RENAME CONSTRAINT bank_accounts_group_id_fkey TO bank_accounts_portal_id_fkey;

-- 3. portal_group_adjustments -> portal_adjustments (table + FK column)
ALTER TABLE portal_group_adjustments RENAME TO portal_adjustments;
ALTER TABLE portal_adjustments RENAME COLUMN group_id TO portal_id;
ALTER TABLE portal_adjustments RENAME CONSTRAINT portal_group_adjustments_pkey TO portal_adjustments_pkey;
ALTER TABLE portal_adjustments RENAME CONSTRAINT portal_group_adjustments_created_by_fkey TO portal_adjustments_created_by_fkey;
ALTER TABLE portal_adjustments RENAME CONSTRAINT portal_group_adjustments_group_id_fkey TO portal_adjustments_portal_id_fkey;

COMMIT;

-- Post-migration verification (run manually after COMMIT):
--   \d portals
--   \d bank_accounts
--   \d portal_adjustments
--   SELECT count(*) FROM portals;               -- should match prior "portal_groups" row count
--   SELECT count(*) FROM bank_accounts WHERE portal_id IS NOT NULL;
--   SELECT count(*) FROM portal_adjustments;
