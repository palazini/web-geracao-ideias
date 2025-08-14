import { Routes, Route, Navigate } from "react-router-dom";
import AppShellLayout from "./layout/AppShellLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import { useAuth } from "./context/AuthContext";

import IdeaNew from "./pages/IdeaNew";
import IdeasList from "./pages/IdeasList";
import IdeaDetail from "./pages/IdeaDetail";
import Dashboard from "./pages/Dashboard";
import MyIdeas from "./pages/MyIdeas";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function CommitteeRoute({ children }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return role === "comite" ? children : <Navigate to="/" replace />;
}


export default function App() {
  return (
    <AppShellLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/ideias"
          element={
            <CommitteeRoute>
              <IdeasList />
            </CommitteeRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <CommitteeRoute>
              <Dashboard />
            </CommitteeRoute>
          }
        />

        <Route
          path="/ideias/:id"
          element={
            <CommitteeRoute>
              <IdeaDetail />
            </CommitteeRoute>
          }
        />

        <Route
          path="/ideias/nova"
          element={
            <PrivateRoute>
              <IdeaNew />
            </PrivateRoute>
          }
        />

        <Route
          path="/minhas-ideias"
          element={
            <PrivateRoute>
              <MyIdeas />
            </PrivateRoute>
          }
        />

      </Routes>
    </AppShellLayout>
  );
}