# Auth Testing Playbook — LAGUSIT

## Admin login
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"kepegawaianlapasgusit@gmail.com","password":"Admin123!"}'

Returns `access_token`. Use header `Authorization: Bearer <token>` for all protected endpoints.

## Verify session
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer <token>"

## Key protected endpoints
- GET /api/dashboard
- GET /api/employees
- GET /api/attendance/events
- GET /api/roles , GET /api/users
- GET /api/master/{organizational_units|sections|positions|grades|teams|attendance_types|attendance_statuses|categories}
- GET /api/audit-logs

Bcrypt hashes start with `$2b$`. users.email has a unique index.
