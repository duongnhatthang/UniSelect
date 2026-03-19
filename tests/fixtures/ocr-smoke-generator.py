#!/usr/bin/env python3
"""Generate a small synthetic JPEG with Vietnamese text for OCR smoke testing."""
import sys
from PIL import Image, ImageDraw, ImageFont

output_path = sys.argv[1] if len(sys.argv) > 1 else 'tests/fixtures/ocr-smoke.jpg'

img = Image.new('RGB', (400, 200), color='white')
draw = ImageDraw.Draw(img)
# Use default font (always available)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
except (OSError, IOError):
    font = ImageFont.load_default()

lines = [
    'Ma nganh: 7480201',
    'Diem chuan: 26.50',
    'To hop: A00',
]
y = 20
for line in lines:
    draw.text((20, y), line, fill='black', font=font)
    y += 40

img.save(output_path, 'JPEG', quality=95)
print(f'Generated OCR smoke test image: {output_path}')
