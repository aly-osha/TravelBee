# Travel Bee 2.0 Security Policy

This document outlines security compliance, vulnerability disclosure procedures, and developer patch protocols.

---

## 🎯 Compliance Scope

All services in the Travel Bee 2.0 monorepo must adhere to the **Travel Bee Security Constitution** defined in [AGENTS.md](file:///c:/Users/MY PC/internash/Project-X/AGENTS.md). 

1. **Credentials Isolation**: Zero-tolerance policy for committing keys, credentials, or private connection strings to source control.
2. **Coord Privacy**: No precise coordinate sharing. Nearby distance markers must employ fuzzing/rounding.
3. **MIME Verification**: Any multipart handler must check signatures.

---

## 🚨 Vulnerability Reporting

If you identify a security bug, please do not file a public Github Issue. Instead, notify the Security Response team:

- **Email**: security-team@travelbee.com
- **Encryption key**: PGP fingerprint available upon request.

Our team will investigate, log the incident, and deploy fixes within 72 hours.
