
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
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const isAdminEspecial = state.currentUser?.phone === '917772010';

  const sessions = useMemo(() => {
    return [...state.sessions]
      .filter(s => s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.sessions]);

  const stats = useMemo(() => {
    let totalReceived = 0;
    let totalCosts = 0;
    let paidCount = 0;
    let pendingCount = 0;
    
    sessions.forEach(s => {
      // Receitas
      s.attendeeIds.forEach(attId => {
        const payment = s.payments?.[attId];
        if (payment?.paid) {
          totalReceived += (payment.amount || 0);
          paidCount++;
        } else {
          pendingCount++;
        }
      });
      // Custos (Fallack para 25 se não estiver definido ou for 0)
      if (s.isCostPaid) {
        totalCosts += (s.sessionCost || 25);
      }
    });

    return { totalReceived, totalCosts, paidCount, pendingCount, profit: totalReceived - totalCosts };
  }, [sessions]);

  // Função para limpar o objeto da sessão antes de enviar para o DB
  const sanitizeSession = (session: TrainingSession) => {
    const clean: any = { ...session };
    return clean;
  };

  const handleUpdatePayment = async (session: TrainingSession, userId: string, paid: boolean, amount: number) => {
    const actionId = `${session.id}-${userId}`;
    setSavingId(actionId);
    setSchemaError(null);
    
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
    } catch (err: any) {
      console.error("Erro ao atualizar pagamento:", err);
      const msg = err.message || "";
      if (msg.includes('PGRST204') || msg.includes('column') || msg.includes('payments')) {
        setSchemaError("A estrutura da tabela 'sessions' precisa de ser atualizada.");
      } else {
        alert(`Erro ao guardar: ${err.message}`);
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateSessionCost = async (e: React.MouseEvent, session: TrainingSession, cost: number, isPaid: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSavingId(`${session.id}-cost`);
    setSchemaError(null);

    try {
      const updatedSession = {
        ...session,
        sessionCost: cost,
        isCostPaid: isPaid
      };
      await db.sessions.save(updatedSession);
      refresh();
    } catch (err: any) {
      console.error("Erro ao atualizar custo:", err);
      const msg = err.message || "";
      if (msg.includes('PGRST204') || msg.includes('sessionCost') || msg.includes('isCostPaid')) {
        setSchemaError("A estrutura da tabela 'sessions' precisa de ser atualizada.");
      } else {
        alert(`Erro ao atualizar custo: ${err.message}`);
      }
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
      {/* Alerta de Erro de Schema */}
      {schemaError && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-[32px] p-6 md:p-8 animate-in zoom-in duration-300 shadow-xl">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-16 h-16 bg-amber-400 text-white rounded-full flex items-center justify-center text-3xl shrink-0 shadow-lg">🛠️</div>
            <div className="flex-1">
              <h3 className="text-amber-900 font-black uppercase text-base tracking-tight mb-2">Atualização Necessária</h3>
              <p className="text-amber-800 text-sm font-medium leading-relaxed mb-6">
                Para suportar as novas funções de <b>Clube/Local</b> e Financeiras, execute este SQL no Supabase:
              </p>
              
              <div className="relative group">
                <div className="bg-slate-900 text-padelgreen-400 p-5 rounded-2xl font-mono text-[10px] leading-relaxed break-all select-all shadow-2xl border border-slate-700">
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '&#123;&#125;'::jsonb; <br/>
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "sessionCost" NUMERIC DEFAULT 25; <br/>
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "isCostPaid" BOOLEAN DEFAULT false; <br/>
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "turmaName" TEXT; <br/>
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "coachId" TEXT; <br/>
                  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "clubName" TEXT; <br/>
                  ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "clubName" TEXT; <br/>
                  CREATE TABLE IF NOT EXISTS clubs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT now());
                </div>
              </div>
              
              <div className="mt-6 flex gap-4">
                <button 
                  onClick={() => refresh()}
                  className="px-6 py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition-all shadow-md active:scale-95 text-xs uppercase tracking-widest"
                >
                  Já executei o comando
                </button>
                <button 
                  onClick={() => setSchemaError(null)}
                  className="px-6 py-3 text-amber-700 font-bold hover:bg-amber-100 rounded-xl transition-all text-xs uppercase"
                >
                  Dispensar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo Financeiro Global */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturação Total</p>
          <h3 className="text-2xl font-black text-padelgreen-600">{stats.totalReceived.toFixed(2)}€</h3>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custos Pagos</p>
          <h3 className="text-2xl font-black text-red-500">{stats.totalCosts.toFixed(2)}€</h3>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lucro Líquido</p>
          <h3 className="text-2xl font-black text-petrol-900">{stats.profit.toFixed(2)}€</h3>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendentes Alunos</p>
          <h3 className="text-2xl font-black text-amber-500">{stats.pendingCount}</h3>
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
            const paymentValues = Object.values(session.payments || {}) as Array<{paid: boolean, amount: number}>;
            const sessionTotalPaid = paymentValues.reduce((acc, p) => acc + (p.paid ? p.amount : 0), 0);
            
            const isCostSaving = savingId === `${session.id}-cost`;
            const currentSessionCost = session.sessionCost !== undefined && session.sessionCost !== 0 ? session.sessionCost : 25;
            const profit = sessionTotalPaid - currentSessionCost;

            return (
              <div key={session.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-slate-50 p-5 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="bg-white w-12 h-12 rounded-2xl flex flex-col items-center justify-center border border-slate-200 shadow-sm shrink-0">
                      <span className="text-sm font-black leading-none">{date.getDate()}</span>
                      <span className="text-[8px] font-black uppercase text-slate-400">{date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-black text-petrol-900 leading-tight truncate">
                        {session.turmaName || "Treino Pontual"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        📍 {session.clubName || 'Sem Clube'} • {attendees.length} Atletas
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
                    {/* Controlo de Custos (Clube) */}
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Custo Clube</span>
                      <div className="relative">
                        <input 
                          type="number"
                          id={`cost-input-${session.id}`}
                          defaultValue={currentSessionCost}
                          onBlur={(e) => handleUpdateSessionCost(e as any, session, parseFloat(e.target.value) || 0, !!session.isCostPaid)}
                          className="w-16 px-1 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-center outline-none focus:ring-1 focus:ring-petrol-400"
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          const input = document.getElementById(`cost-input-${session.id}`) as HTMLInputElement;
                          const currentCostVal = input ? parseFloat(input.value) : currentSessionCost;
                          handleUpdateSessionCost(e, session, currentCostVal, !session.isCostPaid);
                        }}
                        disabled={isCostSaving}
                        className={`min-w-[70px] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-90 ${
                          session.isCostPaid 
                            ? 'bg-petrol-900 text-white shadow-lg' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {isCostSaving ? '...' : (session.isCostPaid ? 'Pago' : 'Pend.')}
                      </button>
                    </div>

                    {/* Resumo de Receita e Lucro */}
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Receita</span>
                        <div className="bg-padelgreen-400 text-petrol-950 px-4 py-1.5 rounded-full text-xs font-black shadow-md min-w-[70px] text-center">
                          {sessionTotalPaid.toFixed(2)}€
                        </div>
                      </div>
                      <p className={`text-[10px] font-black mt-1 ${profit >= 0 ? 'text-padelgreen-600' : 'text-red-500'}`}>
                        Lucro: {profit.toFixed(2)}€
                      </p>
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
