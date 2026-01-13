
import { User, Shift, TrainingSession, ShiftRSVP } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const ensureConfig = () => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase configuration missing (URL/Anon Key).");
  }
};

export const db = {
  users: {
    getAll: async (): Promise<User[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    },
    save: async (user: User) => {
      ensureConfig();
      const { data, error } = await supabase.from('users').upsert(user).select();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    }
  },
  shifts: {
    getAll: async (): Promise<Shift[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('shifts').select('*');
      if (error) throw error;
      return data || [];
    },
    save: async (shift: Shift) => {
      ensureConfig();
      const { data, error } = await supabase.from('shifts').upsert(shift).select();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    }
  },
  sessions: {
    getAll: async (): Promise<TrainingSession[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) throw error;
      return data || [];
    },
    save: async (session: TrainingSession) => {
      ensureConfig();
      const { data, error } = await supabase.from('sessions').upsert(session).select();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
    }
  },
  rsvps: {
    getAll: async (): Promise<ShiftRSVP[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('rsvps').select('*');
      if (error) throw error;
      return data || [];
    },
    save: async (rsvp: ShiftRSVP) => {
      ensureConfig();
      const { data, error } = await supabase.from('rsvps').upsert(rsvp).select();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      ensureConfig();
      const { error } = await supabase.from('rsvps').delete().eq('id', id);
      if (error) throw error;
    },
    deleteByUserAndDate: async (userId: string, shiftId: string, date: string) => {
      ensureConfig();
      // Em tabelas criadas com colunas quoted (como "userId"), o Supabase JS espera chaves que batam exatamente.
      const { error } = await supabase.from('rsvps').delete().match({ 
        userId, 
        shiftId, 
        date 
      });
      if (error) throw error;
    }
  }
};
