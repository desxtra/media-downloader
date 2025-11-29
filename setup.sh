#!/bin/bash

echo "Setting up Media Downloader Pro"

# Update system
sudo apt update
sudo apt upgrade -y

# Install Bun
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Python and venv
echo "Setting up Python virtual environment..."
sudo apt install python3 python3-pip python3-venv ffmpeg -y

# Create project structure
echo "Creating project structure..."
mkdir -p media-downloader/public
mkdir -p media-downloader/downloads

cd media-downloader

# Create and activate virtual environment
echo "Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

# Install yt-dlp in virtual environment
echo "Installing yt-dlp..."
pip install yt-dlp

echo "Setup is done!"