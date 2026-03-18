import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('NEXT_LOCALE')?.value || 'vi';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
