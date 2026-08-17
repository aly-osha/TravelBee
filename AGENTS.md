# Travel Bee 2.0 Security Constitution

This document contains rules, standards, and design policies for all development agents working on the Travel Bee 2.0 repository.

---

## 🔒 Security Principles

1. **Secrets Security**:
   - Never write credentials, database connection strings, or JWT signing secrets directly in code.
   - Use `process.env` configurations.

2. **Coordinate & Location Privacy**:
   - Never store or expose precise GPS coordinates of users to other clients.
   - Truncate coordinates to 2 decimal places when returning nearby list, or compute and return approximate distances (e.g. "0.8 km away") instead of lat/lng pairs.

3. **Input Validation**:
   - Sanitize all incoming payloads.
   - Prevent NoSQL injection by scrubbing key names starting with `$` or `.` from req.body, req.query, and req.params before passing to database queries.

4. **Access Control (RBAC)**:
   - Check resource ownership for endpoints dealing with personal messaging or files.
   - Verify JWT and user roles against a white-listed RBAC array on all admin/moderator/analyst routes.

5. **Upload Processing**:
   - Scan uploaded files for polyglots, verify MIME type signatures against file content, and restrict maximum upload size to 5MB.

---

## 🗂️ Project Workspace Structure

- `apps/web`: React-based frontend web app & admin console
- `apps/api`: Express-based REST API
- `apps/realtime`: Socket.IO service
- `apps/worker`: Image processing and security scanning daemon
- `packages/`: Shared validation rules and shared schema interfaces
- `infrastructure/kubernetes`: Production cluster manifest files
- `security`: Threat modeling documentation and mitigation strategies
