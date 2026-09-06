-- Renames the reserved-for-future-provider enum value from the
-- vendor-specific "YAHOO" to the provider-agnostic "EXTERNAL", now that the
-- app is deployed synthetic-only (see README "Market data"). A plain
-- RENAME VALUE relabels any existing rows in place; it does not touch data.
ALTER TYPE "ObservationSource" RENAME VALUE 'YAHOO' TO 'EXTERNAL';
