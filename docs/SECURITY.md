# Security model and deployment requirements

## Trust boundary

The Node service and database are authoritative. Browser storage holds only the color theme. Native `User` objects are display data. Protected API requests resolve an opaque session to the current database account, check account status, and evaluate current department/head assignments. Frontend visibility is only a usability feature.

Session secrets are random 256-bit values; only SHA-256 hashes are stored. Cookies are HTTP-only, SameSite=Strict, scoped to `/`, and expire after eight hours. Production uses a Secure `__Host-` cookie. Development allows a non-Secure cookie for loopback testing. Password change/reset and account status changes invalidate all sessions. Department/head permissions are read live, so old privileges are ineffective on the next request even before the UI refreshes. Upload endpoints recheck the session after receiving the file.

Mutations require an exact Origin match. Authenticated mutations additionally require a per-session CSRF token. There is no permissive CORS policy. Authentication, recovery, registration, and uploads have persistent rate-limit buckets keyed by HMAC-hashed account/IP identifiers. Deploy edge throttling too. The service intentionally does not trust `X-Forwarded-For`; behind a proxy, application IP limits are shared by that proxy's users unless a reviewed trusted-proxy configuration is introduced.

Passwords use Argon2id with 19 MiB memory, two iterations, and one lane. Individual passphrases must be 15–128 characters. Passwords, hashes, and session/recovery secrets are never included in account responses or logs. Recovery requests return a generic response and do not wait for SMTP delivery. Tokens are random, stored as hashes, expire after 15 minutes, and are consumed transactionally. Reset revokes sessions without activating a suspended account or automatically signing in.

Reference: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Accounts and recovery

The administrator is provisioned only through the operator command, with a database constraint allowing one admin. Its environment-supplied initial password must be changed before administrative use. `npm run recover:admin` uses `ADMIN_EMAIL` and a new `ADMIN_INITIAL_PASSWORD` for operator-only emergency recovery, invalidates sessions, and forces a password change. Protect shell access and remove initial credentials after provisioning.

Teacher department requests are not permissions. Approval and assignment are separate actions. The administrator must verify the faculty email, appointment, and department requests against institutional records. Rejected applicants receive a decision reason and contact the administrator for review of the same immutable identity; duplicate registration is not a bypass. Suspension/deactivation removes department memberships and head assignments; reactivation needs explicit new assignments.

Department heads use their existing individual teacher accounts. The suggested shared head password is deliberately not installed. No special password or login role grants head permissions. Replacing a head and changing memberships are transactional.

Student entry has two modes. The requested local mode accepts an ID or university email without verification and permits first-time self-enrollment into an active department; existing accounts cannot change department at sign-in. It is visibly marked unverified and remains forbidden under `NODE_ENV=production`. The verified mode requires an existing directory entry and sends a single-use email link. Duplicate records are prevented in both modes, but unverified entry cannot prove identity or initial department membership.

## Public deployment gates

No real infrastructure, mail delivery, gateway policy, or student records have been configured by this code change. Complete these items with university owners:

- Configure production mode, a real HTTPS origin, protected secrets, and university SMTP. Put the service behind a TLS proxy on a private interface. Restrict direct backend access with network rules. Apply edge request/upload limits, timeouts, connection limits, and IP throttling.
- Enforce institutional MFA at an access gateway covering admin login and every administrative request. `ADMIN_MFA_GATEWAY_CONFIRMED=true` is an operator acknowledgement, **not an MFA implementation**. Startup checks cannot prove an external policy exists. Do not set it before testing the gateway and direct-backend bypass protection. Validate compatibility with native transport on devices. Alternatively implement and review application-native MFA before rollout.
- Verify SMTP delivery, teacher ownership, student-directory accuracy, recovery routing, and operator recovery. The current mail adapter has no durable retry queue: a delivery failure invalidates the link and the user must retry. Add operational delivery monitoring and a durable queue. Never expose a development-mode provisional login publicly.
- Protect SQLite and backups with OS access controls and encryption at rest. Rehearse WAL-consistent backups/restoration. Define retention and deletion policies for student data, audit records, revisions, and attachments. Add quotas and private object storage before large deployments.
- Add malware scanning and complex Office-document validation. Current uploads enforce supported extensions, basic signatures, and a 25 MiB limit; downloads use no-sniff and attachment disposition. This does not certify a file as safe or verified. Native/external document renderers still process user files.
- Test Android HTTPS configuration, signing, shared cookie behavior, email links, attachment saving/opening, accessibility, and revocation on real devices. Build/lint are not device tests. Protected screens disable screenshots/backups, but files deliberately exported by a user are outside that protection. Previously read or downloaded content cannot be retroactively revoked.
- Disable the old Firebase project's permissive rules and retire old APKs. The deny-all rules in `firebase/` are provided for operator application; they are not deployed automatically. The archived `Notify/` build is blocked, and its build outputs must not be shipped.
- Complete an independent security review, load tests, privacy/accessibility review, dependency checks, and disaster-recovery exercises. Address remaining Android lint warnings separately instead of suppressing them to claim a clean audit.

## Operational limits

SQLite provides persistent transactions for a single server on a local disk. This implementation does not provide distributed sessions/rate limits, horizontal scaling, durable mail retries, push notifications, or external security monitoring. Lists currently load authorized results without pagination; add pagination and quotas for scale. Revisions retain content/metadata but not earlier attachment bytes after replacement. Audit logs are application-protected, not tamper-proof against a database administrator; export to an institutional append-only audit service where required.

A dashboard, passing tests, production flag, or gateway acknowledgement alone is not proof of production security.

## Updated student and class workflow

At the project owner's request, development student access accepts either an ID or university email without verification and permits self-enrollment into a chosen active department. ID/email uniqueness prevents duplicate records, but does not prevent impersonation or a false department declaration at registration. Existing students cannot change their department at sign-in. These accounts never receive teacher/admin powers. The provisional label and production startup restriction remain in place; this is not a verified student identity system.

Students may immediately join any active class within their current department. Therefore class membership is self-declared, not verified enrollment. Leaving a class, transferring department, or deactivating a class removes access to notices and document artifacts on subsequent requests. Teacher department assignments and head responsibilities remain administrator-controlled.

See [document processing](DOCUMENTS.md) for converter isolation, limits, and exact-file versus converted-preview behavior.
