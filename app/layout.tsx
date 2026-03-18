import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';
import { OfflineBanner } from '../components/OfflineBanner';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam',
});

export const metadata: Metadata = {
  title: 'UniSelect',
  description: 'Tim truong dai hoc phu hop voi diem thi cua ban',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={font.variable}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <NuqsAdapter>
          <NextIntlClientProvider messages={messages}>
            <OfflineBanner />
            {children}
          </NextIntlClientProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
