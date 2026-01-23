
import { User, Shift, TrainingSession, ShiftRSVP, AppMessage } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const ensureConfig = () => {
  if (!isSupabaseConfigured) {
    throw new Error("Configuração do Supabase em falta (URL/Anon Key).");
  }
};

const handleDbError = (error: any, context: string) => {
  console.error(`Database Error [${context}]:`, error);
  
  let message = "Erro desconhecido na base de dados";
  if (typeof error === 'string') {
    message = error;
  } else if (error?.message) {
    message = error.message;
  } else if (error?.details) {
    message = error.details;
  } else {
    try {
      message = JSON.stringify(error);
    } catch (e) {
      message = "Erro complexo na base de dados (ver consola)";
    }
  }

  const code = error?.code ? ` [${error.code}]` : "";
  throw new Error(`${message}${code}`);
};

export const db = {
  settings: {
    getLogo: async (): Promise<string | null> => {
      if (!isSupabaseConfigured) return null;
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'app_logo')
          .maybeSingle();
        
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            console.warn(`A tabela 'settings' ainda não foi criada no Supabase (${error.code}). Usando logo padrão.`);
            return null;
          }
          throw error;
        }
        return data?.value || null;
      } catch (err) {
        console.warn("Aviso: Falha ao procurar logo personalizado:", err);
        return null;
      }
    },
    saveLogo: async (url: string) => {
      ensureConfig();
      const { error } = await supabase.from('settings').upsert({ key: 'app_logo', value: url });
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          throw new Error("A tabela 'settings' não existe na sua base de dados. Por favor, crie-a no SQL Editor do Supabase.");
        }
        handleDbError(error, "saveLogo");
      }
    }
  },
  users: {
    getAll: async (): Promise<User[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('users').select('*');
      if (error) handleDbError(error, "users.getAll");
      return data || [];
    },
    save: async (user: User) => {
      ensureConfig();
      const { data, error } = await supabase.from('users').upsert(user).select();
      if (error) handleDbError(error, "users.save");
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) handleDbError(error, "users.delete");
    }
  },
  shifts: {
    getAll: async (): Promise<Shift[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('shifts').select('*');
      if (error) handleDbError(error, "shifts.getAll");
      return data || [];
    },
    save: async (shift: Shift) => {
      ensureConfig();
      const { data, error } = await supabase.from('shifts').upsert(shift).select();
      if (error) handleDbError(error, "shifts.save");
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) handleDbError(error, "shifts.delete");
    }
  },
  sessions: {
    getAll: async (): Promise<TrainingSession[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) handleDbError(error, "sessions.getAll");
      return data || [];
    },
    save: async (session: TrainingSession) => {
      ensureConfig();
      const { data, error } = await supabase.from('sessions').upsert(session).select();
      if (error) handleDbError(error, "sessions.save");
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) handleDbError(error, "sessions.delete");
    }
  },
  rsvps: {
    getAll: async (): Promise<ShiftRSVP[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('rsvps').select('*');
      if (error) handleDbError(error, "rsvps.getAll");
      return data || [];
    },
    save: async (rsvp: ShiftRSVP) => {
      ensureConfig();
      const { data, error } = await supabase.from('rsvps').upsert(rsvp).select();
      if (error) handleDbError(error, "rsvps.save");
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('rsvps').delete().eq('id', id);
      if (error) handleDbError(error, "rsvps.delete");
    },
    deleteByUserAndDate: async (userId: string, shiftId: string, date: string) => {
      ensureConfig();
      const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('userId', userId)
        .eq('shiftId', shiftId)
        .eq('date', date);
      if (error) handleDbError(error, "rsvps.deleteByUserAndDate");
    }
  },
  clubs: {
    getAll: async (): Promise<string[]> => {
      if (!isSupabaseConfigured) return [];
      try {
        const { data, error } = await supabase.from('clubs').select('name').order('name');
        if (error) {
          if (error.code === '42P01') return [];
          throw error;
        }
        return data?.map(c => c.name) || [];
      } catch (err) {
        console.warn("Aviso: Tabela 'clubs' não encontrada ou erro ao carregar.");
        return [];
      }
    },
    save: async (name: string) => {
      ensureConfig();
      const { error } = await supabase.from('clubs').upsert({ name }, { onConflict: 'name' });
      if (error) handleDbError(error, "clubs.save");
    }
  },
  messages: {
    getAll: async (): Promise<AppMessage[]> => {
      if (!isSupabaseConfigured) return [];
      try {
        const { data, error } = await supabase.from('messages').select('*').order('createdAt', { ascending: false });
        if (error) {
          if (error.code === '42P01') return [];
          throw error;
        }
        return data || [];
      } catch (err) {
        return [];
      }
    },
    save: async (msg: AppMessage) => {
      ensureConfig();
      const { error } = await supabase.from('messages').upsert(msg);
      if (error) handleDbError(error, "messages.save");
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) handleDbError(error, "messages.delete");
    }
  }
};
