import type { Language } from './types';
interface VoiceResultEvent { results: ArrayLike<ArrayLike<{ transcript: string }>>; }
interface VoiceErrorEvent { error: string; }
export interface Recognition { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((event: VoiceResultEvent) => void) | null; onerror: ((event: VoiceErrorEvent) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; }
type RecognitionConstructor = new () => Recognition;
export function createRecognition(language: Language): Recognition | null {
  const scope = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const Engine = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Engine) return null;
  const recognition = new Engine(); recognition.lang = language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  return recognition;
}
