# Persistence and migration

`server/db.js` enables SQLite foreign keys, WAL, and a busy timeout. It applies numbered migrations (currently `001_initial.sql`, `002_class_groups.sql`, and `003_document_suggestions.sql`) within `BEGIN IMMEDIATE` transactions and records each version in `schema_migrations`. Future changes need new migration files and explicit version handling; never edit an already deployed migration.

| Table                 | Integrity and purpose                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `users`               | UUID; case-insensitive unique email; constrained role/status; one admin; immutable identity/role; staff password hashes |
| `student_identities`  | Unique 11-digit student ID/user; checked email/role on insert; server-assigned department                               |
| `teacher_profiles`    | Unique immutable teacher ID; institutional information, decision reason, reviewer/time                                  |
| `teacher_requests`    | Requested departments, distinct from granted permissions                                                                |
| `departments`         | Stable UUID, unique code, editable name/active state; historical references retained                                    |
| `teacher_departments` | Composite primary key and foreign keys; approved teachers only                                                          |
| `department_heads`    | Department primary key enforces one head; composite foreign key requires membership; membership removal cascades        |
| `sessions`            | Hashed opaque token, user reference, CSRF token, verification marker, expiry; user/expiry indexes                       |
| `auth_tokens`         | Hashed, expiring, one-use reset/student-verification tokens                                                             |
| `rate_limits`         | Persistent HMAC-keyed attempt counters with expiry                                                                      |
| `notices`             | Immutable author/scope; status/time/version; only admin-authored notices may broadcast university-wide                                  |
| `attachments`         | Original bytes, sanitized name/MIME/size; authorized download only                                                      |
| `notice_revisions`    | Unique notice/version snapshots with actor and time                                                                     |
| `audit_logs`          | Account decisions, memberships, head changes, and notice transitions                                                    |

Approval, assignment changes, head replacement, student creation, password reset, and notice mutations are transactional with audits. A database trigger removes a suspended teacher's memberships and head assignments. The service revokes account sessions and evaluates memberships live.

Legacy data is never silently imported. Existing browser data remains untouched. An admin-reviewed import must resolve real authors to registered accounts, map departments to stable IDs, validate original attachments, choose publication states, and create revisions/audits. Never trust legacy role fields or import fictitious demo identities.

## Moving to a managed database

1. Provision university-managed PostgreSQL with least-privilege credentials, encryption, and tested backups.
2. Port foreign keys, checks, the partial unique admin index, membership/head relation, immutable-identity rules, and transactions. Preserve optimistic notice versions and atomic token consumption.
3. Replace synchronous SQLite calls with an explicit asynchronous database/repository layer. A PostgreSQL driver is not a drop-in replacement for `node:sqlite`; rerun transaction/concurrency tests.
4. Preserve UUIDs and Argon2id hashes, verify record counts/references, and expire sessions/tokens at cutover.
5. Move attachment bytes to private object storage if needed, with authorization, quarantine/scanning, quotas, and retention. Any signed download URLs must be scoped and short-lived.
6. Use shared throttling/session infrastructure for multiple instances and export audits to an append-only service.
7. Rehearse read-only cutover, rollback, and restore with nonproduction data; rerun API/browser suites before enabling writes.

## Classes and document processing

Migration 002 adds `class_groups` (unique department/batch/class/section), `group_memberships` (unique group/student, with a same-department eligibility trigger), and immutable `notices.group_id`. A student department transfer clears memberships. Existing notices retain their department scope; ordinary teachers can read existing published department notices but need current head permission to modify or publish department-wide notices.

`document_previews` stores source hashes, queue status, PDF bytes, extracted/OCR text, processing errors, and source-derived title and key phrase suggestions. `document_pages` stores numbered PNG page previews. Both cascade from the attachment; replacement removes stale previews. The worker checks the source hash before committing results so a replaced or deleted attachment cannot receive stale output. Pending work survives a restart, and interrupted work is requeued. Original attachment bytes are never overwritten by OCR or conversion.
