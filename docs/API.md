# API access rules

All paths below are relative to `/api`. Cookies authenticate accounts. `/session` returns the current user, departments, head assignments, and a CSRF token retained in client memory. Include `X-CSRF-Token` on authenticated mutations and the configured `Origin` on every mutation. JSON errors contain an `error` message. No API accepts a client-selected role or author identity.

| Routes                                             | Access                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /config`, `/departments/public`               | Public delivery mode and active department names for registration                  |
| `POST /auth/register`                              | Rate-limited; always creates a pending teacher with requests only                  |
| `POST /auth/login`                                 | Staff credentials; status controls subsequent access                               |
| `POST /auth/student`, `/auth/student/verify`       | Directory-backed student login, provisional development or email-link verification |
| `POST /auth/reset/request`, `/auth/reset/complete` | Generic recovery response and one-use token consumption                            |
| `GET /session`, `POST /auth/logout`                | Current authenticated session                                                      |
| `POST /account/password`, `PATCH /account/profile` | Current staff password required for change; profile allows only name               |
| `/admin/departments` GET/POST, `/:id` PATCH        | Admin lists/creates/updates department name and active state                       |
| `/admin/users` GET, `/:id/status` PATCH            | Admin account review; the sole admin cannot be deactivated here                    |
| `/admin/teachers/:id/departments` PUT              | Admin sets approved teacher's membership set                                       |
| `/admin/departments/:id/head` PUT                  | Admin sets eligible `teacherUserId` or `null`                                      |
| `/admin/students` POST, `/:id/department` PUT      | Admin directory provisioning and department changes                                |
| `/admin/audit` GET                                 | Admin sees latest 200 events                                                       |
| `/notices` GET/POST                                | Authorized reads; approved teachers/admin create within scope                      |
| `/notices/:id` GET/PUT/DELETE                      | Current role/author/department/head rules; mutation requires current `version`     |
| `/notices/:id/attachment` GET                      | Current notice-read permission, forced original-file download                      |
| `/notices/:id/history` GET                         | Current notice managers only                                                       |

Approved teachers can directly publish their own department notices, as in the existing workflow; there is no separate notice approval queue. They can save drafts, publish, archive, and delete. Heads also manage published/archived notices in their head department, including those by other teachers. Admin can manage every notice and draft. Published/archived notices cannot return to draft. Author and department are immutable; create a new notice for a different scope. Deleted records are excluded from reads while revisions/audits remain.

Notice writes accept JSON or multipart fields: `title`, `content`, `category`, `departmentId` (empty/null for admin broadcasts), `status`, `version` for updates, and `removeAttachment`. Multipart `file` carries one original PDF/Word file up to 25 MiB. Authentication is checked both before and after upload parsing. Unknown/sensitive fields are rejected.

Android uses the same API and session. Native transport fetches `/session` before writes for a current CSRF token and identity. Intent data cannot select the server author or grant permissions.
