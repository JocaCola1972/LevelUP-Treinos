
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Role, TrainingSession, Shift } from '../types';
import { getTrainingTips } from '../services/gemini';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DAYS_OF_WEEK } from '../constants';

interface DashboardProps {
  state: AppState;
  refresh: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, refresh }) => {
  const [aiTips, setAiTips] = useState<string>("A carregar dicas...");
  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;

  useEffect(() => {
    const fetchTips = async () => {
      const tips = await getTrainingTips("vólei e bandeja");
      setAiTips(tips);
    };
    fetchTips();
  }, []);

  const nextTraining = useMemo(() => {
    if (!userId || !state.shifts.length) return null;

    // Filtrar turnos relevantes para o utilizador
    const myShifts = state.shifts.filter(shift => {
      if (userRole === Role.ADMIN) return true;
      if (userRole === Role.COACH) return shift.coachId === userId;
      return shift.studentIds.includes(userId);
    });

    if (myShifts.length === 0) return null;

    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7; // Ajustar para Seg=0, Dom=6
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const dayMap: Record<string, number> = {};
    DAYS_OF_WEEK.forEach((day, idx) => { dayMap[day] = idx; });

    // Encontrar o turno mais próximo
    const sortedShifts = [...myShifts].sort((a, b) => {
      const dayA = dayMap[a.dayOfWeek];
      const dayB = dayMap[b.dayOfWeek];
      
      // Calcular "distância" em minutos desde o início da semana
      const getWeight = (dayIdx: number, time: string) => {
        const [h, m] = time.split(':').map(Number);
        let weight = (dayIdx * 24 * 60) + (h * 60) + m;
        // Se já passou hoje, conta como sendo na próxima semana
        const currentWeight = (currentDayIdx * 24 * 60) + (now.getHours() * 60) + now.getMinutes();
        if (weight <= currentWeight) {
          weight += 7 * 24 * 60;
        }
        return weight;
      };

      return getWeight(dayA, a.startTime) - getWeight(dayB, b.startTime);
    });

    const next = sortedShifts[0];
    const isToday = dayMap[next.dayOfWeek] === currentDayIdx;
    
    return {
      label: isToday ? 'Hoje' : next.dayOfWeek,
      time: next.startTime
    };
  }, [state.shifts, userId, userRole]);

  const activeSession = state.sessions.find(s => s.isActive);

  const handleStartSession = (shiftId: string) => {
    const newSession: TrainingSession = {
      id: Math.random().toString(36).substr(2, 9),
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-4">
      {/* Welcome & AI Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-petrol-800 to-petrol-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden relative min-h-[180px] md:min-h-[240px]">
          <div className="relative z-10">
            <h2 className="text-xl md:text-3xl font-bold mb-1">Olá, {state.currentUser?.name}! 👋</h2>
            <p className="text-petrol-200 text-xs md:text-base mb-4 md:mb-6">Pronto para a sessão de hoje?</p>
            <div className="flex gap-3 md:gap-4">
              <div className="bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-padelgreen-400 mb-0.5">Próximo</p>
                <p className="text-sm md:text-lg font-semibold">
                  {nextTraining ? `${nextTraining.label}, ${nextTraining.time}h` : 'Sem agendamento'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-padelgreen-400 mb-0.5">Mensal</p>
                <p className="text-sm md:text-lg font-semibold">12.5h</p>
              </div>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] opacity-20 pointer-events-none">
            <div className="w-48 h-48 md:w-64 md:h-64 bg-padelgreen-400 rounded-full blur-3xl"></div>
          </div>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span className="text-xl md:text-2xl">💡</span>
            <h3 className="text-base md:text-lg font-bold text-petrol-900">Dicas do Coach AI</h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl text-xs md:text-sm leading-relaxed text-slate-600 border border-slate-100">
            {aiTips.split('\n').filter(t => t.trim()).slice(0, 3).map((tip, i) => (
              <p key={i} className="mb-2 last:mb-0">• {tip.replace(/^[•\d.-]+\s*/, '')}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Active Session */}
      {activeSession ? (
        <div className="bg-padelgreen-50 border-2 border-padelgreen-400 p-4 md:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-padelgreen-400/10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-padelgreen-400 rounded-full animate-pulse flex items-center justify-center shrink-0">
              🎾
            </div>
            <div>
              <h3 className="text-base md:text-xl font-bold text-petrol-900 leading-tight">Treino em curso!</h3>
              <p className="text-xs md:text-sm text-petrol-700">Regista as presenças agora.</p>
            </div>
          </div>
          <button 
            className="w-full md:w-auto px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95"
          >
            Finalizar Sessão
          </button>
        </div>
      ) : (
        userRole !== Role.STUDENT && (
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex md:grid md:grid-cols-4 gap-4 min-w-[600px] md:min-w-0">
              {state.shifts.slice(0, 4).map(shift => (
                <div key={shift.id} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-padelgreen-400 transition-colors group flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{shift.dayOfWeek}</p>
                  <p className="text-base font-bold text-petrol-900 mb-3">{shift.startTime}</p>
                  <button 
                    onClick={() => handleStartSession(shift.id)}
                    className="w-full py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold group-hover:bg-padelgreen-400 group-hover:text-petrol-900 transition-all"
                  >
                    Abrir Treino
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-base md:text-lg font-bold text-petrol-900 mb-6">Afluência Semanal</h3>
          <div className="h-48 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="aulas" radius={[6, 6, 0, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#8be300' : '#4a7d95'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-base md:text-lg font-bold text-petrol-900 mb-6">Alunos em Destaque</h3>
          <div className="space-y-3">
            {state.users.filter(u => u.role === Role.STUDENT).slice(0, 4).map((student, i) => (
              <div key={student.id} className="flex items-center justify-between p-2 md:p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={student.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover" alt="" />
                  <div>
                    <p className="text-sm md:text-base font-semibold text-petrol-900 leading-tight">{student.name}</p>
                    <p className="text-[10px] md:text-xs text-slate-500">4 sessões esta semana</p>
                  </div>
                </div>
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-padelgreen-50 flex items-center justify-center text-padelgreen-600 font-bold text-[10px] md:text-xs shrink-0">
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
