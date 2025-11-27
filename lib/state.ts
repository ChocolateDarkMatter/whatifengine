
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
// FIX: Added missing imports for FunctionCall, useUI, and useTools stores.
import { FunctionResponseScheduling, Schema, Type } from '@google/genai';
import { AVAILABLE_TOOLS } from './tools';

// FIX: Added missing FunctionCall interface definition.
export interface FunctionCall {
  name: string;
  description?: string;
  parameters: Schema;
  isEnabled: boolean;
  scheduling: FunctionResponseScheduling;
}

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  responseWindowDuration: number;
  storyLevel: number;
  audience: 'king' | 'empress' | 'both';
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setResponseWindowDuration: (duration: number) => void;
  setStoryLevel: (level: number) => void;
  setAudience: (audience: 'king' | 'empress' | 'both') => void;
}>(set => ({
  systemPrompt: `You are a wise and magical storyteller for young children. Your stories are gentle adventures filled with wonder and fun characters. In your stories, you subtly teach important lessons about kindness, curiosity, and honesty. You may sparingly include elements of Haitian culture. Always be encouraging and incorporate the children's ideas into the narrative. Start with a simple story starter and prompt for their ideas with "What happens next?" or "What if...". When you describe a new scene, try to be very visual.`,
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  responseWindowDuration: 10,
  storyLevel: 3,
  audience: 'king',
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setResponseWindowDuration: duration => set({ responseWindowDuration: duration }),
  setStoryLevel: level => set({ storyLevel: level }),
  setAudience: audience => set({ audience }),
}));

// FIX: Added missing useUI zustand store.
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}>(set => ({
  isSidebarOpen: false,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

// FIX: Added missing useTools zustand store.
export const useTools = create<{
  tools: FunctionCall[];
  toggleTool: (name: string) => void;
  addTool: () => void;
  removeTool: (name: string) => void;
  updateTool: (name: string, updatedTool: FunctionCall) => void;
}>((set, get) => ({
  tools: AVAILABLE_TOOLS,
  toggleTool: (name: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === name ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () => {
    const newTool: FunctionCall = {
      name: `new_function_${get().tools.length + 1}`,
      description: 'A new function call.',
      parameters: { type: Type.OBJECT, properties: {} },
      isEnabled: false,
      scheduling: FunctionResponseScheduling.INTERRUPT,
    };
    set(state => ({ tools: [...state.tools, newTool] }));
  },
  removeTool: (name: string) =>
    set(state => ({ tools: state.tools.filter(tool => tool.name !== name) })),
  updateTool: (name: string, updatedTool: FunctionCall) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === name ? updatedTool : tool,
      ),
    })),
}));

interface TimerState {
  isTimerActive: boolean;
  timerKey: number;
  activate: () => void;
  deactivate: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  isTimerActive: false,
  timerKey: 0,
  activate: () => set(state => ({
    isTimerActive: true,
    timerKey: state.timerKey + 1,
  })),
  deactivate: () => set({ isTimerActive: false }),
}));

interface AppStatusState {
  isAgentSpeaking: boolean;
  setAgentSpeaking: (isSpeaking: boolean) => void;
}

export const useAppStatusStore = create<AppStatusState>((set) => ({
  isAgentSpeaking: false,
  setAgentSpeaking: (isSpeaking: boolean) => set({ isAgentSpeaking: isSpeaking }),
}));


/**
 * Logs
 */
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));
