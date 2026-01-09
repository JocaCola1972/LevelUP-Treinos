
import React, { useState, useEffect } from 'react';
import { AppState, Role, TrainingSession } from '../types';
import { getTrainingTips } from '../services/gemini';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  state: AppState;
  refresh: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, refresh }) => {
  const [aiTips, setAiTips] = useState<string>("A carregar dicas do treinador AI...");
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    const fetchTips = async () => {
      const tips = await getTrainingTips("vólei e bandeja");
      setAiTips(tips);
    };
    fetchTips();
  }, []);

  const activeSession = state.sessions.find(s => s.isActive);
  const userRole = state.currentUser?.role;

  const handleStartSession = (shiftId: string) => {
    const newSession: TrainingSession = {
      id: '',
      shiftId,
      date: new Date().toISOString(),
      isActive: true,
      completed: false,
      attendeeIds: [],
    };
    db.sessions.save(newSession);
    refresh();
  };

  const chartData = [
    { name: 'Seg', aulas: 4 },
    { name: 'Ter', aulas: 7 },
    { name: 'Qua', aulas: 5 },
    { name: 'Qui', aulas: 8 },
    { name: 'Sex', aulas: 6 },
    { name: 'Sáb', aulas: 3 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome & AI Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-petrol-800 to-petrol-950 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Olá, {state.currentUser?.name}! 👋</h2>
            <p className="text-petrol-200 mb-6">Pronto para a sessão de hoje? O campo está à tua espera.</p>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-padelgreen-400 mb-1">Próximo Treino</p>
                <p className="text-lg font-semibold">Hoje, às 18:30h</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-padelgreen-400 mb-1">Total de Horas</p>
                <p className="text-lg font-semibold">12.5h este mês</p>
              </div>
            </div>
          </div>
          <div className="absolute top-[-10%] right-[-5%] opacity-10 pointer-events-none">
            <div className="w-64 h-64 bg-padelgreen-400 rounded-full blur-3xl"></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💡</span>
            <h3 className="text-lg font-bold text-petrol-900">Dicas do Coach AI</h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl text-sm leading-relaxed text-slate-600 border border-slate-100">
            {aiTips.split('\n').map((tip, i) => (
              <p key={i} className="mb-2 last:mb-0">• {tip}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Active Session / Controls */}
      {activeSession ? (
        <div className="bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-padelgreen-400/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-padelgreen-400 rounded-full animate-pulse flex items-center justify-center">
              🎾
            </div>
            <div>
              <h3 className="text-xl font-bold text-petrol-900">Treino em curso!</h3>
              <p className="text-sm text-petrol-700">A decorrer agora. Marca as presenças.</p>
            </div>
          </div>
          <button 
            onClick={() => {/* Finalize Modal Logic */}}
            className="px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg"
          >
            Finalizar Sessão
          </button>
        </div>
      ) : (
        userRole !== Role.STUDENT && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {state.shifts.slice(0, 4).map(shift => (
              <div key={shift.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-padelgreen-400 transition-colors group">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">{shift.dayOfWeek}</p>
                <p className="text-lg font-bold text-petrol-900 mb-4">{shift.startTime}</p>
                <button 
                  onClick={() => handleStartSession(shift.id)}
                  className="w-full py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold group-hover:bg-padelgreen-400 group-hover:text-petrol-900 transition-all"
                >
                  Abrir Treino
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-petrol-900 mb-6">Afluência Semanal</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="aulas" radius={[8, 8, 0, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#8be300' : '#4a7d95'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-petrol-900 mb-6">Alunos em Destaque</h3>
          <div className="space-y-4">
            {state.users.filter(u => u.role === Role.STUDENT).slice(0, 4).map((student, i) => (
              <div key={student.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={student.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                  <div>
                    <p className="font-semibold text-petrol-900">{student.name}</p>
                    <p className="text-xs text-slate-500">4 sessões esta semana</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-padelgreen-50 flex items-center justify-center text-padelgreen-600 font-bold text-xs">
                  #{i+1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
