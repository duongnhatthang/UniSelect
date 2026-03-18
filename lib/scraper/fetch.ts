import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';

export async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'UniSelectBot/1.0 (educational; open source)' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  // Check Content-Type header first
  const contentType = res.headers.get('content-type') ?? '';
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  const declared = charsetMatch?.[1]?.toLowerCase();

  // If declared and not UTF-8, use it; otherwise detect
  const encoding = (declared && declared !== 'utf-8' && declared !== 'utf8')
    ? declared
    : (chardet.detect(buffer) ?? 'utf-8');

  return iconv.decode(buffer, encoding);
}
