
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Usando os valores fornecidos pelo utilizador como fallbacks para as variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL || 'https://wcrmuqxjsfqworajcojq.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjcm11cXhqc2Zxd29yYWpjb2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NjU3MTAsImV4cCI6MjA4MzU0MTcxMH0.pTwxB91ZB1g3wq2WX7n_5wXbsOj_17dNq9QCSTsNEYc';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Inicializamos o cliente apenas se o URL estiver disponível para evitar erros de inicialização
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null as unknown as SupabaseClient;
