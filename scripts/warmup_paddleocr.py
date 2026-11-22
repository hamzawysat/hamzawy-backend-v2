#!/usr/bin/env python3
"""Download and verify the pinned Arabic PaddleOCR CPU models during Railway build."""
from paddleocr import PaddleOCR

PaddleOCR(
    lang="ar",
    ocr_version="PP-OCRv5",
    device="cpu",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)
print("PaddleOCR Arabic PP-OCRv5 models initialized successfully")
