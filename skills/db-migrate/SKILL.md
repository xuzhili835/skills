---
name: db-migrate
description: Add a versioned DB schema migration that auto-applies on backend startup. Use for any schema change - add/alter/drop a table or column, add index, rename. Triggers - "add a migration", "新增表/建表", "修改表结构", "加字段/加列", "加索引", "change the schema".
---

Schema changes go through **versioned migrations auto-applied on startup** — not ad-hoc SQL scripts. Ordered, idempotent, tracked in a history table, reproducible across dev/prod. Ad-hoc scripts get lost and drift; migrations don't.

## Step 0 — detect the mechanism FIRST
Projects differ. Before writing anything, find which one this repo uses:
- **Flyway** — SQL in `src/main/resources/db/migration/`, named `V{n}__{desc}.sql`; look for a `flyway_schema_history` table. Spring Boot auto-runs it on startup.
- **Liquibase** — `db/changelog/` (XML/YAML).
- **Hibernate `ddl-auto`** — entities auto-create tables, NO SQL. Safe only for early dev (no rollback, no history, no control).
- **Custom runner** — a `*MigrationRunner*.java` / `CommandLineRunner` applying SQL on startup. Read it to learn its file location + idempotency convention.
- **None** — flag it. Lightest path: a custom `CommandLineRunner` applying idempotent SQL on startup (the `DatabaseMigrationRunner` pattern), or adopt Flyway. Don't hand-run `ALTER`.

## Procedure
1. **One migration per logical change** — don't bundle unrelated alters.
2. **Create the file with the next version number** (Flyway `V{n}__add_user_phone.sql`; custom runner → wherever it loads from). Never reuse a number.
3. **Never edit an already-applied migration** — Flyway checksum-matches and fails startup; append a new one instead.
4. **Idempotency**: if the tool tracks history (Flyway), you DON'T need `IF NOT EXISTS` — each file runs once. If a custom runner may re-execute, guard with `CREATE TABLE IF NOT EXISTS` and per-ALTER checks (MySQL has no `ADD COLUMN IF NOT EXISTS` — that's MariaDB; guard in runner code or via `information_schema`).
5. **Destructive changes** (DROP / RENAME): back up data first; prefer add-new → migrate-data → drop-old over an in-place rename.
6. **Apply + verify**: restart the backend (runs on startup), then check the schema (`DESCRIBE <table>` / `\d <table>`) and the history table.
7. **Commit** the migration file together with the code change that needs it.

## Red lines
- Never edit an applied migration — append a new one.
- Never hand-run an `ALTER` on the dev DB and call it done (untracked → breaks other envs).
- Destructive change without backup → stop and confirm.
- Unsure which mechanism / no migration system → propose options, don't guess.
