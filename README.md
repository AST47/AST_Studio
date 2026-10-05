<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <h1>AST Studio (Voice_Maker)</h1>
  <p><strong>Professional Neural Text-to-Speech & Voice Creation Platform powered by Gemini 3.8 TTS</strong></p>
</div>

---

## 🎙️ Overview

**AST Studio** (Repository: `Voice_Maker`) is a full-featured neural speech production platform built with Google Gemini's state-of-the-art TTS audio generation models (`gemini-3.8-flash-tts` & `gemini-3.8-flash-lite-tts`).

It provides real-time studio-grade speech generation, expressive voice directing, and multi-speaker podcast/story scene creation with 24kHz studio WAV audio exports.

---

## ✨ Features

- **Solo Studio**:
  - Direct speech synthesis with speed, pitch, and expressive styling.
  - One-click expressive vocal burst chips (`<laugh>`, `<gasp>`, `<sigh>`, `<yawn>`, `<cough>`, `<throat-clearing>`, `|yeah|`, `|mhm|`).
  - AI Script Assistant: polish, add vocal bursts, format into podcasts, or adjust tone using Gemini Flash.
- **Dialogue Studio**:
  - Full multi-speaker conversational scene builder (Speaker 1 + Speaker 2).
  - Assign distinct voices, styles, and turn-by-turn dialogue lines.
  - Synthesizes realistic seamless conversations with natural pauses and cadence.
- **Voice Catalog**:
  - **Adult Neural Voices**: *Puck* (engaging & expressive), *Charon* (deep & resonant), *Kore* (calm & articulate), *Fenrir* (rich & authoritative), *Zephyr* (warm & balanced).
  - **Kid Personas**: *Leo* (energetic 8y boy), *Mia* (sweet 7y girl), *Toby* (curious 5y toddler), *Lily* (gentle 5y sister).
  - One-click instant audio audition player.
- **Soundboard & Master Audio Deck**:
  - High-precision waveform visualizer, audio scrubbing, variable playback rates (0.5x to 2.0x), and loop controls.
  - History soundboard with one-click WAV file downloads and local storage persistence.
- **Quota & Reliability Engine**:
  - Real-time rolling Requests-Per-Minute (RPM) HUD monitor.
  - Automatic fallback: if high-demand quota limits are hit on `flash-tts`, it automatically retries with `flash-lite-tts` seamlessly.
  - Exact retry countdown timers synced to Google Gemini API quota reset windows.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm or bun
- A Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/AST47/Voice_Maker.git
cd Voice_Maker

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY in .env
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend / Proxy**: Express, Node.js, Vite middleware
- **AI & Audio Engine**: Google GenAI SDK (`@google/genai`), Gemini 3.8 Flash TTS
- **Audio Processing**: Web Audio API (PCM 24kHz decode, WAV header synthesis)

