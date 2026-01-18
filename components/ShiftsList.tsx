
import React, { useState, useEffect } from 'react';
import { AppState, Shift, RecurrenceType, Role, User, TrainingSession } from '../types';
import { db } from '../services/db';
import { DAYS_OF_WEEK } from '../constants';

interface ShiftsListProps {
  state: AppState;
  refresh: () => void;
}

const ShiftsList: React.FC<ShiftsListProps> = ({ state, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_OF_WEEK[0]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      if (editingShift) {
        setSelectedDay(editingShift.dayOfWeek);
        setSelectedDate(editingShift.startDate || '');
      } else {
        setSelectedDay(DAYS_OF_WEEK[0]);
        setSelectedDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [isModalOpen, editingShift]);

  const isStaff = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.COACH;
  const coaches = state.users.filter(u => u.role === Role.COACH || u.role === Role.ADMIN);
  const students = state.users.filter(u => u.role === Role.STUDENT);

  const getDayStringFromDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[date.getDay()];
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    setSelectedDate(dateValue);
    if (dateValue) {
      const dayName = getDayStringFromDate(dateValue);
      setSelectedDay(dayName);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const shift: Shift = {
      id: editingShift?.id || Math.random().toString(36).substr(2, 9),
      dayOfWeek: selectedDay,
      startTime: formData.get('startTime') as string,
      durationMinutes: parseInt(formData.get('duration') as string),
      coachId: formData.get('coachId') as string,
      studentIds: Array.from(formData.getAll('studentIds')) as string[],
      recurrence: RecurrenceType.PONTUAL,
      startDate: selectedDate || undefined,
    };
    await db.shifts.save(shift);
    refresh();
    setIsModalOpen(false);
  };

  const handleFinalizeSession = async (shift: Shift) => {
    if (!shift.startDate) return;
    if (!confirm('Deseja finalizar este treino? Ele será movido para o Histórico.')) return;
    
    setIsFinalizing(shift.id);
    try {
      const attendees = state.rsvps
        .filter(r => r.shiftId === shift.id && r.date === shift.startDate && r.attending)
        .map(r => r.userId);

      const existingSession = state.sessions.find(s => s.shiftId === shift.id && s.date.startsWith(shift.startDate!));

      const sessionData: TrainingSession = {
        id: existingSession?.id || Math.random().toString(36).substr(2, 9),
        shiftId: shift.id,
        date: `${shift.startDate}T${shift.startTime}`,
        isActive: false,
        completed: true,
        attendeeIds: attendees,
        notes: existingSession?.notes || 'Sessão finalizada via Agenda.',
        hiddenForUserIds: existingSession?.hiddenForUserIds || [],
        coachId: shift.coachId,
        turmaName: `${shift.dayOfWeek} (${shift.startTime})`
      };

      await db.sessions.save(sessionData);
      await refresh();
    } catch (err: any) {
      alert(`Erro ao finalizar: ${err.message}`);
    } finally {
      setIsFinalizing(null);
    }
  };

  const StudentRSVPBadge: React.FC<{ student: User; shiftId: string; date: string }> = ({ student, shiftId, date }) => {
    const rsvp = state.rsvps.find(r => r.shiftId === shiftId && r.userId === student.id && r.date === date);

    if (!rsvp) return (
      <div className="relative group/avatar">
        <img src={student.avatar} className="w-7 h-7 rounded-full border border-white grayscale opacity-50" alt={student.name} />
        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-slate-400 rounded-full border border-white"></div>
      </div>
    );

    return (
      <div className="relative group/avatar">
        <img src={student.avatar} className={`w-7 h-7 rounded-full border border-white ${rsvp.attending ? 'ring-2 ring-padelgreen-200' : 'grayscale opacity-70'}`} alt={student.name} />
        <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${rsvp.attending ? 'bg-padelgreen-500' : 'bg-red-500'} rounded-full border border-white`}></div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-petrol-900">Agendamentos</h2>
            <p className="text-slate-500 text-xs md:text-sm">Treinos pontuais registados.</p>
          </div>
          <button onClick={refresh} className="text-[10px] font-black text-slate-400 hover:text-padelgreen-500 uppercase tracking-widest transition-colors mt-1">🔄 Sincronizar</button>
        </div>
        {state.currentUser?.role === Role.ADMIN && (
          <button 
            onClick={() => { setEditingShift(null); setIsModalOpen(true); }}
            className="w-full sm:w-auto bg-petrol-900 text-white px-5 py-2 rounded-xl font-bold hover:bg-petrol-950 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
          >
            + Novo Treino
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.shifts
          .sort((a, b) => {
            // Ordenação por data E hora
            const dateTimeA = `${a.startDate || '9999-12-31'}T${a.startTime || '23:59'}`;
            const dateTimeB = `${b.startDate || '9999-12-31'}T${b.startTime || '23:59'}`;
            return dateTimeA.localeCompare(dateTimeB);
          })
          .map(shift => {
          const coach = state.users.find(u => u.id === shift.coachId);
          const shiftStudents = state.users.filter(u => shift.studentIds.includes(u.id));
          const dateStr = shift.startDate ? new Date(shift.startDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : 'S/ Data';
          
          const isCompleted = state.sessions.some(s => s.shiftId === shift.id && s.date.startsWith(shift.startDate!) && s.completed);

          return (
            <div key={shift.id} className={`bg-white rounded-2xl border ${isCompleted ? 'border-slate-100 opacity-80' : 'border-slate-200'} overflow-hidden shadow-sm hover:shadow-md transition-all group relative`}>
              <div className="p-4 md:p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-padelgreen-100 text-padelgreen-700'}`}>
                        {isCompleted ? 'OK' : 'PONTUAL'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{dateStr}</span>
                    </div>
                    <h3 className={`text-lg font-black truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-petrol-900'}`}>{shift.dayOfWeek}, às {shift.startTime}</h3>
                    <p className="text-slate-500 text-[10px] font-medium italic">{shift.durationMinutes} min</p>
                  </div>
                  {state.currentUser?.role === Role.ADMIN && !isCompleted && (
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => { setEditingShift(shift); setIsModalOpen(true); }} className="p-1.5 text-slate-300 hover:text-petrol-900 transition-all">✏️</button>
                      <button onClick={async () => { if(confirm('Remover?')) { await db.shifts.delete(shift.id); refresh(); }}} className="p-1.5 text-red-200 hover:text-red-500 transition-all">🗑️</button>
                    </div>
                  )}
                </div>

                <div className={`p-3 rounded-xl border border-slate-50 ${isCompleted ? 'bg-slate-50/30' : 'bg-slate-50/80'} mb-3`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={coach?.avatar} className={`w-7 h-7 rounded-full border border-white shadow-sm ${isCompleted ? 'grayscale opacity-40' : ''}`} alt="" />
                      <span className={`text-[11px] font-bold truncate ${isCompleted ? 'text-slate-400' : 'text-petrol-800'}`}>{coach?.name.split(' ')[0]}</span>
                    </div>
                    <div className="flex -space-x-1.5">
                      {shiftStudents.map(student => (
                        <StudentRSVPBadge key={student.id} student={student} shiftId={shift.id} date={shift.startDate!} />
                      ))}
                    </div>
                  </div>
                </div>

                {isStaff && (
                  <div className="flex justify-end">
                    {isCompleted ? (
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest py-1 px-2">Finalizado</span>
                    ) : (
                      <button 
                        onClick={() => handleFinalizeSession(shift)}
                        disabled={isFinalizing === shift.id}
                        className="w-full py-2 bg-white border border-padelgreen-400 text-petrol-900 hover:bg-padelgreen-500 hover:text-white font-black rounded-lg transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        {isFinalizing === shift.id ? '...' : '✓'}
                        {isFinalizing === shift.id ? 'A processar' : 'Finalizar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh]">
            <h3 className="text-xl font-black text-petrol-900 mb-6">Configurar Treino</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="bg-petrol-50 p-4 rounded-2xl border border-petrol-100">
                <label className="block text-[10px] font-black text-petrol-700 mb-2 uppercase tracking-wider">Data do Treino</label>
                <input 
                  type="date" 
                  name="startDate"
                  required
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-full px-4 py-3 bg-white border border-petrol-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-petrol-900" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Hora Início</label>
                  <input type="time" name="startTime" defaultValue={editingShift?.startTime || '18:00'} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Duração (Min)</label>
                  <input type="number" name="duration" defaultValue={editingShift?.durationMinutes || 60} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Treinador</label>
                <select name="coachId" defaultValue={editingShift?.coachId || state.currentUser?.id} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold">
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Atletas Inscritos</label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-xs p-2 bg-white border border-slate-100 rounded-lg cursor-pointer hover:border-padelgreen-200 transition-all font-medium">
                      <input 
                        type="checkbox" 
                        name="studentIds" 
                        value={s.id} 
                        defaultChecked={editingShift?.studentIds.includes(s.id)}
                        className="w-4 h-4 rounded text-padelgreen-500 focus:ring-padelgreen-400"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-petrol-900 text-white font-bold rounded-xl shadow-lg">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsList;
