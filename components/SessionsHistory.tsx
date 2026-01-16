
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

  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;
  const isStaff = userRole === Role.ADMIN || userRole === Role.COACH;

  const coaches = state.users.filter(u => u.role === Role.COACH || u.role === Role.ADMIN);
  const activeSession = state.sessions.find(s => s.isActive);

  useEffect(() => {
    if (selectedSession) {
      setEditBuffer({ ...selectedSession });
    } else {
      setEditBuffer(null);
    }
  }, [selectedSession]);

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
        aiInsights: editBuffer.aiInsights || null
      };

      await db.sessions.save(cleanSession);
      refresh();
      setSelectedSession(null);
    } catch (err: any) {
      console.error("Erro detalhado ao guardar sessão:", err);
      const errorDetail = err?.message || err?.details || "Erro de ligação ou permissões na base de dados.";
      alert(`Não foi possível guardar: ${errorDetail}`);
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
      hiddenForUserIds: []
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

  const updateBufferDateTime = (type: 'date' | 'time', value: string) => {
    if (!editBuffer) return;
    const current = new Date(editBuffer.date);
    let datePart = isNaN(current.getTime()) ? new Date().toISOString().split('T')[0] : current.toISOString().split('T')[0];
    let timePart = isNaN(current.getTime()) ? "18:00" : current.toTimeString().split(' ')[0].slice(0, 5);
    if (type === 'date') datePart = value;
    if (type === 'time') timePart = value;
    const combined = new Date(`${datePart}T${timePart}`);
    setEditBuffer({ ...editBuffer, date: combined.toISOString() });
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
    const isAlreadyFinishedToday = state.sessions.some(s => 
      s.shiftId === shift.id && s.date.startsWith(todayStr) && s.completed
    );
    return !isAlreadyFinishedToday;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Quick Actions / Active Session */}
      <div className="flex flex-col md:flex-row gap-4">
        {activeSession ? (
          <div className="flex-1 bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl shadow-lg shadow-padelgreen-400/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-14 h-14 bg-padelgreen-400 rounded-2xl animate-pulse flex items-center justify-center shrink-0 shadow-lg shadow-padelgreen-500/20 text-2xl">🎾</div>
              <div>
                <h3 className="text-xl font-bold text-petrol-900 leading-tight">Treino em Curso</h3>
                <p className="text-sm text-petrol-700">A sessão está ativa e a decorrer.</p>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => setSelectedSession(activeSession)} className="flex-1 md:flex-none px-6 py-3 bg-white text-petrol-900 border border-petrol-200 rounded-2xl font-bold transition-all active:scale-95">Ver Detalhes</button>
              {isAdmin && <button onClick={() => handleFinishSession(activeSession)} className="flex-1 md:flex-none px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95">Finalizar</button>}
            </div>
          </div>
        ) : (
          userRole !== Role.STUDENT && availableShiftsToStart.length > 0 && (
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-bold text-petrol-900 ml-2">Abrir Novo Treino</h3>
              <div className="overflow-x-auto pb-4 -mx-1 px-1">
                <div className="flex gap-3">
                  {availableShiftsToStart.slice(0, 5).map(shift => (
                    <button 
                      key={shift.id} 
                      onClick={() => handleStartSession(shift.id)}
                      className="bg-white px-5 py-4 rounded-2xl border border-slate-200 hover:border-padelgreen-400 hover:shadow-md transition-all text-left min-w-[180px] shrink-0 group"
                    >
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-padelgreen-600 transition-colors">{shift.dayOfWeek}</p>
                      <p className="text-lg font-black text-petrol-900">{shift.startTime}</p>
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
              className="w-full h-14 bg-white border border-petrol-200 text-petrol-800 rounded-2xl font-bold hover:bg-petrol-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span className="text-xl">📅</span> Registar Passado
            </button>
          </div>
        )}
      </div>

      {/* COMPACT HISTORY LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-lg font-bold text-petrol-900">Histórico Completo</h3>
          <button onClick={refresh} className="text-[10px] font-bold text-slate-400 hover:text-petrol-500 uppercase tracking-widest transition-colors">🔄 Sincronizar</button>
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
                    {/* Date Block */}
                    <div className="flex flex-col items-center justify-center bg-slate-100 group-hover:bg-padelgreen-100 w-11 h-11 md:w-12 md:h-12 rounded-xl shrink-0 border border-slate-200 group-hover:border-padelgreen-200 transition-colors">
                      <span className="text-sm md:text-base font-black text-petrol-950 leading-none">{sessionDate.getDate()}</span>
                      <span className="text-[8px] md:text-[9px] font-bold text-petrol-600 uppercase tracking-tighter">{sessionDate.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px] md:max-w-none">{displayTurma}</span>
                        <span className="text-[10px] text-slate-300 hidden sm:block">•</span>
                        <span className="text-[10px] font-bold text-slate-500 hidden sm:block">🕒 {sessionDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs md:text-sm font-semibold text-petrol-900 truncate">
                        {session.notes ? session.notes : <span className="text-slate-300 italic font-normal text-xs">Sem notas técnicas...</span>}
                      </p>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                      {/* Avatars (Desktop Only) */}
                      <div className="hidden lg:flex -space-x-1.5 items-center">
                        {session.attendeeIds.slice(0, 3).map(id => (
                          <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-6 h-6 rounded-full border border-white ring-1 ring-slate-100" alt="" />
                        ))}
                        {session.attendeeIds.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-50 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400">+{session.attendeeIds.length - 3}</div>
                        )}
                      </div>

                      {/* Coach Avatar */}
                      <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                        <img src={coach?.avatar} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-[10px] font-bold text-slate-500">{coach?.name.split(' ')[0]}</span>
                      </div>

                      {/* Youtube Indicator */}
                      {session.youtubeUrl && (
                        <div className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg" title="Vídeo Disponível">
                          <span className="text-xs">▶️</span>
                        </div>
                      )}

                      {/* Delete (Admin only) */}
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }} 
                          className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                      
                      {/* Arrow */}
                      <span className="text-slate-300 font-bold group-hover:text-padelgreen-500 transition-colors">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="text-4xl mb-4 opacity-20">🎾</div>
              <p className="text-slate-400 font-medium">Ainda não existem treinos registados no histórico.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registar Passado */}
      {isPastModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <h3 className="text-xl md:text-2xl font-bold text-petrol-900 mb-6">Registar Treino Retroativo</h3>
            <form onSubmit={handleSavePastSession} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Nome da Turma</label>
                  <input name="turmaName" type="text" required placeholder="Ex: Turma Manhã, Clínica..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Treinador</label>
                  <select name="coachId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm">
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Data</label>
                  <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Hora</label>
                  <input type="time" name="time" required defaultValue="18:00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Alunos Presentes</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {state.users.filter(u => u.role === Role.STUDENT).map(student => (
                    <label key={student.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer">
                      <input type="checkbox" name="attendeeIds" value={student.id} className="w-4 h-4 text-padelgreen-500 rounded" />
                      <span className="text-xs truncate">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea name="notes" placeholder="Notas técnicas..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm h-24"></textarea>
              <input type="url" name="youtubeUrl" placeholder="Link YouTube (Opcional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsPastModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl">Cancelar</button>
                <button type="submit" disabled={isSavingPast} className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg">
                  {isSavingPast ? "A Guardar..." : "Registar Treino"}
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
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">{isAdmin ? 'Editar Treino' : 'Detalhes do Treino'}</h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl">×</button>
            </div>
            
            <div className="space-y-6">
              {/* Turma e Treinador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Turma / Identificação</p>
                  {isAdmin ? (
                    <input 
                      type="text" 
                      value={editBuffer.turmaName || ''} 
                      placeholder="Nome da Turma"
                      onChange={(e) => updateBufferField('turmaName', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    />
                  ) : (
                    <p className="text-sm font-semibold">{editBuffer.turmaName || 'Treino Regular'}</p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Treinador Responsável</p>
                  {isAdmin ? (
                    <select 
                      value={editBuffer.coachId || ''} 
                      onChange={(e) => updateBufferField('coachId', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    >
                      <option value="">(Usar Treinador da Agenda)</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <img src={state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.avatar} className="w-5 h-5 rounded-full" alt="" />
                      <p className="text-sm font-semibold">
                        {state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Data e Hora */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Data e Hora do Treino</p>
                {isAdmin ? (
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      value={new Date(editBuffer.date).toISOString().split('T')[0]} 
                      onChange={(e) => updateBufferDateTime('date', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    />
                    <input 
                      type="time" 
                      value={new Date(editBuffer.date).toTimeString().split(' ')[0].slice(0, 5)} 
                      onChange={(e) => updateBufferDateTime('time', e.target.value)}
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-semibold">
                    {new Date(editBuffer.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(editBuffer.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              {/* Alunos Presentes */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Alunos Presentes ({editBuffer.attendeeIds.length})</h4>
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
                        <span className="text-[11px] font-medium truncate">{student.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {editBuffer.attendeeIds.map(id => {
                      const student = state.users.find(u => u.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <img src={student?.avatar} className="w-5 h-5 rounded-full" alt="" />
                          <span className="text-xs font-semibold text-slate-700">{student?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Notas Técnicas */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Notas Técnicas</h4>
                {isStaff ? (
                  <textarea 
                    value={editBuffer.notes || ''} 
                    onChange={(e) => updateBufferField('notes', e.target.value)} 
                    placeholder="Registe o foco técnico da sessão..."
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-padelgreen-400 h-32" 
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed italic">
                    {editBuffer.notes ? `"${editBuffer.notes}"` : "Sem notas registadas."}
                  </div>
                )}
              </div>

              {/* YouTube Link */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Link da Gravação (YouTube)</h4>
                {isStaff ? (
                  <input 
                    type="url" 
                    placeholder="https://youtube.com/..." 
                    value={editBuffer.youtubeUrl || ''}
                    onChange={(e) => updateBufferField('youtubeUrl', e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-padelgreen-400 outline-none" 
                  />
                ) : editBuffer.youtubeUrl && (
                  <a href={editBuffer.youtubeUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-2xl font-bold">
                    <span>📺</span> Ver Gravação do Treino
                  </a>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              {isAdmin ? (
                <>
                  <button onClick={() => setSelectedSession(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Cancelar</button>
                  <button 
                    onClick={handleSaveEdit} 
                    disabled={isSavingEdit}
                    className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? 'A gravar...' : 'Guardar Alterações'}
                  </button>
                </>
              ) : (
                <button onClick={() => setSelectedSession(null)} className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg">Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-petrol-950/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-petrol-900 text-center mb-6">Remover Histórico</h3>
            <div className="space-y-3">
              <button onClick={() => handleDeleteSession('me')} className="w-full py-4 bg-slate-100 font-bold rounded-2xl">Esconder de mim</button>
              <button onClick={() => handleDeleteSession('all')} className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg">Apagar para todos</button>
              <button onClick={() => setDeletingSession(null)} className="w-full py-4 text-slate-400 font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
