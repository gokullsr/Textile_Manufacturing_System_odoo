
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Cpu,
  Boxes,
  Layers,
  Menu,
  X,
  Activity,
  ChevronRight,
  QrCode,
  Radar,
} from 'lucide-react';

export const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
    { name: 'Delay Radar', href: '/delay-radar', icon: Radar },
    { name: 'Production Orders', href: '/orders', icon: ClipboardList },
    { name: 'Fabric Rolls (QR)', href: '/rolls', icon: QrCode },
    { name: 'Machine Workcenters', href: '/machines', icon: Cpu },
    { name: 'Material Stock', href: '/stock', icon: Boxes },
  ];

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Command Center Overview';
    if (location.pathname.startsWith('/delay-radar/')) return 'Explainable Delay Radar Trace';
    if (location.pathname === '/delay-radar') return 'Explainable Delay Radar';
    if (location.pathname.startsWith('/orders/')) return 'Order Specification Detail';
    if (location.pathname === '/orders') return 'Production Work Orders';
    if (location.pathname.startsWith('/rolls/new')) return 'Generate Fabric Roll';
    if (location.pathname.startsWith('/rolls/')) return 'Fabric Passport';
    if (location.pathname === '/rolls') return 'Fabric Roll Digital Passports';
    if (location.pathname === '/machines') return 'Machine Operations';
    if (location.pathname === '/stock') return 'Material Inventory & Shortfalls';
    return 'Textile Operations';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-teal-500 selection:text-white">
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-lg">LoomIQ</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 text-lg">LoomIQ</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Textile Plant OS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operations Menu
          </div>
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold border border-teal-200/70 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="font-medium text-slate-700">Live API Gateway</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">QR Passport Engine Active</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">LoomIQ</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-teal-700 font-medium">{getPageTitle()}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
