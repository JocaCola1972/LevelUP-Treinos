
import React, { useState, useEffect } from 'react';
import { AppState, Shift, RecurrenceType, Role, User } from '../types';
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

  const StudentRSVPBadge: React.FC<{ student: User; shiftId: string; date: string }> = ({ student, shiftId, date }) => {
    const rsvp = state.rsvps.find(r => r.shiftId === shiftId && r.userId === student.id && r.date === date);

    if (!rsvp) return (
      <div className="relative group/avatar">
        <img src={student.avatar} className="w-8 h-8 rounded-full border-2 border-white grayscale opacity-50" alt={student.name} />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-slate-400 rounded-full border-2 border-white"></div>
      </div>
    );

    return (
      <div className="relative group/avatar">
        <img src={student.avatar} className={`w-8 h-8 rounded-full border-2 ${rsvp.attending ? 'border-padelgreen-400 ring-2 ring-padelgreen-100' : 'border-red-400 grayscale opacity-70'}`} alt={student.name} />
        <div className={`absolute -top-1 -right-1 w-3 h-3 ${rsvp.attending ? 'bg-padelgreen-500' : 'bg-red-500'} rounded-full border-2 border-white`}></div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-petrol-900">Agendamentos</h2>
            <p className="text-slate-500 text-xs md:text-sm">Gestão de treinos pontuais específicos.</p>
          </div>
          <button onClick={refresh} className="text-[10px] font-black text-slate-400 hover:text-padelgreen-500 uppercase tracking-widest transition-colors mt-1">🔄 Sincronizar</button>
        </div>
        {state.currentUser?.role === Role.ADMIN && (
          <button 
            onClick={() => { setEditingShift(null); setIsModalOpen(true); }}
            className="w-full sm:w-auto bg-petrol-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <span>+</span> Novo Treino
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {state.shifts
          .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
          .map(shift => {
          const coach = state.users.find(u => u.id === shift.coachId);
          const shiftStudents = state.users.filter(u => shift.studentIds.includes(u.id));
          const dateStr = shift.startDate ? new Date(shift.startDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data';
          
          return (
            <div key={shift.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-padelgreen-600 uppercase tracking-widest bg-padelgreen-50 px-2 py-0.5 rounded">TREINO ÚNICO</span>
                      <span className="text-xs font-bold text-slate-400">• {dateStr}</span>
                    </div>
                    <h3 className="text-2xl font-black text-petrol-900">{shift.dayOfWeek}, às {shift.startTime}</h3>
                    <p className="text-slate-500 text-sm font-medium">Duração prevista: {shift.durationMinutes} minutos</p>
                  </div>
                  {state.currentUser?.role === Role.ADMIN && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingShift(shift); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-petrol-900 hover:bg-slate-50 rounded-xl transition-all">✏️</button>
                      <button onClick={async () => { if(confirm('Remover agendamento?')) { await db.shifts.delete(shift.id); refresh(); }}} className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">🗑️</button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src={coach?.avatar} className="w-10 h-10 rounded-full ring-2 ring-white shadow-sm" alt="" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black leading-none mb-1">Coach</p>
                      <p className="text-sm font-bold text-petrol-900">{coach?.name}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 uppercase font-black leading-none mb-2 md:text-right">Presenças Confirmadas</p>
                    <div className="flex -space-x-2 md:justify-end">
                      {shiftStudents.map(student => (
                        <StudentRSVPBadge key={student.id} student={student} shiftId={shift.id} date={shift.startDate!} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[40px] sm:rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-xl md:text-2xl font-black text-petrol-900 mb-6 text-center sm:text-left">Agendar Novo Treino</h3>
            <form onSubmit={handleSave} className="space-y-4 pb-8 sm:pb-0">
              
              <div className="bg-petrol-50 p-5 rounded-2xl border border-petrol-100 mb-6">
                <label className="block text-xs font-black text-petrol-700 mb-2 uppercase tracking-wider">Selecione a Data</label>
                <input 
                  type="date" 
                  name="startDate"
                  required
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-full px-4 py-3 bg-white border border-petrol-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all font-bold text-petrol-900" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase ml-2 tracking-wider">Dia da Semana (Automático)</label>
                <input disabled value={selectedDay} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-bold" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase ml-2 tracking-wider">Hora</label>
                  <input type="time" name="startTime" defaultValue={editingShift?.startTime || '18:00'} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase ml-2 tracking-wider">Duração (Minutos)</label>
                  <input type="number" name="duration" defaultValue={editingShift?.durationMinutes || 60} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase ml-2 tracking-wider">Coach</label>
                <select name="coachId" defaultValue={editingShift?.coachId || state.currentUser?.id} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all font-bold">
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase ml-2 tracking-wider">Participantes</label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm p-2 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100 font-medium">
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg active:scale-95">Guardar Treino</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsList;
