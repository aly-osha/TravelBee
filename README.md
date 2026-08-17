# 🐝 Travel Bee 2.0

> A secure, cloud-native, location-aware social travel platform that allows users to discover nearby places and travelers, share hidden locations, communicate with other travelers, and interact with historical/community-generated content, whilst protecting users and infrastructure against common cybersecurity attacks.

---

## 🛠️ Architecture & Monorepo Structure

Travel Bee 2.0 is designed as a secure, containerized multi-tier application:

- **Frontend (`apps/web`)**: React Single Page Application utilizing a clean dark-mode-first design, Interactive Leaflet/Canvas maps, real-time messaging interface, and a custom **Security Analyst Dashboard & Attack Lab**.
- **REST API (`apps/api`)**: Node.js & Express REST server built with security middlewares (Helmet, Express-Rate-Limit, Custom NoSQL Injection sanitizer, RBAC checks).
- **Realtime Server (`apps/realtime`)**: Socket.IO server handling WebSocket traffic, messaging requests, online statuses, and payload validation.
- **Worker (`apps/worker`)**: Daemon simulating virus/malware image upload analysis, file integrity checks, and metadata scrubbing.
- **Kubernetes Manifests (`infrastructure/kubernetes/`)**: Deployments, services, HPA config, network policies, and role-based access rules.

---

## 🚀 Getting Started

### 1. Installation
Install root and package dependencies:
```bash
npm run install:all
```

### 2. Run Locally in Development
Start all applications concurrently:
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Realtime WS: `http://localhost:5001`

### 3. Run with Docker Compose
Or run the entire production-like cluster locally:
```bash
docker-compose up --build
```
