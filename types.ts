

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  width?: number; // Optional text box width
  align?: 'left' | 'center' | 'right';
}

export interface CopySuggestion {
  style: string;
  text: string;
  color?: string;
  fontSize?: number;
}

export interface GeneratedResult {
  originalImage: string; // Base64 or URL
  generatedImages: string[]; // Base64 or URL array
  suggestedCopy: CopySuggestion[];
  productAnalysis: string;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  SELECTION = 'SELECTION',
  EDITOR = 'EDITOR',
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export const FONTS = [
  { name: 'Noto Sans KR', value: "'Noto Sans KR', sans-serif" },
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Serif', value: "serif" },
  { name: 'Monospace', value: "monospace" },
];

export const COLORS = [
  '#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', 
  '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55',
  '#1F2937', '#4B5563', '#9CA3AF'
];

// AI Studio Integration Types
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
    getApiKey?: () => Promise<string>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
