import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:orderNumber" element={<OrderDetail />} />
          <Route path="delay-radar" element={<DelayRadar />} />
          <Route path="delay-radar/:orderNumber" element={<RadarExplainPanel />} />
          <Route path="rolls" element={<Rolls />} />
          <Route path="rolls/new" element={<CreateRoll />} />
          <Route path="rolls/:rollId" element={<Passport />} />
          <Route path="machines" element={<Machines />} />
          <Route path="stock" element={<Stock />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
