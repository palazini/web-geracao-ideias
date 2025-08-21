import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import AppShellLayout from "./layout/AppShellLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import IdeasList from "./pages/IdeasList";
import IdeaNew from "./pages/IdeaNew";
import IdeaDetail from "./pages/IdeaDetail";
import IdeaEdit from "./pages/IdeaEdit";
import MyIdeas from "./pages/MyIdeas";
import Invites from "./pages/Invites";
import Profile from "./pages/Profile";
import Ranking from "./pages/Ranking";
import MyManaged from "./pages/MyManaged";
import { useAuth } from "./context/AuthContext";

// exige login
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

// só comitê
function CommitteeRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return role === "comite" ? children : <Navigate to="/" replace />;
}

// AppShell + Outlet para rotas autenticadas
function PrivateAppLayout() {
  return (
    <PrivateRoute>
      <AppShellLayout>
        <Outlet />
      </AppShellLayout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* pública */}
      <Route path="/login" element={<Login />} />

      {/* tudo abaixo usa AppShell */}
      <Route element={<PrivateAppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/minhas-ideias" element={<MyIdeas />} />
        <Route path="/ideias/nova" element={<IdeaNew />} />
        <Route path="/ideias/:id" element={<IdeaDetail />} />
        <Route path="/ideias/:id/editar" element={<IdeaEdit />} />

        {/* comitê */}
        <Route path="/ideias" element={<CommitteeRoute><IdeasList /></CommitteeRoute>} />
        <Route path="/admin/convites" element={<CommitteeRoute><Invites /></CommitteeRoute>} />
        <Route path="/ranking" element={<CommitteeRoute><Ranking /></CommitteeRoute>} />
        <Route path="/gestoes" element={<CommitteeRoute><MyManaged /></CommitteeRoute>} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
