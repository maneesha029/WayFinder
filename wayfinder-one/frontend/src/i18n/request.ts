import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

/** next-intl without URL routing: locale lives in the NEXT_LOCALE cookie (A6b). */
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('NEXT_LOCALE')?.value;
  const locale: Locale = raw === 'hi' ? 'hi' : 'en';
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
