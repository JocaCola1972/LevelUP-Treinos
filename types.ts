
export enum Role {
  ADMIN = 'ADMIN',
  COACH = 'COACH',
  STUDENT = 'STUDENT'
}

export enum RecurrenceType {
  PONTUAL = 'PONTUAL',
  SEMANAL = 'SEMANAL',
  QUINZENAL = 'QUINZENAL'
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar: string;
  phone: string;
  password?: string;
  active?: boolean;
}

export interface Shift {
  id: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  studentIds: string[];
  coachId: string;
  recurrence: RecurrenceType;
  startDate?: string;
  clubName?: string;
}

export interface TrainingSession {
  id: string;
  shiftId: string;
  date: string;
  isActive: boolean;
  completed: boolean;
  attendeeIds: string[];
  youtubeUrl?: string;
  notes?: string;
  aiInsights?: string;
  hiddenForUserIds?: string[];
  turmaName?: string;
  coachId?: string;
  sessionCost?: number;
  isCostPaid?: boolean;
  clubName?: string;
  payments?: {
    [userId: string]: {
      paid: boolean;
      amount: number;
    };
  };
}

export interface ShiftRSVP {
  id: string;
  shiftId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  attending: boolean;
}

export interface AppMessage {
  id: string;
  senderId: string;
  recipientIds: string[]; // ['all'] para todos, ou lista de IDs
  content: string;
  type: 'INFO' | 'ALERT';
  createdAt: string;
  expiresAt?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  shifts: Shift[];
  sessions: TrainingSession[];
  rsvps: ShiftRSVP[];
  messages: AppMessage[];
  isOffline: boolean;
  appLogo?: string;
}
