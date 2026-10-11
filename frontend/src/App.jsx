import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Public Auth Pages
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import SignupNotice from './pages/SignupNotice';

// Operational Platform Pages
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Rolls from './pages/Rolls';
import CreateRoll from './pages/CreateRoll';
import Passport from './pages/Passport';
import Machines from './pages/Machines';
import Stock from './pages/Stock';
import DelayRadar from './pages/DelayRadar';
import RadarExplainPanel from './pages/RadarExplainPanel';
import QualityControlTower from './pages/QualityControlTower';
import CorrectiveActions from './pages/CorrectiveActions';
import Team from './pages/Team';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignupNotice />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="stock" element={<Stock />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:orderNumber" element={<OrderDetail />} />
            <Route path="rolls" element={<Rolls />} />
            <Route path="rolls/new" element={<CreateRoll />} />
            <Route path="rolls/:rollId" element={<Passport />} />
            <Route path="machines" element={<Machines />} />
            <Route path="quality" element={<QualityControlTower />} />
            <Route path="quality/actions" element={<CorrectiveActions />} />
            <Route path="delay-radar" element={<DelayRadar />} />
            <Route path="delay-radar/:orderNumber" element={<RadarExplainPanel />} />
            <Route
              path="team"
              element={
                <ProtectedRoute ownerOnly>
                  <Team />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
