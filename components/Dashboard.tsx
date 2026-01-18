
import React, { useState, useMemo } from 'react';
import { AppState, Role, ShiftRSVP, RecurrenceType } from '../types';
import { db } from '../services/db';

interface DashboardProps {
  state: AppState;
  refresh: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, refresh }) => {
  const [isUpdatingRSVP, setIsUpdatingRSVP] = useState(false);
  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;

  /**
   * AGENDA PARA ADMIN (Apenas treinos futuros não finalizados)
   */
  const adminSchedule = useMemo(() => {
    if (!isAdmin) return [];
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return state.shifts
      .filter(shift => {
        if (!shift.startDate) return false;
        const shiftDate = new Date(shift.startDate);
        shiftDate.setHours(0, 0, 0, 0);

        // Ocultar se a data já passou (e não for hoje)
        if (shiftDate < now) return false;

        // Ocultar se já existir uma sessão concluída para este treino/data
        const session = state.sessions.find(s => 
          s.shiftId === shift.id && 
          s.date.startsWith(shift.startDate!) && 
          s.completed
        );
        return !session;
      })
      .map(shift => ({
        ...shift,
        timestamp: new Date(`${shift.startDate}T${shift.startTime}`).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [state.shifts, state.sessions, isAdmin]);

  /**
   * PRÓXIMO TREINO (ALUNOS/TREINADORES)
   */
  const nextTraining = useMemo(() => {
    if (isAdmin || !userId || !state.shifts.length) return null;

    const myShifts = state.shifts.filter(shift => {
      const isMyShift = userRole === Role.COACH ? shift.coachId === userId : shift.studentIds.includes(userId);
      if (!isMyShift || !shift.startDate) return false;

      // Ocultar se concluído
      const session = state.sessions.find(s => 
        s.shiftId === shift.id && 
        s.date.startsWith(shift.startDate!) && 
        s.completed
      );
      return !session;
    });

    const now = new Date();
    const sorted = myShifts
      .map(shift => {
        const fullDate = new Date(`${shift.startDate}T${shift.startTime}`);
        return { ...shift, fullDate, weight: fullDate.getTime() };
      })
      .filter(s => s.weight >= now.getTime() - (60 * 60 * 1000)) // Mostrar até 1h após começar
      .sort((a, b) => a.weight - b.weight);

    if (!sorted.length) return null;

    const next = sorted[0];
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    let dateLabel = next.dayOfWeek;
    if (next.startDate === todayStr) dateLabel = 'Hoje';
    else if (next.startDate === tomorrowStr) dateLabel = 'Amanhã';

    return { 
      id: next.id, 
      label: dateLabel, 
      time: next.startTime, 
      date: next.startDate!,
      displayDate: new Date(next.startDate!).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })
    };
  }, [state.shifts, state.sessions, userId, userRole, isAdmin]);

  const currentRSVP = useMemo(() => {
    if (!nextTraining || !userId) return null;
    return state.rsvps.find(r => r.shiftId === nextTraining.id && r.userId === userId && r.date === nextTraining.date);
  }, [state.rsvps, nextTraining, userId]);

  const getAttendanceStats = (shiftId: string, date: string) => {
    const shift = state.shifts.find(s => s.id === shiftId);
    const total = shift?.studentIds.length || 0;
    const going = state.rsvps.filter(r => r.shiftId === shiftId && r.date === date && r.attending).length;
    return { going, total };
  };

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
      alert(`Erro: ${err.message}`);
    } finally {
      setIsUpdatingRSVP(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 border border-slate-200 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-padelgreen-400/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-petrol-900 mb-2">Olá, {state.currentUser?.name}! 👋</h2>
            <p className="text-slate-500 font-medium">{isAdmin ? 'Monitorização dos próximos treinos agendados.' : 'Consulta o teu próximo desafio em campo.'}</p>
          </div>
          <button onClick={refresh} className="self-start md:self-center text-[10px] font-black text-slate-400 hover:text-padelgreen-600 uppercase tracking-widest transition-colors flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 active:scale-95">
            🔄 Sincronizar
          </button>
        </div>
      </div>

      {isAdmin ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-petrol-900 uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-padelgreen-500 rounded-full animate-pulse"></span>
              Próximos Treinos (Pontuais)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{adminSchedule.length} Agendados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminSchedule.map((occ) => {
              const coach = state.users.find(u => u.id === occ.coachId);
              const stats = getAttendanceStats(occ.id, occ.startDate!);
              const occDate = new Date(occ.startDate!);
              const isToday = occ.startDate === new Date().toISOString().split('T')[0];

              return (
                <div key={occ.id} className={`bg-white rounded-3xl border ${isToday ? 'border-padelgreen-400 ring-4 ring-padelgreen-50' : 'border-slate-200'} p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden`}>
                  {isToday && <div className="absolute top-0 right-0 bg-padelgreen-400 text-petrol-950 text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">Hoje</div>}
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${isToday ? 'bg-padelgreen-400 border-padelgreen-500 text-petrol-950' : 'bg-slate-50 border-slate-100 text-petrol-900'}`}>
                      <span className="text-sm font-black leading-none">{occDate.getDate()}</span>
                      <span className="text-[8px] font-bold uppercase">{occDate.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{occ.dayOfWeek}</p>
                      <h4 className="text-lg font-black text-petrol-900 leading-tight">às {occ.startTime}</h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <img src={coach?.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm" alt="" />
                      <span className="text-xs font-bold text-slate-600 truncate max-w-[80px]">{coach?.name.split(' ')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-padelgreen-500 rounded-full transition-all" 
                                style={{ width: `${(stats.going / (stats.total || 1)) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-black text-petrol-900">{stats.going}/{stats.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {adminSchedule.length === 0 && (
            <div className="bg-white rounded-[32px] p-16 text-center border border-slate-200">
                <p className="text-slate-400 font-medium italic">Não existem treinos marcados para os próximos dias.</p>
            </div>
          )}
        </div>
      ) : (
        nextTraining ? (
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
                      {nextTraining.displayDate}
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
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] p-16 border border-slate-200 text-center shadow-sm">
            <div className="text-4xl mb-4 grayscale opacity-30">🎾</div>
            <h3 className="text-xl font-bold text-petrol-900">Sem treinos no horizonte</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto font-medium">Não tens nenhum treino agendado para os próximos dias. Fala com o teu instrutor!</p>
          </div>
        )
      )}
    </div>
  );
};

export default Dashboard;
