#!/usr/bin/env python3
"""Download Arabic OCR models and run a CPU inference smoke test during Railway build."""
import numpy as np
from paddleocr import PaddleOCR

engine = PaddleOCR(
    lang="ar",
    ocr_version="PP-OCRv5",
    device="cpu",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)
# Exercise the real inference path so missing/incompatible model weights fail
# the Railway build instead of surfacing on the first technician registration.
results = engine.predict(input=np.full((128, 512, 3), 255, dtype=np.uint8))
if not results:
    raise RuntimeError("PaddleOCR CPU inference smoke test returned no result")
print("PaddleOCR Arabic PP-OCRv5 model download and CPU inference smoke test passed")
