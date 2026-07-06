# ──────────────────────────────────────────────────────────────
# MMMUT EasyOCR Service — Railway Deployment
#
# Build: docker build -t mmmut-ocr .
# Run:   docker run -p 8000:8000 mmmut-ocr
#
# Uses CPU-only PyTorch to keep the image smaller (~1.5GB)
# ──────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System dependencies for OpenCV and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU-only first (smaller than full CUDA build)
RUN pip install --no-cache-dir \
    torch==2.3.1+cpu \
    torchvision==0.18.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# EasyOCR downloads models on first use — pre-download them
RUN python -c "import easyocr; easyocr.Reader(['hi', 'en'], gpu=False)"

# Railway uses PORT env variable
ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
