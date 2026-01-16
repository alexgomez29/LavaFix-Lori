export interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

export interface Appliance {
    id: string;
    name: string;
    type: 'washer' | 'dryer' | 'fridge' | 'dishwasher' | 'other';
    status: 'active' | 'warning' | 'error' | 'idle';
    model: string;
    purchaseDate: string;
    healthScore: number;
    image: string;
}

export interface ChatState {
    messages: Message[];
    isTyping: boolean;
}

// Client Management Types
export interface Client {
    id: string;
    name: string;
    phone1: string;
    phone2?: string;
    monthlyAmount: number;
    status: 'Pagado' | 'Pendiente';
    lastPaymentDate?: string;
    createdAt: number;
    image?: string; // New field for client photo
    reminderSent?: boolean; // New field to track if reminder was sent
}

export interface PaymentRecord {
    id: string;
    clientId: string;
    clientName: string;
    amount: number;
    date: string; // ISO string
    notes?: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning';
    timestamp: string;
}

// Ensure window types for AI Studio
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}