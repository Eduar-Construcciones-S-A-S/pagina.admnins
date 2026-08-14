// App.tsx — Rutas principales

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import OverviewPage from "./pages/OverviewPage";
import ReservasPage from "./pages/ReservasPage";
import PlanesPage from "./pages/PlanesPage";
import ClientesPage from "./pages/ClientesPage";
import ParticipantesPage from "./pages/ParticipantesPage";
import ControlOperativoPage from "./pages/ControlOperativoPage";
import ProtectedRoute from "./components/ProtectedRoute";

import "./styles/dashboard.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="reservas" element={<ReservasPage />} />
          <Route path="control-operativo" element={<ControlOperativoPage />} />
          <Route path="planes" element={<PlanesPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="participantes" element={<ParticipantesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
