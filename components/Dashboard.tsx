
import React, { useState, useMemo } from 'react';
import { AppState, Role, ShiftRSVP } from '../types';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DAYS_OF_WEEK } from '../constants';

interface DashboardProps {
  state: AppState;
  refresh: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, refresh }) => {
  const [isUpdatingRSVP, setIsUpdatingRSVP] = useState(false);
  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;

  // Lógica para calcular a data da próxima ocorrência de um dia da semana
  const getNextOccurrenceDate = (dayOfWeek: string) => {
    const dayMap: Record<string, number> = {
      'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6
    };
    const targetDay = dayMap[dayOfWeek];
    const now = new Date();
    const currentDay = now.getDay();
    
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    const result = new Date(now);
    result.setDate(now.getDate() + daysToAdd);
    return result.toISOString().split('T')[0];
  };

  // Lógica para encontrar o próximo treino agendado
  const nextTraining = useMemo(() => {
    if (!userId || !state.shifts.length) return null;

    const myShifts = state.shifts.filter(shift => {
      if (userRole === Role.ADMIN) return true;
      if (userRole === Role.COACH) return shift.coachId === userId;
      return shift.studentIds.includes(userId);
    });

    if (myShifts.length === 0) return null;

    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7; 

    const dayMap: Record<string, number> = {};
    DAYS_OF_WEEK.forEach((day, idx) => { dayMap[day] = idx; });

    const sortedShifts = [...myShifts].sort((a, b) => {
      const dayA = dayMap[a.dayOfWeek];
      const dayB = dayMap[b.dayOfWeek];
      
      const getWeight = (dayIdx: number, time: string) => {
        const [h, m] = time.split(':').map(Number);
        let weight = (dayIdx * 24 * 60) + (h * 60) + m;
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
    const instanceDate = getNextOccurrenceDate(next.dayOfWeek);
    
    return {
      id: next.id,
      label: isToday ? 'Hoje' : next.dayOfWeek,
      time: next.startTime,
      date: instanceDate
    };
  }, [state.shifts, userId, userRole]);

  const hasConfirmed = useMemo(() => {
    if (!nextTraining || !userId) return false;
    return state.rsvps.some(r => r.shiftId === nextTraining.id && r.userId === userId && r.date === nextTraining.date);
  }, [state.rsvps, nextTraining, userId]);

  const attendeesForNext = useMemo(() => {
    if (!nextTraining || userRole !== Role.ADMIN) return [];
    return state.rsvps
      .filter(r => r.shiftId === nextTraining.id && r.date === nextTraining.date)
      .map(r => state.users.find(u => u.id === r.userId))
      .filter(Boolean);
  }, [state.rsvps, nextTraining, userRole, state.users]);

  const handleToggleRSVP = async () => {
    if (!nextTraining || !userId || isUpdatingRSVP) return;
    
    setIsUpdatingRSVP(true);
    try {
      if (hasConfirmed) {
        await db.rsvps.deleteByUserAndDate(userId, nextTraining.id, nextTraining.date);
      } else {
        const newRSVP: ShiftRSVP = {
          id: `${userId}-${nextTraining.id}-${nextTraining.date}`,
          shiftId: nextTraining.id,
          userId: userId,
          date: nextTraining.date
        };
        await db.rsvps.save(newRSVP);
      }
      refresh();
    } catch (err) {
      console.error("Erro ao atualizar RSVP:", err);
    } finally {
      setIsUpdatingRSVP(false);
    }
  };

  const trainingStats = useMemo(() => {
    if (!userId || !state.shifts.length) return { recurrence: 'Plano', totalHours: '0' };

    const myShifts = state.shifts.filter(shift => {
      if (userRole === Role.ADMIN) return true;
      if (userRole === Role.COACH) return shift.coachId === userId;
      return shift.studentIds.includes(userId);
    });

    if (myShifts.length === 0) return { recurrence: 'Plano', totalHours: '0' };

    const totalMinutesPerWeek = myShifts.reduce((acc, s) => acc + s.durationMinutes, 0);
    const mainRecurrence = myShifts[0].recurrence;

    return {
      recurrence: mainRecurrence,
      totalHours: (totalMinutesPerWeek / 60).toFixed(1)
    };
  }, [state.shifts, userId, userRole]);

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
      {/* Welcome & Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-petrol-800 to-petrol-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden relative min-h-[180px] md:min-h-[220px]">
          <div className="relative z-10">
            <h2 className="text-xl md:text-3xl font-bold mb-1">Olá, {state.currentUser?.name}! 👋</h2>
            <p className="text-petrol-200 text-xs md:text-base mb-4 md:mb-6">Pronto para a sessão de hoje?</p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              {/* Card Próximo Treino */}
              <div className={`backdrop-blur-md p-3 md:p-4 rounded-2xl border transition-all flex-1 ${hasConfirmed ? 'bg-padelgreen-500/20 border-padelgreen-400/30 shadow-lg shadow-padelgreen-400/10' : 'bg-white/10 border-white/10'}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${hasConfirmed ? 'text-padelgreen-300' : 'text-padelgreen-400'}`}>Próximo Treino</p>
                  {hasConfirmed && <span className="text-padelgreen-400 text-xs animate-bounce">✅</span>}
                </div>
                <p className="text-sm md:text-lg font-semibold truncate mb-3">
                  {nextTraining ? `${nextTraining.label}, ${nextTraining.time}h` : 'Sem agenda'}
                </p>
                
                {nextTraining && userRole !== Role.ADMIN && (
                  <button 
                    onClick={handleToggleRSVP}
                    disabled={isUpdatingRSVP}
                    className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      hasConfirmed 
                        ? 'bg-padelgreen-400 text-petrol-950 hover:bg-padelgreen-300' 
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    }`}
                  >
                    {isUpdatingRSVP ? '...' : hasConfirmed ? 'Vou Estar Presente' : 'Confirmar Presença'}
                  </button>
                )}

                {userRole === Role.ADMIN && attendeesForNext.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[9px] text-petrol-300 uppercase font-bold mb-2">Confirmados ({attendeesForNext.length})</p>
                    <div className="flex -space-x-2 overflow-hidden">
                      {attendeesForNext.slice(0, 5).map((att: any) => (
                        <img 
                          key={att.id} 
                          src={att.avatar} 
                          title={att.name} 
                          className="w-6 h-6 rounded-full border border-petrol-900 object-cover" 
                          alt="" 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-padelgreen-400 mb-0.5">
                  {trainingStats.recurrence}
                </p>
                <p className="text-sm md:text-lg font-semibold">{trainingStats.totalHours}h por semana</p>
              </div>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] opacity-20 pointer-events-none">
            <div className="w-48 h-48 md:w-64 md:h-64 bg-padelgreen-400 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-6 md:gap-8">
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
      </div>
    </div>
  );
};

export default Dashboard;
