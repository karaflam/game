# Pseudo joueur en mode multijoueur — Design

Date: 2026-07-17

## Contexte

En mode multijoueur, les joueurs ne sont identifiés que par leur `socket.id` brut, à la fois côté serveur (`RoomManager.players: string[]`) et côté client (`RoomWaitingPage` affiche l'ID tel quel dans la liste "Joueurs connectés"). Il n'existe aucun champ de pseudo nulle part dans le code (backend ou frontend).

## Objectif

Demander un pseudo au joueur au moment de créer ou rejoindre un salon (`RoomLobbyPage`), et l'utiliser partout où l'identité d'un joueur est affichée à la place du `socket.id`.

## Hors scope (session actuelle)

- La page `ResultsPage` reste statique/factice (déjà le cas aujourd'hui) — non touchée.
- Aucune limite à 2 joueurs par salon n'est ajoutée.
- Pas de vérification d'unicité des pseudos dans un même salon.

## Architecture

### Backend

- `backend/src/roomManager.ts` : `RoomState.players` passe de `string[]` à `Player[]` avec `type Player = { id: string; name: string }`. Toutes les méthodes qui testaient `room.players.includes(socketId)` passent à `room.players.some(p => p.id === socketId)`. `createRoom(socketId, name)` et `joinRoom(roomId, socketId, name)` acceptent désormais un nom et l'incluent dans le `Player` poussé dans la liste.
- `backend/src/index.ts` : les handlers `create-room` et `join-room` lisent `name` depuis le payload reçu du client. Toutes les boucles `for (const playerSocketId of players)` (Action ou Vérité, Tu Préfères, 20 Questions, 2 Vérités 1 Mensonge) itèrent maintenant sur `Player` et utilisent `player.id` pour cibler l'émission socket. Le message `TruthOrDareUpdate` utilise désormais `players[activeIndex].name` au lieu du texte générique `Joueur ${activeIndex + 1}`, puisque le vrai nom est maintenant disponible — amélioration directe et sans coût supplémentaire, cohérente avec la demande.

### Frontend

- `frontend/src/store/useGameStore.ts` : exporte `type Player = { id: string; name: string }` ; `players: Player[]`.
- `frontend/src/hooks/useSocket.ts` : le handler de `room:update` type son payload avec `Player[]`.
- `frontend/src/pages/RoomLobbyPage.tsx` : un champ pseudo (texte, requis, max ~20 caractères) au-dessus des deux cartes "Créer un salon" / "Rejoindre un salon". Pré-rempli et persisté via `localStorage` (clé `game:pseudo`) pour éviter de le ressaisir à chaque partie. Les deux boutons d'action sont désactivés tant que le pseudo est vide. `handleCreateRoom`/`handleJoinRoom` envoient `{ name: pseudo.trim() }` (fusionné avec `{ roomId }` pour la jonction).
- `frontend/src/pages/RoomWaitingPage.tsx` : la liste "Joueurs connectés" affiche `player.name` (clé React = `player.id`) ; la détection de l'hôte utilise `players[0]?.id === socketId`, et le libellé hôte utilise `players[0]?.name`.
- `frontend/src/pages/GamePlayPage.tsx` : aucun changement de logique requis (`players.length` reste valide avec `Player[]`) ; le message `activePlayer` d'Action ou Vérité affichera désormais un vrai nom au lieu de "Joueur N" grâce au changement backend, sans modification côté composant.

## Validation

- Pseudo : chaîne non vide après `trim()`, longueur max 20 caractères (tronquée si besoin, pas d'erreur bloquante au-delà — simple `maxLength` HTML sur le champ).
- Pas de vérification d'unicité entre joueurs d'un même salon (hors scope, cf. ci-dessus).
