
# Game Project

Projet monorepo simple avec frontend React/Vite et backend Node.js/TypeScript + Socket.IO.

## Structure

- `frontend/` : UI React + Vite + Socket.IO client
- `backend/` : API Express + Socket.IO server

## Installation

À la racine du workspace, installez les dépendances dans chaque dossier :

```bash
cd frontend
npm install

cd ../backend
npm install
```

## Démarrage

Ouvrez deux terminaux séparés :

```bash
cd frontend
npm run dev
```

```bash
cd backend
npm run dev
```

Ensuite, ouvrez `http://localhost:5173`.

## Backend

- Serveur Express sur `http://localhost:3000`
- Socket.IO écoute les connexions et renvoie un message de bienvenue

## Frontend

- React avec Vite
- Socket.IO client se connecte au backend et affiche le message reçu
