# Media Downloader Pro

A web-based media downloader that supports YouTube, Facebook, Instagram, TikTok, and TeraBox. Features user isolation, automatic file cleanup, and a responsive web interface.

## Features

- **Multi-Platform Support**: Download from YouTube, Facebook, Instagram, TikTok, and TeraBox
- **User Isolation**: Each user gets their own session with isolated file storage
- **Auto Cleanup**: Files automatically delete after 3 minutes
- **Session Management**: User sessions expire after 30 minutes of inactivity
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Format Selection**: For YouTube, choose between MP3 (audio) or MP4 (video)

## Quick Start

### Prerequisites

- Ubuntu server (tested on 20.04+) or Docker
- Internet connection

### Installation

1. **Run the setup script**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

**OR use docker compose**
   ```bash
   docker compose up --build
   ```

2. **Deployment**

you can use your preffered hosting for deployments