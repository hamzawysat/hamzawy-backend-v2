#!/usr/bin/env python3
"""Private stdin/stdout PaddleOCR adapter. Never writes uploaded card images to disk."""
import json
import sys

import cv2
import numpy as np
from paddleocr import PaddleOCR


def unpack_result(item):
    payload = getattr(item, "json", None)
    if callable(payload):
        payload = payload()
    if not isinstance(payload, dict):
        payload = {}
    payload = payload.get("res", payload)
    texts = payload.get("rec_texts") or []
    scores = payload.get("rec_scores") or []
    return [
        {"text": str(text), "confidence": float(scores[i]) if i < len(scores) else 0.0}
        for i, text in enumerate(texts)
        if str(text).strip()
    ]


def variants(image):
    output = [image]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    output.append(cv2.cvtColor(clahe, cv2.COLOR_GRAY2BGR))
    gamma = 1.35
    lut = np.array([min(255, ((i / 255.0) ** (1.0 / gamma)) * 255) for i in range(256)], dtype=np.uint8)
    lifted = cv2.LUT(gray, lut)
    output.append(cv2.cvtColor(lifted, cv2.COLOR_GRAY2BGR))
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    output.append(cv2.filter2D(output[1], -1, sharpen_kernel))
    return output


def regions(image):
    height, width = image.shape[:2]
    return [
        ("full", image),
        ("national_id_band", image[int(height * 0.48):int(height * 0.94), int(width * 0.02):int(width * 0.98)]),
        ("national_id_line", image[int(height * 0.60):int(height * 0.90), int(width * 0.05):int(width * 0.95)]),
        ("arabic_name_band", image[int(height * 0.20):int(height * 0.67), int(width * 0.20):int(width * 0.98)]),
    ]


def main():
    raw = sys.stdin.buffer.read()
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("PADDLE_OCR_IMAGE_DECODE_FAILED")

    # PP-OCRv5 Arabic recognizer supports Arabic-script text and English text.
    engine = PaddleOCR(
        lang="ar",
        ocr_version="PP-OCRv5",
        device="cpu",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=False,
    )
    findings = []
    seen = set()
    for variant_index, variant in enumerate(variants(image)):
        for region_name, crop in regions(variant):
            if crop.size == 0:
                continue
            scale = 2 if crop.shape[1] < 1800 else 1
            if scale > 1:
                crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            for item in engine.predict(input=crop):
                for line in unpack_result(item):
                    key = (variant_index, region_name, line["text"])
                    if key in seen:
                        continue
                    seen.add(key)
                    findings.append({
                        "variant": variant_index,
                        "region": region_name,
                        **line,
                    })
    print(json.dumps({"engine": "PaddleOCR-3.7.0-PP-OCRv5-ar", "findings": findings}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Keep diagnostics free of image content and recognized PII.
        print(json.dumps({"error": type(exc).__name__, "message": str(exc)[:240]}))
        sys.exit(2)
