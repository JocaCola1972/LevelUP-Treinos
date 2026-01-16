
import React, { useState } from 'react';
import { AppState, Role, TrainingSession } from '../types';
import { db } from '../services/db';

interface SessionsHistoryProps {
  state: AppState;
  refresh: () => void;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state, refresh }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);

  const activeSession = state.sessions.find(s => s.isActive);
  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;
  const isStaff = userRole === Role.ADMIN || userRole === Role.COACH;

  const handleStartSession = async (shiftId: string) => {
    const newSession: TrainingSession = {
      id: Math.random().toString(36).substr(2, 9),
      shiftId,
      date: new Date().toISOString(),
      isActive: true,
      completed: false,
      attendeeIds: [],
      hiddenForUserIds: []
    };
    await db.sessions.save(newSession);
    refresh();
  };

  const handleFinishSession = async (session: TrainingSession) => {
    if (!isAdmin) {
      alert('Apenas o Administrador pode finalizar treinos.');
      return;
    }
    if (!confirm('Deseja finalizar esta sessão de treino? Todos os utilizadores verão este treino como concluído.')) return;
    const updated = { ...session, isActive: false, completed: true };
    await db.sessions.save(updated);
    refresh();
  };

  const handleDeleteSession = async (mode: 'me' | 'all') => {
    if (!deletingSession || !userId) return;

    if (mode === 'all') {
      if (confirm('TEM A CERTEZA? Esta ação apagará permanentemente o treino para TODOS os utilizadores.')) {
        await db.sessions.delete(deletingSession.id);
      }
    } else {
      const currentHidden = deletingSession.hiddenForUserIds || [];
      const updatedHidden = Array.from(new Set([...currentHidden, userId]));
      const updated = { ...deletingSession, hiddenForUserIds: updatedHidden };
      await db.sessions.save(updated);
    }
    
    setDeletingSession(null);
    refresh();
  };

  // Filtra as sessões históricas com base na participação real do utilizador
  const historicalSessions = state.sessions.filter(s => {
    // 1. Apenas sessões concluídas
    if (s.isActive || !s.completed) return false;
    
    // 2. Respeitar se o utilizador escondeu a sessão
    if ((s.hiddenForUserIds || []).includes(userId || '')) return false;

    // 3. Administradores vêem tudo para gestão
    if (userRole === Role.ADMIN) return true;

    const shift = state.shifts.find(sh => sh.id === s.shiftId);
    
    // 4. Coaches vêem sessões que deram (coachId) ou onde foram alunos (raro mas possível)
    if (userRole === Role.COACH) {
      return shift?.coachId === userId || s.attendeeIds.includes(userId || '');
    }

    // 5. Alunos vêem apenas sessões onde estiveram presentes
    if (userRole === Role.STUDENT) {
      return s.attendeeIds.includes(userId || '');
    }

    return false;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Identifica quais os slots que podem ser abertos (exclui os já finalizados hoje)
  const todayStr = new Date().toISOString().split('T')[0];
  const availableShiftsToStart = state.shifts.filter(shift => {
    const isAlreadyFinishedToday = state.sessions.some(s => 
      s.shiftId === shift.id && 
      s.date.startsWith(todayStr) && 
      s.completed
    );
    return !isAlreadyFinishedToday;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Active Session Section */}
      {activeSession ? (
        <div className="bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl shadow-lg shadow-padelgreen-400/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 bg-padelgreen-400 rounded-2xl animate-pulse flex items-center justify-center shrink-0 shadow-lg shadow-padelgreen-500/20 text-3xl">
              🎾
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900 leading-tight">Treino em Curso</h3>
              <p className="text-sm text-petrol-700">A sessão está ativa. {isAdmin ? 'Pode finalizar quando terminar.' : 'A aguardar finalização pelo Administrador.'}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setSelectedSession(activeSession)}
              className="flex-1 md:flex-none px-6 py-3 bg-white text-petrol-900 border border-petrol-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95"
            >
              Ver Detalhes
            </button>
            {isAdmin && (
              <button 
                onClick={() => handleFinishSession(activeSession)}
                className="flex-1 md:flex-none px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95"
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      ) : (
        userRole !== Role.STUDENT && availableShiftsToStart.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-petrol-900 ml-2">Abrir Novo Treino</h3>
            <div className="overflow-x-auto pb-4 -mx-1 px-1">
              <div className="flex md:grid md:grid-cols-4 gap-4 min-w-[600px] md:min-w-0">
                {availableShiftsToStart.slice(0, 4).map(shift => (
                  <div key={shift.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-padelgreen-400 transition-all group flex-1 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{shift.dayOfWeek}</p>
                    <p className="text-lg font-bold text-petrol-900 mb-4">{shift.startTime}</p>
                    <button 
                      onClick={() => handleStartSession(shift.id)}
                      className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold group-hover:bg-padelgreen-400 group-hover:text-petrol-900 transition-all"
                    >
                      Iniciar Agora
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* History Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-lg font-bold text-petrol-900">Histórico de Treinos</h3>
          <button onClick={refresh} className="text-[10px] font-bold text-slate-400 hover:text-petrol-500 uppercase tracking-widest">
            🔄 Atualizar
          </button>
        </div>
        
        {historicalSessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {historicalSessions.map(session => {
              const shift = state.shifts.find(s => s.id === session.shiftId);
              const sessionDate = new Date(session.date);
              
              return (
                <div 
                  key={session.id} 
                  className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 relative hover:border-padelgreen-400 hover:shadow-lg transition-all group/card flex flex-col"
                >
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }}
                      className="absolute top-4 right-4 p-2 bg-red-50 text-red-400 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 z-10"
                    >
                      🗑️
                    </button>
                  )}
                  
                  <div 
                    onClick={() => setSelectedSession(session)}
                    className="cursor-pointer flex-1 flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4 pr-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          {sessionDate.toLocaleDateString('pt-PT', { weekday: 'long' })}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-petrol-950 leading-none">
                            {sessionDate.getDate()}
                          </span>
                          <span className="text-sm font-bold text-petrol-700 capitalize">
                            de {sessionDate.toLocaleDateString('pt-PT', { month: 'long' })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                        CONCLUÍDO
                      </span>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                        <span className="text-lg">🕒</span> Horário: {shift?.startTime}
                      </h3>
                    </div>

                    <p className="text-xs md:text-sm text-slate-400 line-clamp-2 mb-6 italic leading-relaxed">
                      {session.notes ? `"${session.notes}"` : "Sem observações registadas para este treino."}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                      <div className="flex -space-x-2">
                        {session.attendeeIds.length > 0 ? (
                          session.attendeeIds.slice(0, 4).map(id => (
                            <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white bg-slate-100" alt="" />
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">Sem presenças</span>
                        )}
                        {session.attendeeIds.length > 4 && (
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            +{session.attendeeIds.length - 4}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {session.youtubeUrl && <span className="text-red-500 text-lg" title="Tem vídeo">▶️</span>}
                        <span className="text-slate-300 text-sm">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
            <p className="text-slate-400 font-medium">Não foram encontradas sessões no seu histórico.</p>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">
                {selectedSession.isActive ? 'Gestão de Treino' : 'Detalhes do Treino'}
              </h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl">×</button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Data do Treino</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{new Date(selectedSession.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Presenças</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{selectedSession.attendeeIds.length} Alunos</p>
                </div>
              </div>

              {/* Seção de Notas */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Notas do Treinador</h4>
                {isStaff ? (
                  <textarea 
                    placeholder="Registe as observações técnicas aqui..."
                    defaultValue={selectedSession.notes}
                    onBlur={async (e) => {
                      const updated = { ...selectedSession, notes: e.target.value };
                      await db.sessions.save(updated);
                      refresh();
                    }}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 text-sm focus:ring-2 focus:ring-padelgreen-400 outline-none h-32 transition-all"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm md:text-base min-h-24 leading-relaxed">
                    {selectedSession.notes || "Sem notas disponíveis para este treino."}
                  </div>
                )}
              </div>

              {/* Seção de Vídeo (YouTube) */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Vídeo da Sessão (YouTube)</h4>
                {isStaff ? (
                  <div className="space-y-3">
                    <input 
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      defaultValue={selectedSession.youtubeUrl}
                      onBlur={async (e) => {
                        const updated = { ...selectedSession, youtubeUrl: e.target.value };
                        await db.sessions.save(updated);
                        refresh();
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm transition-all"
                    />
                    {selectedSession.youtubeUrl && (
                      <a 
                        href={selectedSession.youtubeUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 ml-1"
                      >
                        <span>▶️</span> Testar Link do Vídeo
                      </a>
                    )}
                  </div>
                ) : (
                  selectedSession.youtubeUrl ? (
                    <a 
                      href={selectedSession.youtubeUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center justify-center md:justify-start gap-3 p-4 bg-red-50 text-red-700 rounded-2xl font-bold border border-red-100 hover:bg-red-100 transition-all active:scale-[0.98]"
                    >
                      <span className="text-xl">📺</span> Ver Gravação do Treino no YouTube
                    </a>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-sm italic">
                      Nenhum vídeo disponível para esta sessão.
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setSelectedSession(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
              >
                Fechar
              </button>
              {selectedSession.isActive && isAdmin && (
                <button 
                  onClick={() => { handleFinishSession(selectedSession); setSelectedSession(null); }}
                  className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg active:scale-[0.98]"
                >
                  Finalizar Treino
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Apagar */}
      {deletingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-petrol-950/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-petrol-900 text-center mb-6">Remover Histórico</h3>
            <div className="space-y-3">
              <button 
                onClick={() => handleDeleteSession('me')}
                className="w-full py-4 bg-slate-100 text-petrol-900 font-bold rounded-2xl"
              >
                Esconder de mim
              </button>
              <button 
                onClick={() => handleDeleteSession('all')}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl"
              >
                Apagar para todos
              </button>
              <button 
                onClick={() => setDeletingSession(null)}
                className="w-full py-4 text-slate-400 font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
