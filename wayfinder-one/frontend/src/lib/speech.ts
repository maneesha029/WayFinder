'use client';

/** Web Speech API voice input (A6b Voice). Feature-detected; hi-IN for Hindi/Hinglish. */

export interface SpeechSupport {
  supported: boolean;
  continuous: boolean;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;
}

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: RecognitionEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type Ctor = new () => SpeechRecognitionLike;

export function createRecognition(lang: 'en' | 'hi' | 'hinglish'): SpeechRecognitionLike | null {
  if (!speechSupported()) return null;
  const C = (window as unknown as { webkitSpeechRecognition: Ctor }).webkitSpeechRecognition;
  const rec = new C();
  rec.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  return rec;
}

export type { SpeechRecognitionLike };
