import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { GameModePage } from './pages/GameModePage';
import { RoomLobbyPage } from './pages/RoomLobbyPage';
import { RoomWaitingPage } from './pages/RoomWaitingPage';
import { GamePlayPage } from './pages/GamePlayPage';
import { ResultsPage } from './pages/ResultsPage';
import { ClassementPage } from './pages/ClassementPage';
import { ProfilPage } from './pages/ProfilPage';
import { SoloPlayPage } from './pages/SoloPlayPage';
import { Route, Routes } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import useTheme from './hooks/useTheme';

function App() {
  const { connected } = useSocket();
  const { theme } = useTheme();
  const location = useLocation();

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="pb-12"
          >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/jeu/:gameId/mode" element={<GameModePage />} />
            <Route path="/jeu/:gameId/salon/creer" element={<RoomLobbyPage />} />
            <Route path="/jeu/:gameId/salon/:roomCode" element={<RoomWaitingPage />} />
            <Route path="/jeu/:gameId/salon/:roomCode/partie" element={<GamePlayPage />} />
            <Route path="/jeu/:gameId/salon/:roomCode/resultats" element={<ResultsPage />} />
            <Route path="/jeu/:gameId/salon/solo" element={<SoloPlayPage />} />
            <Route path="/classement" element={<ClassementPage />} />
            <Route path="/profil" element={<ProfilPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
