
import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, AppState } from './types';
import { db } from './services/db';
import { isSupabaseConfigured } from './services/supabase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UsersList from './components/UsersList';
import ShiftsList from './components/ShiftsList';
import SessionsHistory from './components/SessionsHistory';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentUser: null,
    users: [],
    shifts: [],
    sessions: [],
    rsvps: [],
    isOffline: false,
  });
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'shifts' | 'sessions'>('dashboard');

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setInitError(null);
      setLoading(true);
      const [users, shifts, sessions, rsvps] = await Promise.all([
        db.users.getAll(),
        db.shifts.getAll(),
        db.sessions.getAll(),
        db.rsvps.getAll()
      ]);
      setAppState(prev => ({
        ...prev,
        users,
        shifts,
        sessions,
        rsvps,
      }));
    } catch (err: any) {
      console.error("Erro detectado na base de dados:", err);
      
      let msg = "Erro desconhecido";
      
      if (err) {
        if (typeof err === 'string') {
          msg = err;
        } else if (typeof err === 'object') {
          const parts = [];
          if (err.message) parts.push(err.message);
          if (err.details) parts.push(`Detalhes: ${err.details}`);
          if (err.hint) parts.push(`Sugestão: ${err.hint}`);
          if (err.code) parts.push(`Código: ${err.code}`);
          
          if (parts.length > 0) {
            msg = parts.join(' | ');
          } else {
            try {
              const stringified = JSON.stringify(err);
              msg = stringified === '{}' ? String(err) : stringified;
            } catch {
              msg = String(err);
            }
          }
        }
      }
      
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('relation') || lowerMsg.includes('42p01') || lowerMsg.includes('column') || lowerMsg.includes('not found') || lowerMsg.includes('does not exist')) {
        setInitError("Estrutura da base de dados desatualizada. É necessário executar o SQL de reparação no Supabase.");
      } else {
        setInitError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('logged_user');
    if (savedUser) {
      setAppState(prev => ({ ...prev, currentUser: JSON.parse(savedUser) }));
    }
    refreshData();
  }, [refreshData]);

  const handleLogin = (user: User) => {
    localStorage.setItem('logged_user', JSON.stringify(user));
    setAppState(prev => ({ ...prev, currentUser: user }));
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setAppState(prev => ({ ...prev, currentUser: null }));
  };

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center">
        <div className="max-w-2xl w-full bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 text-3xl md:text-4xl mb-6 mx-auto">
            ❌
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Reparação Necessária</h2>
          <p className="text-red-500 font-medium mb-6 text-xs md:text-sm break-words px-2">{initError}</p>
          
          <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 text-left text-xs md:text-sm mb-6">
            <p className="font-bold text-slate-700 mb-4">Copia e executa este SQL no "SQL Editor" do Supabase para corrigir a base de dados:</p>
            <pre className="bg-slate-900 text-padelgreen-400 p-4 rounded-xl text-[9px] md:text-[10px] overflow-x-auto leading-relaxed font-mono select-all whitespace-pre-wrap">
{`-- 1. Garantir tabela de utilizadores
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  phone TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '123',
  active BOOLEAN DEFAULT true
);

-- 2. Garantir tabela de horários
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  "dayOfWeek" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "studentIds" TEXT[] DEFAULT '{}',
  "coachId" TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  "startDate" TEXT
);

-- 3. Garantir tabela de sessões/treinos com novas colunas
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  date TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  "attendeeIds" TEXT[] DEFAULT '{}',
  "youtubeUrl" TEXT,
  notes TEXT,
  "aiInsights" TEXT,
  "hiddenForUserIds" TEXT[] DEFAULT '{}',
  "turmaName" TEXT,
  "coachId" TEXT
);

-- Adicionar colunas se não existirem (para quem já tem a tabela)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='turmaName') THEN
        ALTER TABLE sessions ADD COLUMN "turmaName" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='coachId') THEN
        ALTER TABLE sessions ADD COLUMN "coachId" TEXT;
    END IF;
END $$;

-- 4. Garantir tabela de presenças (RSVPs)
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  date TEXT NOT NULL,
  "attending" BOOLEAN DEFAULT true,
  UNIQUE("userId", "shiftId", date)
);`}
            </pre>
          </div>
          
          <button 
            onClick={refreshData}
            className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            🔄 Já executei o SQL, tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-[40px] p-10 shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-600 text-4xl mb-6 mx-auto">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuração Necessária</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Define as variáveis <code className="bg-slate-100 px-2 py-1 rounded text-pink-600 font-mono text-sm">SUPABASE_URL</code> e <code className="bg-slate-100 px-2 py-1 rounded text-pink-600 font-mono text-sm">SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!appState.currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (loading) return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-padelgreen-400 border-t-transparent rounded-full"></div>
      </div>
    );

    switch (currentView) {
      case 'dashboard': return <Dashboard state={appState} refresh={refreshData} />;
      case 'users': return <UsersList state={appState} refresh={refreshData} />;
      case 'shifts': return <ShiftsList state={appState} refresh={refreshData} />;
      case 'sessions': return <SessionsHistory state={appState} refresh={refreshData} />;
      default: return <Dashboard state={appState} refresh={refreshData} />;
    }
  };

  return (
    <Layout 
      user={appState.currentUser} 
      onLogout={handleLogout} 
      currentView={currentView}
      onNavigate={setCurrentView}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
