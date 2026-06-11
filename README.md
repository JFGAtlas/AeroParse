# AeroParse - 抖音 & TikTok 无水印高清解析下载 Web 应用

AeroParse is a sleek, modern, and high-performance client-side Web application designed to parse and download watermark-free high-definition videos, images, and audio from **Douyin (抖音)** and **TikTok**. 

AeroParse 是一款设计优雅、极速流畅的 Web 端去水印解析工具。支持一键解析、预览并下载**抖音**及 **TikTok** 的高清无水印视频、图集和背景音乐。

---

## ✨ Features / 功能特性

- 🚀 **Bilingual Video Parsing (双语解析)**: Support for both Douyin (抖音) and TikTok share links.
- 💎 **Premium Dark Aesthetics (高端深色美学)**: Stunning glassmorphism UI built with vanilla CSS, neon gradients, interactive hover effects, and skeleton loaders.
- 📥 **Local Proxy Stream Downloader (本地流式代理下载)**: Bypasses browser CORS policy and CDN referrer restrictions by streaming video downloads server-side.
- 🔄 **Quality Fallback Logic (智能分辨率回退)**: Falls back automatically from HD (`nwm_video_url_HQ`) to standard quality if the HD play source is unavailable.
- 🛡️ **No-Referrer CDN Playback (防盗链直链播放)**: Bypasses CDN hotlinking `403 Forbidden` errors by stripping referer headers using browser-level `noreferrer` attributes.
- 🗂️ **Image Gallery Carousel (多图轮播与打包)**: Sliding image gallery for photo posts, with individual image downloads and a bulk ZIP download option.
- 🎵 **Audio Extractor (音频提取)**: Extract and download background music (MP3) from video posts.
- ⏳ **History Records (解析历史)**: Keeps track of the last 6 parses in browser `LocalStorage` for easy re-access.

---

## 🏗️ Architecture / 项目架构

The workspace contains:
- `index.html` - Semantic HTML5 interface, fully responsive.
- `style.css` - Custom styling tokens (colors, animations, layout utilities).
- `app.js` - Client-side core logic (API requests, history management, DOM binding).
- `dev_server.py` - Local Python development server with built-in CORS bypass and API download proxy.
- `download.py` - Core backend FastAPI route template for `/api/download` containing the final fixes.

---

## 🛠️ Quick Start / 快速开始

### 1. Run the Local Preview Dev Server
To launch the preview server with the built-in CORS and download proxy:
```bash
python3 dev_server.py
```
Open your browser and navigate to:
👉 **`http://localhost:8000`**

### 2. Deployment (Backend API integration)
AeroParse is designed to work with the [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) FastAPI backend:
1. Copy [download.py](./download.py) from this repository to your backend folder under `app/api/endpoints/download.py` (replacing the original file).
2. Restart your FastAPI backend server.
3. Access the frontend and change the **API Base URL** in the settings drawer (top-right gear icon) to your backend's host address (e.g. `http://localhost:8000`).

---

## 📝 Change Log (Fixes Applied) / 修复日志

1. **HTTP Redirect & Proxy Downloads (`follow_redirects=True`):**
   Fixed the issue where the backend `/api/download` failed due to `httpx` not following `302 Found` CDN redirects. Added proxy support to file streams.
2. **CDN 403 Forbidden Bypassed:**
   Added `rel="noreferrer"` and `btn.rel = 'noreferrer'` to frontend play and audio links, stripping the referer header to bypass ByteDance CDN hotlink blocks.
3. **Local Dev Server CORS Proxy:**
   Added `dev_server.py` supporting gzip decompression, CORS header injection, and local `/api/download` stream proxying for seamless local developer preview.

---

## ⚖️ License & Disclaimer / 授权与免责声明

### Disclaimer
This project is for educational and data analysis purposes only. Please respect the copyright of the creators. Do not use this tool for commercial purposes or to distribute copyrighted content without authorization.

### 免责声明
本网站及相关代码仅限用于学习和个人技术交流目的。请尊重创作者的版权，切勿将下载的内容用于商业用途或进行非授权传播。

---

## 🎁 Statement & Donation / 申明与捐赠

- **慈善开源项目**
- **无广告**
- **永久更新**
- **免费使用**

如果您觉得本项目对您有所帮助，欢迎捐赠支持我们的持续维护：

- **EVM (ETH/BSC/Polygon)**: `0x3EE918603d5a1c0f983BEC5B5d8C301F8ed58A2C`
- **Solana (SOL)**: `2LEDYj19kormPezoiFgZAguyCVsfaM3HExsYe2NWpNqk`
- **Bitcoin (BTC)**: `bc1qs2nwumk24fjtk574f0awaxnh7jl9v7shrd5yw7`

