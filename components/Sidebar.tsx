
import React from 'react';
import { User, Role } from '../types';

interface SidebarProps {
  user: User;
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, currentView, onNavigate, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'shifts', label: 'Horários', icon: '📅', roles: [Role.ADMIN, Role.COACH] },
    { id: 'sessions', label: 'Histórico', icon: '🎾', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'users', label: 'Utilizadores', icon: '👥', roles: [Role.ADMIN] },
  ];

  return (
    <aside className="w-64 bg-petrol-950 text-white flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-padelgreen-400 rounded-lg flex items-center justify-center text-petrol-950 font-black text-xl">
          P
        </div>
        <span className="text-xl font-bold tracking-tight">PADEL<span className="text-padelgreen-400">PRO</span></span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems
          .filter(item => item.roles.includes(user.role))
          .map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'bg-padelgreen-400 text-petrol-950 font-bold' 
                  : 'text-petrol-200 hover:bg-petrol-900'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </button>
          ))}
      </nav>

      <div className="p-4 border-t border-petrol-900">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
        >
          <span className="text-xl">🚪</span>
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
