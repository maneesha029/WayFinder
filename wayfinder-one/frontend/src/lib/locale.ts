'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export type AppLocale = 'en' | 'hi';

/** Hinglish uses the `hi` UI and sends locale=hinglish to the API (A6b). */
export function apiLocale(uiLocale: AppLocale): 'en' | 'hi' | 'hinglish' {
  return uiLocale;
}

export function useLocaleSwitch() {
  const router = useRouter();
  return useCallback(
    (locale: AppLocale) => {
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router]
  );
}

export function useCurrentLocale(): AppLocale {
  const l = useLocale();
  return l === 'hi' ? 'hi' : 'en';
}
