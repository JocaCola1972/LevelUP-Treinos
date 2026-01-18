
import React from 'react';
import { User, Role } from '../types';

interface SidebarProps {
  user: User;
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  appLogo: string;
}

const Sidebar: React.FC<SidebarProps> = ({ user, currentView, onNavigate, onLogout, appLogo }) => {
  const isAdminEspecial = user.phone === '917772010';

  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: '🏠', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'shifts', label: 'Agenda', icon: '📅', roles: [Role.ADMIN, Role.COACH] },
    { id: 'sessions', label: 'Histórico', icon: '🎾', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'finops', label: 'Finops', icon: '💰', roles: [Role.ADMIN], specialOnly: true },
    { id: 'users', label: 'Pessoas', icon: '👥', roles: [Role.ADMIN] },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    const hasRole = item.roles.includes(user.role);
    if (item.specialOnly) return hasRole && isAdminEspecial;
    return hasRole;
  });

  return (
    <aside className="w-64 bg-petrol-950 text-white flex flex-col shrink-0">
      <div className="p-8 flex flex-col items-center gap-4 border-b border-petrol-900">
        <img 
          src={appLogo} 
          alt="TREINOS LEVELUP" 
          className="w-24 h-24 object-contain"
        />
        <div className="text-center">
            <span className="text-sm font-black tracking-widest uppercase text-white leading-tight">
              TREINOS
            </span>
            <br/>
            <span className="text-padelgreen-400 font-black text-xl tracking-tighter">LEVELUP</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {visibleMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'bg-padelgreen-400 text-petrol-950 font-bold shadow-lg shadow-padelgreen-400/10' 
                  : 'text-petrol-200 hover:bg-petrol-900'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
      </nav>

      <div className="p-4 border-t border-petrol-900">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
        >
          <span className="text-xl">🚪</span>
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
