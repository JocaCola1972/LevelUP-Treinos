
import React, { useState, useMemo } from 'react';
import { AppState, TrainingSession, User } from '../types';
import { db } from '../services/db';

interface FinopsProps {
  state: AppState;
  refresh: () => void;
}

const Finops: React.FC<FinopsProps> = ({ state, refresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const isAdminEspecial = state.currentUser?.phone === '917772010';

  const sessions = useMemo(() => {
    return [...state.sessions]
      .filter(s => s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.sessions]);

  // Estatísticas Globais Recalculadas
  const stats = useMemo(() => {
    let totalReceived = 0;
    let paidCount = 0;
    let pendingCount = 0;
    
    sessions.forEach(s => {
      s.attendeeIds.forEach(attId => {
        const payment = s.payments?.[attId];
        if (payment?.paid) {
          totalReceived += payment.amount;
          paidCount++;
        } else {
          pendingCount++;
        }
      });
    });

    return { totalReceived, paidCount, pendingCount };
  }, [sessions]);

  const handleUpdatePayment = async (session: TrainingSession, userId: string, paid: boolean, amount: number) => {
    const actionId = `${session.id}-${userId}`;
    setSavingId(actionId);
    
    try {
      const updatedPayments = {
        ...(session.payments || {}),
        [userId]: { paid, amount }
      };

      const updatedSession = {
        ...session,
        payments: updatedPayments
      };

      await db.sessions.save(updatedSession);
      refresh();
    } catch (err) {
      console.error("Erro ao atualizar pagamento:", err);
      alert("Erro ao guardar o estado do pagamento.");
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdminEspecial) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <span className="text-6xl mb-4">🚫</span>
        <h2 className="text-xl font-black text-petrol-900">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2">Este separador é exclusivo para a administração financeira.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Resumo Financeiro Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Recebido (Global)</p>
            <h3 className="text-3xl font-black text-padelgreen-600">{stats.totalReceived.toFixed(2)}€</h3>
          </div>
          <div className="w-12 h-12 bg-padelgreen-50 rounded-2xl flex items-center justify-center text-2xl">💶</div>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pagamentos Efetuados</p>
            <h3 className="text-3xl font-black text-petrol-800">{stats.paidCount}</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">✅</div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pagamentos Pendentes</p>
            <h3 className="text-3xl font-black text-amber-500">{stats.pendingCount}</h3>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl">⏳</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-petrol-900 self-start md:self-center uppercase tracking-tight">Registo de Cobranças</h2>
        <div className="relative w-full md:w-64">
          <input 
            type="text" 
            placeholder="Pesquisar por turma..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-padelgreen-400"
          />
        </div>
      </div>

      <div className="space-y-6">
        {sessions
          .filter(s => !searchTerm || (s.turmaName || '').toLowerCase().includes(searchTerm.toLowerCase()))
          .map(session => {
            const date = new Date(session.date);
            const attendees = state.users.filter(u => session.attendeeIds.includes(u.id));
            
            // Soma dinâmica: Apenas o que está como PAGO
            const sessionTotalPaid = Object.values(session.payments || {})
              .reduce((acc, p) => acc + (p.paid ? p.amount : 0), 0);
            
            const sessionPaidCount = Object.values(session.payments || {})
              .filter(p => p.paid).length;

            return (
              <div key={session.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white w-12 h-12 rounded-2xl flex flex-col items-center justify-center border border-slate-200 shadow-sm">
                      <span className="text-sm font-black leading-none">{date.getDate()}</span>
                      <span className="text-[8px] font-black uppercase text-slate-400">{date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>
                    <div>
                      <h4 className="text-base font-black text-petrol-900 leading-tight">
                        {session.turmaName || "Treino Pontual"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {attendees.length} Atletas • {sessionPaidCount} Confirmados
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Recebido nesta Sessão</p>
                    <div className="bg-padelgreen-400 text-petrol-950 px-4 py-1.5 rounded-full text-sm font-black shadow-md">
                      {sessionTotalPaid.toFixed(2)}€
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-50">
                  {attendees.map(student => {
                    const payment = session.payments?.[student.id] || { paid: false, amount: 15 };
                    const isSaving = savingId === `${session.id}-${student.id}`;

                    return (
                      <div key={student.id} className={`p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 ${payment.paid ? 'bg-padelgreen-50/20' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img src={student.avatar} className="w-10 h-10 rounded-full border border-white shadow-sm shrink-0" alt="" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-petrol-900 truncate">{student.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{student.phone}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Preço</span>
                            <div className="relative">
                              <input 
                                type="number"
                                defaultValue={payment.amount}
                                onBlur={(e) => handleUpdatePayment(session, student.id, payment.paid, parseFloat(e.target.value) || 0)}
                                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center outline-none focus:ring-2 focus:ring-padelgreen-400 shadow-sm"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">€</span>
                            </div>
                          </div>

                          {/* Checkbox / Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleUpdatePayment(session, student.id, !payment.paid, payment.amount)}
                            disabled={isSaving}
                            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 transition-all min-w-[130px] justify-center group active:scale-95 ${
                              payment.paid 
                                ? 'bg-padelgreen-500 border-padelgreen-500 text-white shadow-lg shadow-padelgreen-500/30' 
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'
                            }`}
                          >
                            {isSaving ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                payment.paid ? 'bg-white border-white' : 'border-amber-300 bg-white'
                              }`}>
                                {payment.paid && <span className="text-[10px] text-padelgreen-600 font-black">✓</span>}
                              </div>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {isSaving ? 'A guardar' : (payment.paid ? 'Pago' : 'Pendente')}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {sessions.length === 0 && (
          <div className="bg-white rounded-[32px] p-20 text-center border border-slate-200">
            <div className="text-4xl mb-4 grayscale opacity-30">💰</div>
            <p className="text-slate-400 font-medium italic">Não existem treinos concluídos para processamento financeiro.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Finops;
