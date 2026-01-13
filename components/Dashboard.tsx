
import React, { useState, useMemo } from 'react';
import { AppState, Role, ShiftRSVP } from '../types';
import { db } from '../services/db';
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
  const getNextOccurrenceDate = (dayOfWeek: string, offsetWeeks: number = 0) => {
    const dayMap: Record<string, number> = {
      'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6
    };
    const targetDay = dayMap[dayOfWeek];
    const now = new Date();
    const currentDay = now.getDay();
    
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    daysToAdd += offsetWeeks * 7;
    
    const result = new Date(now);
    result.setDate(now.getDate() + daysToAdd);
    return result.toISOString().split('T')[0];
  };

  // Lógica para encontrar o próximo treino agendado (excluindo os já concluídos)
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

    // Calculamos a próxima ocorrência válida para cada turno
    const occurrences = myShifts.map(shift => {
      const dayIdx = dayMap[shift.dayOfWeek];
      const [h, m] = shift.startTime.split(':').map(Number);
      
      // Peso da ocorrência base (esta semana)
      let baseWeight = (dayIdx * 24 * 60) + (h * 60) + m;
      const currentWeight = (currentDayIdx * 24 * 60) + (now.getHours() * 60) + now.getMinutes();
      
      // Se a hora já passou hoje ou no passado da semana, movemos para a próxima semana
      let offsetWeeks = baseWeight <= currentWeight ? 1 : 0;
      let dateStr = getNextOccurrenceDate(shift.dayOfWeek, offsetWeeks);

      // Verificamos se já existe uma sessão CONCLUÍDA para esta data
      // Se sim, temos de saltar para a semana seguinte
      const isAlreadyCompleted = state.sessions.some(s => 
        s.shiftId === shift.id && 
        s.date.startsWith(dateStr) && 
        s.completed
      );

      if (isAlreadyCompleted) {
        offsetWeeks += 1;
        dateStr = getNextOccurrenceDate(shift.dayOfWeek, offsetWeeks);
      }

      // Peso final ajustado com as semanas de offset
      const finalWeight = baseWeight + (offsetWeeks * 7 * 24 * 60);

      return {
        id: shift.id,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        date: dateStr,
        weight: finalWeight
      };
    });

    // Ordenamos por data/hora mais próxima
    occurrences.sort((a, b) => a.weight - b.weight);
    const next = occurrences[0];

    // Verificar se é "Hoje" baseado na data calculada
    const todayStr = now.toISOString().split('T')[0];
    const isToday = next.date === todayStr;

    return {
      id: next.id,
      label: isToday ? 'Hoje' : next.dayOfWeek,
      time: next.startTime,
      date: next.date
    };
  }, [state.shifts, state.sessions, userId, userRole]);

  const currentRSVP = useMemo(() => {
    if (!nextTraining || !userId) return null;
    return state.rsvps.find(r => r.shiftId === nextTraining.id && r.userId === userId && r.date === nextTraining.date);
  }, [state.rsvps, nextTraining, userId]);

  const attendeesForNext = useMemo(() => {
    if (!nextTraining || userRole !== Role.ADMIN) return { going: [], notGoing: [] };
    const rsvps = state.rsvps.filter(r => r.shiftId === nextTraining.id && r.date === nextTraining.date);
    
    return {
      going: rsvps.filter(r => r.attending).map(r => state.users.find(u => u.id === r.userId)).filter(Boolean),
      notGoing: rsvps.filter(r => !r.attending).map(r => state.users.find(u => u.id === r.userId)).filter(Boolean)
    };
  }, [state.rsvps, nextTraining, userRole, state.users]);

  // Fix: Completed the truncated handleUpdateRSVP function and added missing UI blocks
  const handleUpdateRSVP = async (attending: boolean) => {
    if (!nextTraining || !userId || isUpdatingRSVP) return;
    
    setIsUpdatingRSVP(true);
    try {
      // Se já temos um RSVP com o mesmo estado, removemos (toggle off)
      if (currentRSVP && currentRSVP.attending === attending) {
        await db.rsvps.deleteByUserAndDate(userId, nextTraining.id, nextTraining.date);
      } else {
        // Caso contrário, guardamos o novo estado
        const newRSVP: ShiftRSVP = {
          id: `${userId}-${nextTraining.id}-${nextTraining.date}`,
          shiftId: nextTraining.id,
          userId: userId,
          date: nextTraining.date,
          attending
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 border border-slate-200 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-padelgreen-400/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-black text-petrol-900 mb-2">Olá, {state.currentUser?.name}! 👋</h2>
          <p className="text-slate-500 font-medium">Bom tê-lo de volta ao PadelPro.</p>
        </div>
      </div>

      {nextTraining ? (
        <div className="bg-petrol-900 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-white shadow-xl shadow-petrol-900/20 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-padelgreen-400/5 rounded-full -mb-32 -mr-32"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-padelgreen-400/20 rounded-full border border-padelgreen-400/30">
                  <span className="w-2 h-2 bg-padelgreen-400 rounded-full animate-pulse"></span>
                  <span className="text-padelgreen-400 text-xs font-bold uppercase tracking-widest">Próximo Treino</span>
                </div>
                <div>
                  <h3 className="text-3xl md:text-4xl font-black">{nextTraining.label}</h3>
                  <p className="text-petrol-200 text-lg md:text-xl font-medium mt-1">Às {nextTraining.time} • {new Date(nextTraining.date).toLocaleDateString('pt-PT')}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[200px]">
                <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest ml-1">Vais aparecer?</p>
                <div className="flex gap-3">
                  <button 
                    disabled={isUpdatingRSVP}
                    onClick={() => handleUpdateRSVP(true)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      currentRSVP?.attending === true 
                        ? 'bg-padelgreen-400 text-petrol-900' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isUpdatingRSVP ? '...' : 'Vou'} ✅
                  </button>
                  <button 
                    disabled={isUpdatingRSVP}
                    onClick={() => handleUpdateRSVP(false)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      currentRSVP?.attending === false 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isUpdatingRSVP ? '...' : 'Não'} ❌
                  </button>
                </div>
              </div>
            </div>
            
            {userRole === Role.ADMIN && (
              <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest mb-4">Confirmados ({attendeesForNext.going.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {attendeesForNext.going.length > 0 ? attendeesForNext.going.map(u => (
                      <div key={u?.id} className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                        <img src={u?.avatar} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-xs font-medium">{u?.name}</span>
                      </div>
                    )) : <span className="text-xs text-petrol-400 italic">Ninguém confirmou ainda.</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest mb-4">Indisponíveis ({attendeesForNext.notGoing.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {attendeesForNext.notGoing.length > 0 ? attendeesForNext.notGoing.map(u => (
                      <div key={u?.id} className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5 opacity-60">
                        <img src={u?.avatar} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-xs font-medium">{u?.name}</span>
                      </div>
                    )) : <span className="text-xs text-petrol-400 italic">Sem cancelamentos.</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] p-10 border border-slate-200 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-xl font-bold text-petrol-900">Sem treinos agendados</h3>
          <p className="text-slate-500 mt-2">Parece que não tens sessões marcadas para breve.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl mb-4">👥</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.users.length}</h4>
          <p className="text-slate-500 text-sm font-medium">Utilizadores</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-padelgreen-50 text-padelgreen-600 rounded-2xl flex items-center justify-center text-xl mb-4">📅</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.shifts.length}</h4>
          <p className="text-slate-500 text-sm font-medium">Horários Ativos</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center text-xl mb-4">🎾</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.sessions.filter(s => s.completed).length}</h4>
          <p className="text-slate-500 text-sm font-medium">Treinos Feitos</p>
        </div>
      </div>
    </div>
  );
};

// Fix: Added missing default export
export default Dashboard;
