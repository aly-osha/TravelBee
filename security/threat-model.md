# Threat Modeling - Travel Bee 2.0

This threat model outlines the attack surface, asset classifications, vulnerabilities, and countermeasures implemented in Travel Bee 2.0 based on the **STRIDE** methodology.

---

## 🏗️ Monorepo Asset Inventory

| Asset Name | Classification | Storage Location | Description |
| :--- | :--- | :--- | :--- |
| **Traveler Credentials** | Sensitive (PII) | MongoDB (`users` collection) | Password hashes, session logs, emails |
| **Traveler GPS coordinates**| High Privacy (PII) | MongoDB (`users` collection) | Obfuscated for other clients; absolute in database |
| **Private Chat logs** | Private | MongoDB (`messages` collection)| Direct private messaging histories |
| **Hidden Spots coordinates**| Proprietary | MongoDB (`places` collection) | Community-driven locations |

---

## 🔒 STRIDE Countermeasure Mapping

### 1. Spoofing Identity
- **Threat**: Attacker brute-forces traveler accounts to hijack sessions.
- **Countermeasure**: Integrated `express-rate-limit` on `/api/auth/login` blocking IPs with >5 attempts/minute. Built-in account lockout locking user emails for 15 minutes after 5 consecutive failures.

### 2. Tampering with Data
- **Threat**: Attacker uploads PHP webshells disguised as traveler photos to execute commands on servers.
- **Countermeasure**: Multer limits file sizes to 5MB. API scans uploaded image byte buffers for script indicators (`<?php`, `<script>`, `eval(`, etc.) and performs MIME-signature validation.

### 3. Repudiation
- **Threat**: Users deny writing malicious spots or posts.
- **Countermeasure**: Centralized log engine recording all security sensitive transactions (logins, uploads, manual blocks) in a structured audit trail.

### 4. Information Disclosure
- **Threat**: Attacker intercepts traveler location traces or private messages.
- **Countermeasure**: Coordinates are truncated to 2 decimal places and converted to approximate distance strings ("1.4 km away") before transmission to clients. Precise location variables are never exposed in JSON responses.

### 5. Denial of Service
- **Threat**: Request floods targeted at `/api/places` exhaust thread queues.
- **Countermeasure**: Global API rate limiters restricting traffic flow per IP.

### 6. Elevation of Privilege
- **Threat**: Traveler invokes Super Admin API requests to delete users or promote roles.
- **Countermeasure**: Whitelisted RBAC middleware checks JWT credentials role scopes against allowed role arrays on all admin/analyst endpoints.
