
import React from 'react';
import { User, Role } from '../types';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: any) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: '🏠', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'shifts', label: 'Agenda', icon: '📅', roles: [Role.ADMIN, Role.COACH] },
    { id: 'sessions', label: 'Treinos', icon: '🎾', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
    { id: 'users', label: 'Pessoas', icon: '👥', roles: [Role.ADMIN] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar 
          user={user} 
          currentView={currentView} 
          onNavigate={onNavigate} 
          onLogout={onLogout}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 shrink-0 z-20">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 bg-padelgreen-400 rounded-lg flex items-center justify-center text-petrol-950 font-black text-lg">
              P
            </div>
            <h1 className="text-lg font-bold text-petrol-900 truncate max-w-[150px]">
              {currentView === 'dashboard' ? 'Painel' : 
               currentView === 'users' ? 'Utilizadores' :
               currentView === 'shifts' ? 'Agenda' : 'Histórico'}
            </h1>
          </div>
          
          <h1 className="hidden md:block text-xl font-bold text-petrol-900 capitalize">
            {currentView === 'dashboard' ? 'Painel de Controlo' : 
             currentView === 'users' ? 'Gestão de Utilizadores' :
             currentView === 'shifts' ? 'Horários de Treino' : 'Histórico de Sessões'}
          </h1>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{user.role}</p>
              </div>
              <button 
                onClick={() => { if(confirm('Sair da conta?')) onLogout(); }}
                className="relative group"
              >
                <img src={user.avatar} className="w-9 h-9 rounded-full object-cover ring-2 ring-padelgreen-400" alt="" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white md:hidden"></div>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {visibleMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              currentView === item.id 
                ? 'text-padelgreen-600' 
                : 'text-slate-400'
            }`}
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            {currentView === item.id && (
              <div className="absolute bottom-1 w-1 h-1 bg-padelgreen-500 rounded-full"></div>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
