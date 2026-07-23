import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Shell, Spinner } from './components/UI';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NovoSimulado from './pages/NovoSimulado';
import Resolucao from './pages/Resolucao';
import Resultado from './pages/Resultado';
import Impressao from './pages/Impressao';
import Revisoes from './pages/Revisoes';
import RevisaoProgramada from './pages/RevisaoProgramada';
import Desempenho from './pages/Desempenho';
import Ranking from './pages/Ranking';
import Banco from './pages/Banco';

function FullSpinner() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner /></div>;
}

// Rotas dentro do shell (sidebar + conteúdo)
function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

// Rotas autenticadas em tela cheia (impressão)
function PrivateBare({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Public><Login /></Public>} />
          <Route path="/registro" element={<Public><Register /></Public>} />

          <Route path="/" element={<Private><Dashboard /></Private>} />
          <Route path="/novo" element={<Private><NovoSimulado /></Private>} />
          <Route path="/simulados/:id" element={<Private><Resolucao /></Private>} />
          <Route path="/simulados/:id/resultado" element={<Private><Resultado /></Private>} />
          <Route path="/revisoes" element={<Private><Revisoes /></Private>} />
          <Route path="/revisao-programada" element={<Private><RevisaoProgramada /></Private>} />
          <Route path="/desempenho" element={<Private><Desempenho /></Private>} />
          <Route path="/ranking" element={<Private><Ranking /></Private>} />
          <Route path="/banco" element={<Private><AdminOnly><Banco /></AdminOnly></Private>} />

          <Route path="/simulados/:id/imprimir" element={<PrivateBare><Impressao /></PrivateBare>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
