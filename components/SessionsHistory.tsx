
import React, { useState, useEffect } from 'react';
import { AppState, Role, TrainingSession, Shift, User } from '../types';
import { db } from '../services/db';

interface SessionsHistoryProps {
  state: AppState;
  refresh: () => void;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state, refresh }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [editBuffer, setEditBuffer] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);
  const [isPastModalOpen, setIsPastModalOpen] = useState(false);
  const [isSavingPast, setIsSavingPast] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [clubs, setClubs] = useState<string[]>([]);

  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;
  const isStaff = userRole === Role.ADMIN || userRole === Role.COACH;

  const coaches = state.users.filter(u => u.role === Role.COACH || u.role === Role.ADMIN);
  const activeSession = state.sessions.find(s => s.isActive);

  useEffect(() => {
    const loadClubs = async () => {
      const data = await db.clubs.getAll();
      setClubs(data);
    };
    loadClubs();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      setEditBuffer({ ...selectedSession });
    } else {
      setEditBuffer(null);
    }
  }, [selectedSession]);

  const handleStartSession = async (shiftId: string) => {
    const shift = state.shifts.find(s => s.id === shiftId);
    const newSession: TrainingSession = {
      id: Math.random().toString(36).substr(2, 9),
      shiftId,
      date: shift?.startDate ? `${shift.startDate}T${shift.startTime}` : new Date().toISOString(),
      isActive: true,
      completed: false,
      attendeeIds: [],
      hiddenForUserIds: [],
      clubName: shift?.clubName
    };
    await db.sessions.save(newSession);
    refresh();
  };

  const handleFinishSession = async (session: TrainingSession) => {
    if (!isAdmin) {
      alert('Apenas o Administrador pode finalizar treinos.');
      return;
    }
    if (!confirm('Deseja finalizar esta sessão de treino? Ele deixará de aparecer no painel de Início dos atletas.')) return;
    const updated = { ...session, isActive: false, completed: true };
    await db.sessions.save(updated);
    refresh();
  };

  const handleSaveEdit = async () => {
    if (!editBuffer) return;
    setIsSavingEdit(true);
    try {
      const cleanSession = {
        ...editBuffer,
        turmaName: editBuffer.turmaName || null,
        coachId: editBuffer.coachId || null,
        notes: editBuffer.notes || null,
        youtubeUrl: editBuffer.youtubeUrl || null,
        aiInsights: editBuffer.aiInsights || null,
        clubName: editBuffer.clubName || null
      };

      await db.sessions.save(cleanSession);
      refresh();
      setSelectedSession(null);
    } catch (err: any) {
      console.error("Erro detalhado ao guardar sessão:", err);
      alert(`Não foi possível guardar: ${err.message || 'Erro de rede.'}`);
    } finally {
      setIsSavingEdit(false);
    }
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

  const handleSavePastSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingPast(true);
    const formData = new FormData(e.currentTarget);
    
    const combinedDate = new Date(`${formData.get('date')}T${formData.get('time')}`);

    const newPastSession: TrainingSession = {
      id: `past_${Math.random().toString(36).substr(2, 9)}`,
      shiftId: 'manual_entry',
      turmaName: formData.get('turmaName') as string,
      coachId: formData.get('coachId') as string,
      date: combinedDate.toISOString(),
      isActive: false,
      completed: true,
      attendeeIds: Array.from(formData.getAll('attendeeIds')) as string[],
      notes: formData.get('notes') as string,
      youtubeUrl: formData.get('youtubeUrl') as string,
      hiddenForUserIds: [],
      clubName: formData.get('clubName') as string
    };

    try {
      await db.sessions.save(newPastSession);
      refresh();
      setIsPastModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao registar: ${err.message || 'Erro de rede.'}`);
    } finally {
      setIsSavingPast(false);
    }
  };

  const updateBufferField = (field: keyof TrainingSession, value: any) => {
    if (!editBuffer) return;
    setEditBuffer({ ...editBuffer, [field]: value });
  };

  const toggleBufferAttendee = (studentId: string, checked: boolean) => {
    if (!editBuffer) return;
    let newAttendees = [...editBuffer.attendeeIds];
    if (checked) {
      if (!newAttendees.includes(studentId)) newAttendees.push(studentId);
    } else {
      newAttendees = newAttendees.filter(id => id !== studentId);
    }
    setEditBuffer({ ...editBuffer, attendeeIds: newAttendees });
  };

  const historicalSessions = state.sessions.filter(s => {
    if (s.isActive || !s.completed) return false;
    if ((s.hiddenForUserIds || []).includes(userId || '')) return false;
    if (userRole === Role.ADMIN) return true;
    const shift = state.shifts.find(sh => sh.id === s.shiftId);
    if (userRole === Role.COACH) return (s.coachId === userId || shift?.coachId === userId);
    if (userRole === Role.STUDENT) return s.attendeeIds.includes(userId || '');
    return false;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const todayStr = new Date().toISOString().split('T')[0];
  const availableShiftsToStart = state.shifts.filter(shift => {
    const isAlreadyFinished = state.sessions.some(s => 
      s.shiftId === shift.id && s.completed
    );
    const shiftDate = shift.startDate || '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return !isAlreadyFinished && (shiftDate === todayStr || shiftDate === tomorrowStr);
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row gap-4">
        {activeSession ? (
          <div className="flex-1 bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl shadow-lg shadow-padelgreen-400/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-14 h-14 bg-padelgreen-400 rounded-2xl animate-pulse flex items-center justify-center shrink-0 shadow-lg shadow-padelgreen-500/20 text-2xl">🎾</div>
              <div>
                <h3 className="text-xl font-black text-petrol-900 leading-tight">Treino em Curso</h3>
                <p className="text-sm text-petrol-700 font-medium">Sessão aberta e a decorrer agora em <b>{activeSession.clubName || 'Local Indefinido'}</b>.</p>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => setSelectedSession(activeSession)} className="flex-1 md:flex-none px-6 py-3 bg-white text-petrol-900 border border-petrol-200 rounded-2xl font-bold transition-all active:scale-95 shadow-sm">Ver Detalhes</button>
              {isAdmin && <button onClick={() => handleFinishSession(activeSession)} className="flex-1 md:flex-none px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95">Finalizar</button>}
            </div>
          </div>
        ) : (
          userRole !== Role.STUDENT && availableShiftsToStart.length > 0 && (
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-black text-petrol-900 ml-2">Iniciar Próximos Treinos</h3>
              <div className="overflow-x-auto pb-4 -mx-1 px-1">
                <div className="flex gap-3">
                  {availableShiftsToStart.map(shift => (
                    <button 
                      key={shift.id} 
                      onClick={() => handleStartSession(shift.id)}
                      className="bg-white px-5 py-4 rounded-3xl border-2 border-slate-100 hover:border-padelgreen-400 hover:shadow-xl transition-all text-left min-w-[220px] shrink-0 group"
                    >
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-padelgreen-600 transition-colors">{shift.startDate === todayStr ? 'Hoje' : shift.dayOfWeek}</p>
                      <p className="text-lg font-black text-petrol-900 leading-tight">{shift.startTime}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-xs">📍</span>
                        <span className="text-[10px] font-black uppercase text-petrol-800 truncate">{shift.clubName || 'Local?'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
        {isAdmin && (
          <div className="md:w-64 flex items-end mb-4">
            <button 
              onClick={() => setIsPastModalOpen(true)}
              className="w-full h-14 bg-white border border-petrol-200 text-petrol-800 rounded-2xl font-black hover:bg-petrol-50 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="text-xl">📅</span> Registar Passado
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-lg font-black text-petrol-900 uppercase tracking-tight">Histórico de Sessões</h3>
          <button onClick={refresh} className="text-[10px] font-black text-slate-400 hover:text-padelgreen-500 uppercase tracking-widest transition-colors">🔄 Sincronizar</button>
        </div>
        
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          {historicalSessions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {historicalSessions.map(session => {
                const shift = state.shifts.find(s => s.id === session.shiftId);
                const sessionDate = new Date(session.date);
                const coach = state.users.find(u => u.id === (session.coachId || shift?.coachId));
                const displayTurma = session.turmaName || (shift ? `${shift.dayOfWeek} (${shift.startTime})` : 'Treino Manual');
                
                return (
                  <div 
                    key={session.id} 
                    className="group hover:bg-slate-50 transition-all cursor-pointer flex items-center p-3 md:p-4 gap-4"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="flex flex-col items-center justify-center bg-slate-100 group-hover:bg-padelgreen-100 w-11 h-11 md:w-12 md:h-12 rounded-xl shrink-0 border border-slate-200 group-hover:border-padelgreen-200 transition-colors shadow-sm">
                      <span className="text-sm md:text-base font-black text-petrol-950 leading-none">{sessionDate.getDate()}</span>
                      <span className="text-[8px] md:text-[9px] font-black text-petrol-600 uppercase tracking-tighter">{sessionDate.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px] md:max-w-none">{displayTurma}</span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-petrol-50 rounded text-[9px] font-black text-petrol-700">
                          <span>📍</span>
                          <span className="uppercase">{session.clubName || 'S/ Clube'}</span>
                        </div>
                        {session.youtubeUrl && (
                          <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-black border border-red-100">▶️ VÍDEO</span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 hidden sm:block">🕒 {sessionDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs md:text-sm font-semibold text-petrol-900 truncate">
                        {session.notes ? session.notes : <span className="text-slate-300 italic font-normal text-xs">Sem notas técnicas registadas...</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                      <div className="hidden lg:flex -space-x-1.5 items-center">
                        {session.attendeeIds.slice(0, 3).map(id => (
                          <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-6 h-6 rounded-full border border-white ring-1 ring-slate-100" alt="" />
                        ))}
                        {session.attendeeIds.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-50 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400">+{session.attendeeIds.length - 3}</div>
                        )}
                      </div>

                      <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                        <img src={coach?.avatar} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-[10px] font-bold text-slate-500">{coach?.name.split(' ')[0]}</span>
                      </div>

                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }} 
                          className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                      
                      <span className="text-slate-300 font-bold group-hover:text-padelgreen-500 transition-colors">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="text-4xl mb-4 grayscale opacity-20">🎾</div>
              <p className="text-slate-400 font-medium italic">O teu histórico de treinos aparecerá aqui assim que concluíres a primeira sessão.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registar Passado */}
      {isPastModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <h3 className="text-xl md:text-2xl font-black text-petrol-900 mb-6">Registo Retroativo</h3>
            <form onSubmit={handleSavePastSession} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Clube / Local</label>
                  <select name="clubName" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium">
                    <option value="" disabled>Selecionar Clube...</option>
                    {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Identificação</label>
                  <input name="turmaName" type="text" required placeholder="Ex: Clínica Padel, Turma X..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Coach</label>
                  <select name="coachId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium">
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Data</label>
                    <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Hora</label>
                    <input type="time" name="time" required defaultValue="18:00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Link do Vídeo (Opcional)</label>
                <input name="youtubeUrl" type="url" placeholder="https://youtube.com/..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Atletas Presentes</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {state.users.filter(u => u.role === Role.STUDENT).map(student => (
                    <label key={student.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-padelgreen-300 transition-colors">
                      <input type="checkbox" name="attendeeIds" value={student.id} className="w-4 h-4 text-padelgreen-500 rounded" />
                      <span className="text-xs font-medium truncate">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea name="notes" placeholder="Notas técnicas e observações..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm h-24 font-medium"></textarea>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsPastModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl">Cancelar</button>
                <button type="submit" disabled={isSavingPast} className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg active:scale-95">
                  {isSavingPast ? "A Guardar..." : "Confirmar Registo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes e Edição */}
      {selectedSession && editBuffer && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-black text-petrol-900">{isAdmin ? 'Gestão da Sessão' : 'Sumário do Treino'}</h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl transition-colors">×</button>
            </div>
            
            <div className="space-y-6">
              {/* Botão de Vídeo para Alunos */}
              {!isStaff && editBuffer.youtubeUrl && (
                <a 
                  href={editBuffer.youtubeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
                >
                  <span className="text-xl">▶️</span> Assistir à Gravação do Treino
                </a>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Local (Clube)</p>
                  {isAdmin ? (
                    <select 
                      value={editBuffer.clubName || ''} 
                      onChange={(e) => updateBufferField('clubName', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    >
                      <option value="">(Local Indefinido)</option>
                      {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                       <span className="text-lg">📍</span>
                       <p className="text-sm font-bold text-petrol-900 uppercase">{editBuffer.clubName || 'Local Indefinido'}</p>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Identificação</p>
                  {isAdmin ? (
                    <input 
                      type="text" 
                      value={editBuffer.turmaName || ''} 
                      placeholder="Nome da Sessão"
                      onChange={(e) => updateBufferField('turmaName', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    />
                  ) : (
                    <p className="text-sm font-bold text-petrol-900">{editBuffer.turmaName || 'Treino Pontual'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Coach</p>
                  {isAdmin ? (
                    <select 
                      value={editBuffer.coachId || ''} 
                      onChange={(e) => updateBufferField('coachId', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    >
                      <option value="">(Instrutor Associado)</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <img src={state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.avatar} className="w-5 h-5 rounded-full shadow-sm" alt="" />
                      <p className="text-sm font-bold text-petrol-900">
                        {state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.name}
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Realizado em</p>
                  <p className="text-sm font-bold text-petrol-900">
                    {new Date(editBuffer.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(editBuffer.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Link da Gravação (YouTube)</p>
                {isStaff ? (
                  <input 
                    type="url" 
                    value={editBuffer.youtubeUrl || ''} 
                    placeholder="Cole aqui o link do vídeo..."
                    onChange={(e) => updateBufferField('youtubeUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-padelgreen-400 text-red-600"
                  />
                ) : (
                  <p className="text-xs font-medium text-slate-500 break-all">
                    {editBuffer.youtubeUrl || "Nenhum vídeo disponível."}
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Atletas Presentes ({editBuffer.attendeeIds.length})</h4>
                {isAdmin ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                    {state.users.filter(u => u.role === Role.STUDENT).map(student => (
                      <label key={student.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-padelgreen-200 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={editBuffer.attendeeIds.includes(student.id)} 
                          onChange={(e) => toggleBufferAttendee(student.id, e.target.checked)}
                          className="w-4 h-4 text-padelgreen-500 rounded" 
                        />
                        <span className="text-[11px] font-bold truncate">{student.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {editBuffer.attendeeIds.map(id => {
                      const student = state.users.find(u => u.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                          <img src={student?.avatar} className="w-5 h-5 rounded-full" alt="" />
                          <span className="text-xs font-bold text-slate-700">{student?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Sumário Técnico</h4>
                {isStaff ? (
                  <textarea 
                    value={editBuffer.notes || ''} 
                    onChange={(e) => updateBufferField('notes', e.target.value)} 
                    placeholder="Registe os pontos focais da sessão, erros comuns corrigidos, etc..."
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-padelgreen-400 h-32" 
                  />
                ) : (
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed font-medium italic">
                    {editBuffer.notes ? `"${editBuffer.notes}"` : "Nenhum resumo técnico foi registado para esta sessão."}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              {isAdmin ? (
                <>
                  <button onClick={() => setSelectedSession(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Sair</button>
                  <button 
                    onClick={handleSaveEdit} 
                    disabled={isSavingEdit}
                    className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:bg-petrol-950 active:scale-95 transition-all"
                  >
                    {isSavingEdit ? '...' : 'Atualizar Dados'}
                  </button>
                </>
              ) : (
                <button onClick={() => setSelectedSession(null)} className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg hover:bg-petrol-950 active:scale-95 transition-all">Fechar Sumário</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-petrol-950/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-petrol-900 text-center mb-6">Remover do Registo?</h3>
            <div className="space-y-3">
              <button onClick={() => handleDeleteSession('me')} className="w-full py-4 bg-slate-100 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Ocultar apenas para mim</button>
              <button onClick={() => handleDeleteSession('all')} className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg hover:bg-red-600 active:scale-95 transition-all">Apagar permanentemente</button>
              <button onClick={() => setDeletingSession(null)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
