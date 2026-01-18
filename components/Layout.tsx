
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
    { id: 'sessions', label: 'Histórico', icon: '🎾', roles: [Role.ADMIN, Role.COACH, Role.STUDENT] },
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
          <div className="flex items-center gap-3 md:hidden">
            <img 
              src="logo.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain"
            />
            <div className="leading-none">
              <h1 className="text-[10px] font-black text-petrol-950 uppercase tracking-tighter">
                TREINOS
              </h1>
              <h1 className="text-xs font-black text-padelgreen-600 uppercase tracking-tighter">
                LEVELUP
              </h1>
            </div>
          </div>
          
          <h1 className="hidden md:block text-xl font-bold text-petrol-900 uppercase tracking-tight">
            {currentView === 'dashboard' ? 'Painel de Controlo' : 
             currentView === 'users' ? 'Gestão de Utilizadores' :
             currentView === 'shifts' ? 'Agenda de Treinos' : 
             currentView === 'profile' ? 'O Meu Perfil' : 'Histórico de Sessões'}
          </h1>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('profile')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${currentView === 'profile' ? 'bg-padelgreen-50 border-padelgreen-300' : 'hover:bg-slate-50 border-transparent'}`}
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-petrol-900 leading-none">{user.name}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-tighter">Perfil</p>
              </div>
              <div className="relative">
                <img src={user.avatar} className="w-8 h-8 rounded-full object-cover ring-2 ring-padelgreen-400 shadow-sm" alt="" />
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md border border-slate-100">
                  <span className="text-[8px]">✏️</span>
                </div>
              </div>
            </button>
            <button 
              onClick={() => { if(confirm('Sair do sistema?')) onLogout(); }}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Sair"
            >
              🚪
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-30 shadow-lg">
        {visibleMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              currentView === item.id ? 'text-padelgreen-600 font-bold scale-110' : 'text-slate-400'
            }`}
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            <span className="text-[9px] uppercase font-bold tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
