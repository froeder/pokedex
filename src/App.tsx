import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './hooks/useAuth';
import { AddCardPage } from './pages/AddCardPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function ProtectedRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return <div className="screen-loader">Carregando sessão...</div>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return <div className="screen-loader">Carregando sessão...</div>;
  }

  return user ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/adicionar" element={<AddCardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
