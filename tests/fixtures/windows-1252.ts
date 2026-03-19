// Windows-1252 encoded fixture as iconv Buffer
// Must be a Buffer — a plain TypeScript string would be detected as UTF-8 by chardet
import * as iconv from 'iconv-lite';

const html = `<html><head><title>Diem chuan</title></head><body><table><thead><tr><th>Ma nganh</th><th>To hop</th><th>Diem chuan</th></tr></thead><tbody><tr><td>7340101</td><td>A00</td><td>25.00</td></tr><tr><td>7480201</td><td>A01</td><td>26.00</td></tr></tbody></table></body></html>`;

export const WINDOWS_1252_BODY = iconv.encode(html, 'windows-1252');
export const WINDOWS_1252_EXPECTED_TEXT = html;
