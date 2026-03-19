#!/usr/bin/env python3
"""
PaddleOCR table text extraction helper.

Usage: python3 scripts/ocr_table.py <image_path> <output_json_path>

Reads an image file, runs PaddleOCR with Vietnamese language support,
and writes extracted text lines to a JSON file.

Output format: {"lines": ["line1", "line2", ...]}
"""

import sys
import json

if len(sys.argv) != 3:
    print("Usage: python3 ocr_table.py <image_path> <output_json_path>", file=sys.stderr)
    sys.exit(1)

image_path = sys.argv[1]
output_path = sys.argv[2]

from paddleocr import PaddleOCR

try:
    # PaddleOCR 3.x uses predict() and different params
    ocr = PaddleOCR(lang='vi')
    result = ocr.predict(image_path)
    # PaddleOCR 3.x predict returns generator of dicts
    lines = []
    for page_result in result:
        if hasattr(page_result, 'get') and 'rec_texts' in (page_result or {}):
            lines.extend(page_result['rec_texts'])
        elif isinstance(page_result, dict) and 'rec_texts' in page_result:
            lines.extend(page_result['rec_texts'])
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'lines': lines}, f, ensure_ascii=False)
    print(f"OCR extracted {len(lines)} lines from {image_path}", file=sys.stderr)
    sys.exit(0)
except (TypeError, AttributeError):
    pass

# PaddleOCR 2.x API fallback
ocr = PaddleOCR(use_angle_cls=True, lang='vi', use_gpu=False, show_log=False)
result = ocr.ocr(image_path, cls=True)

lines = []
if result:
    for page in result:
        if page:
            for line in page:
                text = line[1][0]  # (bounding_box, (text, confidence))
                lines.append(text)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({'lines': lines}, f, ensure_ascii=False)

print(f"OCR extracted {len(lines)} lines from {image_path}", file=sys.stderr)
