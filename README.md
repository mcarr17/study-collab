# AI Study Collab

AI Study Collab is a collaborative study platform built with React, Express, Firestore, Socket.IO, and the Gemini API.

## Prerequisites

Install:

* Node.js 20+
* Docker
* Google Cloud SDK (`gcloud`)
* kubectl

Enable the following Google Cloud services:

* Google Kubernetes Engine (GKE)
* Artifact Registry
* Cloud Build

---

## Environment Variables

Configure the backend with:

```text
PORT
JWT_SECRET
CLIENT_ORIGIN

GEMINI_API_KEY

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

---

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

---

## Build Application

Build the frontend:

```bash
npm run build
```

Verify linting:

```bash
npm run lint
```

---

## Docker Deployment

Build the Docker image:

```bash
docker build -t ai-study-collab .
```

Run locally:

```bash
docker run -p 8080:8080 ai-study-collab
```

Verify:

```bash
curl http://localhost:8080/healthz
```

---

## Kubernetes Deployment

Deploy the application:

```bash
kubectl apply -f k8s/
```

Check deployment status:

```bash
kubectl get pods
kubectl get services
```

Once the LoadBalancer receives an external IP:

```bash
curl http://<EXTERNAL-IP>/healthz
```

Open:

```text
http://<EXTERNAL-IP>
```

---

## GitHub Actions Deployment

Deployment is automated using GitHub Actions.

Required repository secrets:

```text
GCP_PROJECT
GKE_CLUSTER
GKE_ZONE
GCP_SA_KEY
```

Every push to the `main` branch automatically:

1. Builds the application
2. Runs lint checks
3. Builds a Docker image
4. Pushes the image to Artifact Registry
5. Deploys the image to GKE
6. Waits for rollout completion

---

## Verification

Confirm deployment with:

```bash
kubectl get pods
kubectl get services
curl http://<EXTERNAL-IP>/healthz
```

Expected response:

```json
{
  "ok": true
}
```
