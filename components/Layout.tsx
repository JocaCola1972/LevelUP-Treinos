
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
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        user={user} 
        currentView={currentView} 
        onNavigate={onNavigate} 
        onLogout={onLogout}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0">
          <h1 className="text-xl font-bold text-petrol-900 capitalize">
            {currentView === 'dashboard' ? 'Painel de Controlo' : 
             currentView === 'users' ? 'Gestão de Utilizadores' :
             currentView === 'shifts' ? 'Horários de Treino' : 'Histórico de Sessões'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Online
            </span>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-none">{user.name}</p>
                <p className="text-xs text-slate-500 mt-1">{user.role}</p>
              </div>
              <img src={user.avatar} className="w-9 h-9 rounded-full object-cover ring-2 ring-padelgreen-400" alt="" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
