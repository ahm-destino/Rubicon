ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libgomp1 \
      libglib2.0-0 \
      libgl1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt constraints.txt ./

RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install \
      "numpy==1.26.4" \
      "Cython==3.0.11" && \
    python -m pip install --no-build-isolation \
      -c constraints.txt -r requirements.txt

RUN useradd --create-home --uid 10001 appuser

COPY --chown=appuser:appuser app.py .

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s \
  --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5)" || exit 1

CMD ["gunicorn", "-w", "1", "--threads", "1", \
     "-b", "0.0.0.0:8080", "--timeout", "600", "app:app"]
