'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecognition, speechSupported, type SpeechRecognitionLike } from '@/lib/speech';

/** Voice dictation (A6b): interim transcript preview before send; auto-stops on silence. */
export function useVoice(lang: 'en' | 'hi' | 'hinglish') {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalText, setFinalText] = useState<string | null>(null);
  const supported = speechSupported();

  useEffect(() => {
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const rec = createRecognition(lang);
    if (!rec) return;
    recRef.current = rec;
    setTranscript('');
    setFinalText(null);
    rec.onresult = (ev) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(final + interim);
      if (final) {
        setFinalText(final.trim());
        setListening(false);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const consume = useCallback(() => {
    const t = finalText;
    setFinalText(null);
    setTranscript('');
    return t;
  }, [finalText]);

  return { supported, listening, transcript, finalText, start, stop, consume };
}
