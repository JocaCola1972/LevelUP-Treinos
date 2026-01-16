
import React, { useState, useMemo } from 'react';
import { AppState, Role, ShiftRSVP, RecurrenceType } from '../types';
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

  /**
   * Calcula a data da próxima ocorrência de um dia da semana.
   * Se offsetWeeks > 0, pula semanas.
   */
  const getNextOccurrenceDate = (dayOfWeek: string, offsetWeeks: number = 0) => {
    const dayMap: Record<string, number> = {
      'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6
    };
    const targetDay = dayMap[dayOfWeek];
    const now = new Date();
    const currentDay = now.getDay();
    
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    
    // Se for hoje, mas o offset for solicitado (ou o cálculo exigir), adiciona semanas
    daysToAdd += offsetWeeks * 7;
    
    const result = new Date(now);
    result.setDate(now.getDate() + daysToAdd);
    return result.toISOString().split('T')[0];
  };

  /**
   * Lógica avançada para determinar o próximo treino real.
   * Considera: Dia da semana, Hora, Recorrência e se já foi concluído hoje.
   */
  const nextTraining = useMemo(() => {
    if (!userId || !state.shifts.length) return null;

    // Filtra apenas os horários que dizem respeito ao utilizador
    const myShifts = state.shifts.filter(shift => {
      if (userRole === Role.ADMIN) return true;
      if (userRole === Role.COACH) return shift.coachId === userId;
      return shift.studentIds.includes(userId);
    });

    if (myShifts.length === 0) return null;

    const now = new Date();
    // Mapa para converter nomes de dias em índices (0-6, começando em Segunda conforme constants)
    const dayMap: Record<string, number> = {};
    DAYS_OF_WEEK.forEach((day, idx) => { dayMap[day] = idx; });
    
    // Índice de hoje (0=Segunda, ..., 6=Domingo) para bater com DAYS_OF_WEEK
    const currentDayIdx = (now.getDay() + 6) % 7; 
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();

    const occurrences = myShifts.map(shift => {
      const dayIdx = dayMap[shift.dayOfWeek];
      const [h, m] = shift.startTime.split(':').map(Number);
      const shiftMinutes = (h * 60) + m;

      // Cálculo base de semanas a saltar
      let offsetWeeks = 0;
      
      // Se o dia já passou na semana atual OU é hoje mas a hora já passou
      if (dayIdx < currentDayIdx || (dayIdx === currentDayIdx && shiftMinutes <= currentMinutes)) {
        offsetWeeks = 1;
      }

      // Se for quinzenal, precisamos verificar o ciclo, mas para simplificação 
      // e utilidade imediata, focamos na próxima data disponível
      if (shift.recurrence === RecurrenceType.QUINZENAL && offsetWeeks > 0) {
        // Logica simplificada: se já passou, a próxima é daqui a 2 semanas se for o ciclo
        // Para esta app, tratamos como "próxima disponível"
      }

      let dateStr = getNextOccurrenceDate(shift.dayOfWeek, offsetWeeks);

      // CRUCIAL: Verificar se este treino específico já foi concluído hoje no Histórico
      const isAlreadyCompleted = state.sessions.some(s => 
        s.shiftId === shift.id && 
        s.date.startsWith(dateStr) && 
        s.completed
      );

      // Se já está feito, pula para a próxima semana (ou ciclo)
      if (isAlreadyCompleted) {
        offsetWeeks += (shift.recurrence === RecurrenceType.QUINZENAL ? 2 : 1);
        dateStr = getNextOccurrenceDate(shift.dayOfWeek, offsetWeeks);
      }

      // Peso absoluto em minutos desde o início da semana atual para ordenação
      const finalWeight = (dayIdx * 24 * 60) + shiftMinutes + (offsetWeeks * 7 * 24 * 60);

      return {
        id: shift.id,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        date: dateStr,
        weight: finalWeight
      };
    });

    // Ordena por proximidade temporal
    occurrences.sort((a, b) => a.weight - b.weight);
    const next = occurrences[0];
    
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let dateLabel = next.dayOfWeek;
    if (next.date === todayStr) dateLabel = 'Hoje';
    else if (next.date === tomorrowStr) dateLabel = 'Amanhã';

    return {
      id: next.id,
      label: dateLabel,
      time: next.startTime,
      date: next.date
    };
  }, [state.shifts, state.sessions, userId, userRole]);

  const currentRSVP = useMemo(() => {
    if (!nextTraining || !userId) return null;
    return state.rsvps.find(r => r.shiftId === nextTraining.id && r.userId === userId && r.date === nextTraining.date);
  }, [state.rsvps, nextTraining, userId]);

  const attendeesForNext = useMemo(() => {
    if (!nextTraining) return { going: [], notGoing: [] };
    const rsvps = state.rsvps.filter(r => r.shiftId === nextTraining.id && r.date === nextTraining.date);
    
    return {
      going: rsvps.filter(r => r.attending).map(r => state.users.find(u => u.id === r.userId)).filter(Boolean),
      notGoing: rsvps.filter(r => !r.attending).map(r => state.users.find(u => u.id === r.userId)).filter(Boolean)
    };
  }, [state.rsvps, nextTraining, state.users]);

  const handleUpdateRSVP = async (attending: boolean) => {
    if (!nextTraining || !userId || isUpdatingRSVP) return;
    
    setIsUpdatingRSVP(true);
    try {
      if (currentRSVP && currentRSVP.attending === attending) {
        await db.rsvps.delete(currentRSVP.id);
      } else {
        const newRSVP: ShiftRSVP = {
          id: `${userId}-${nextTraining.id}-${nextTraining.date}`,
          shiftId: nextTraining.id,
          userId: userId,
          date: nextTraining.date,
          attending: attending
        };
        await db.rsvps.save(newRSVP);
      }
      refresh();
    } catch (err: any) {
      console.error("Erro ao atualizar RSVP:", err);
      alert(`Erro ao atualizar presença: ${err.message || 'Erro desconhecido'}`);
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
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-4xl md:text-5xl font-black">{nextTraining.label}</h3>
                    <span className="text-padelgreen-400 text-2xl md:text-3xl font-light">às {nextTraining.time}</span>
                  </div>
                  <p className="text-petrol-300 text-base md:text-lg font-medium mt-2 flex items-center gap-2">
                    <span className="opacity-50 text-xl">📅</span> 
                    {new Date(nextTraining.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[260px]">
                <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest ml-1 text-center md:text-left">Confirma a tua presença</p>
                <div className="flex gap-3">
                  <button 
                    disabled={isUpdatingRSVP}
                    onClick={() => handleUpdateRSVP(true)}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 border-2 shadow-lg ${
                      currentRSVP?.attending === true 
                        ? 'bg-padelgreen-400 text-petrol-950 border-padelgreen-400 shadow-padelgreen-400/20' 
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {isUpdatingRSVP ? '...' : (
                      <>VOU {currentRSVP?.attending === true && '✅'}</>
                    )}
                  </button>
                  <button 
                    disabled={isUpdatingRSVP}
                    onClick={() => handleUpdateRSVP(false)}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 border-2 shadow-lg ${
                      currentRSVP?.attending === false 
                        ? 'bg-red-500 text-white border-red-500 shadow-red-500/20' 
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {isUpdatingRSVP ? '...' : (
                      <>NÃO {currentRSVP?.attending === false && '❌'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-padelgreen-400 rounded-full"></span>
                  Confirmados ({attendeesForNext.going.length})
                </p>
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
                <p className="text-xs font-bold text-petrol-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  Indisponíveis ({attendeesForNext.notGoing.length})
                </p>
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
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] p-10 border border-slate-200 text-center shadow-sm">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-xl font-bold text-petrol-900">Sem treinos agendados</h3>
          <p className="text-slate-500 mt-2">Parece que não tens sessões marcadas para os próximos tempos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl mb-4">👥</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.users.length}</h4>
          <p className="text-slate-500 text-sm font-medium">Utilizadores</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-padelgreen-50 text-padelgreen-600 rounded-2xl flex items-center justify-center text-xl mb-4">📅</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.shifts.length}</h4>
          <p className="text-slate-500 text-sm font-medium">Horários Ativos</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center text-xl mb-4">🎾</div>
          <h4 className="text-2xl font-black text-petrol-900">{state.sessions.filter(s => s.completed).length}</h4>
          <p className="text-slate-500 text-sm font-medium">Treinos Feitos</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
