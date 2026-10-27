#!/bin/bash
# Loads schema.sql and homework.sql into a throwaway database and runs
# homework.test.sql against it. Needs a local Postgres you can reach with
# psql (set PGHOST, PGPORT, PGUSER as usual); it creates and drops a
# database called debrod_hw_test. Exits non-zero if any check fails.
set -eo pipefail
cd "$(dirname "$0")/.."
DB=debrod_hw_test
export PGOPTIONS='-c client_min_messages=warning'
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
# The roles are cluster-wide, so they may already exist from an earlier run.
for role in anon authenticated 'service_role bypassrls'; do
  psql -q -d postgres -c "do \$\$ begin create role $role nologin; exception when duplicate_object then null; end \$\$"
done
grep -v '^create role' tests/supabase-stub.sql | psql -q -v ON_ERROR_STOP=1 -d $DB -f -
psql -q -v ON_ERROR_STOP=1 -d $DB -f schema.sql -f homework.sql
PGOPTIONS= psql -q -o /dev/null -v ON_ERROR_STOP=1 -d $DB -f tests/homework.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
psql -q -d postgres -c "drop database $DB"
