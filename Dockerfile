FROM debian:12-slim

LABEL org.opencontainers.image.source="https://github.com"
LABEL org.opencontainers.image.title="media-downloader"
LABEL org.opencontainers.image.description="Container for media downloading"

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV BUN_INSTALL=/root/.bun
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /media-downloader

RUN apt update && apt install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    python3 \
    python3-venv \
    python3-pip \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

RUN mkdir -p public downloads

RUN python3 -m venv .venv \
 && . .venv/bin/activate \
 && pip install --no-cache-dir yt-dlp

COPY . .

EXPOSE 3000

CMD ["bash", "-c", "source .venv/bin/activate && bun run server.js"]