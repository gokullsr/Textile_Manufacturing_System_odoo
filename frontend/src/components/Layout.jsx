
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  QrCode,
  Cpu,
  ShieldAlert,
  ClipboardCheck,
  Radar,
  Users,
  Layers,
  Menu,
  X,
  Activity,
  ChevronRight,
  LogOut,
  Key,
  ShieldCheck,
  User,
} from 'lucide-react';

export const Layout = () => {
  const { user, logout, isOwner, hasPermission } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const location = useLocation();

  // Exact navigation order requested:
  // 1. Dashboard, 2. Stock, 3. Production Orders, 4. Fabric Rolls, 5. Machines, 6. Quality Tower, 7. CAPA Actions, 8. Delay Radar, 9. Team (Owner only)
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
    { name: 'Material Stock', href: '/stock', icon: Boxes },
    { name: 'Production Orders', href: '/orders', icon: ClipboardList },
    { name: 'Fabric Rolls (QR)', href: '/rolls', icon: QrCode },
    { name: 'Machines', href: '/machines', icon: Cpu },
    { name: 'Quality Control Tower', href: '/quality', icon: ShieldAlert },
    { name: 'CAPA Actions', href: '/quality/actions', icon: ClipboardCheck },
    { name: 'Delay Radar', href: '/delay-radar', icon: Radar },
    ...(isOwner ? [{ name: 'Team & Access', href: '/team', icon: Users }] : []),
  ];

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Command Center Overview';
    if (location.pathname === '/stock') return 'Material Inventory & Shortfalls';
    if (location.pathname.startsWith('/orders/')) return 'Order Specification Detail';
    if (location.pathname === '/orders') return 'Production Work Orders';
    if (location.pathname.startsWith('/rolls/new')) return 'Generate Fabric Roll';
    if (location.pathname.startsWith('/rolls/')) return 'Stage Quality Passport';
    if (location.pathname === '/rolls') return 'Fabric Roll Digital Passports';
    if (location.pathname === '/machines') return 'Machine Workcenters';
    if (location.pathname === '/quality/actions') return 'Corrective Actions (CAPA)';
    if (location.pathname === '/quality') return 'Quality Control Tower';
    if (location.pathname.startsWith('/delay-radar/')) return 'Explainable Delay Radar Trace';
    if (location.pathname === '/delay-radar') return 'Explainable Delay Radar';
    if (location.pathname === '/team') return 'Team & Access Administration';
    return 'Textile Operations';
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-teal-500 selection:text-white overflow-hidden">
      {/* Mobile Top Navbar */}
      <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-lg">LoomIQ</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
            aria-label="User menu"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation - Fixed & Non-Scrolling with page */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:h-full md:flex-shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 text-lg">LoomIQ</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Textile Operations OS</p>
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

        {/* User Card in Sidebar Bottom */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'OP'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Operator'}</p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">{user?.email}</p>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                user?.role === 'owner' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {user?.role || 'user'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex-1 py-1 px-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Change Password"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Password</span>
              </button>
              <button
                onClick={logout}
                className="flex-1 py-1 px-2 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="hidden md:flex flex-shrink-0 items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">LoomIQ</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-teal-700 font-medium">{getPageTitle()}</span>
          </div>

          {/* User Profile Badge in Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-medium text-slate-700">{user?.name}</span>
              <span className="text-slate-400">•</span>
              <span className="uppercase font-bold text-slate-600 text-[10px]">{user?.role}</span>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Change Password"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
