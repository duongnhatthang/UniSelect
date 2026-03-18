import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export function resolveLocale(cookieValue?: string): string {
  return cookieValue || 'vi';
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get('NEXT_LOCALE')?.value);
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
