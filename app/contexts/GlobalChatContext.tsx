'use client'

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Import ChatMessage interface from ChatWizardContext
export interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: React.ReactNode;
  timestamp: Date;
  step?: string; // Simplified from WizardStep to allow broader usage
}

// Global Chat State Interface
export interface GlobalChatState {
  messages: ChatMessage[];
  isActive: boolean;
}

// Action Types
type GlobalChatAction = 
  | { type: 'ADD_MESSAGE'; message: Omit<ChatMessage, 'id' | 'timestamp'> }
  | { type: 'SET_MESSAGES'; messages: ChatMessage[] }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_ACTIVE'; active: boolean }
  | { type: 'INIT_MESSAGES'; messages: ChatMessage[] };

// Context Type
interface GlobalChatContextType {
  state: GlobalChatState;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setActive: (active: boolean) => void;
  initMessages: (messages: ChatMessage[]) => void;
}

// Initial State
const initialState: GlobalChatState = {
  messages: [],
  isActive: false
};

// Reducer
function globalChatReducer(state: GlobalChatState, action: GlobalChatAction): GlobalChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            ...action.message,
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: new Date()
          }
        ]
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.messages
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: []
      };

    case 'SET_ACTIVE':
      return {
        ...state,
        isActive: action.active
      };

    case 'INIT_MESSAGES':
      return {
        ...state,
        messages: action.messages
      };

    default:
      return state;
  }
}

// Create Context
const GlobalChatContext = createContext<GlobalChatContextType | null>(null);

// Provider Component
export function GlobalChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(globalChatReducer, initialState);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    dispatch({ type: 'ADD_MESSAGE', message });
  }, []);

  const setMessages = useCallback((messages: ChatMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', messages });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const setActive = useCallback((active: boolean) => {
    dispatch({ type: 'SET_ACTIVE', active });
  }, []);

  const initMessages = useCallback((messages: ChatMessage[]) => {
    dispatch({ type: 'INIT_MESSAGES', messages });
  }, []);

  const contextValue: GlobalChatContextType = {
    state,
    addMessage,
    setMessages,
    clearMessages,
    setActive,
    initMessages
  };

  return (
    <GlobalChatContext.Provider value={contextValue}>
      {children}
    </GlobalChatContext.Provider>
  );
}

// Hook to use Global Chat Context
export function useGlobalChat() {
  const context = useContext(GlobalChatContext);
  if (!context) {
    throw new Error('useGlobalChat must be used within a GlobalChatProvider');
  }
  return context;
} 