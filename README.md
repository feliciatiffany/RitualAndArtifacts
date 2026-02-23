# RitualAndArtifacts

**Elevator Bet Game** — A multiplayer interactive betting game where players guess which elevator will arrive first. Built for Parsons as part of the Ritual and Artifacts course.

## Overview

Players enter their name, bet on one of four elevators (Blue, Red, Yellow, Teal), and a controller (admin) determines which elevator "arrives." The game supports real-time multiplayer via Firebase, with optional Bluetooth light sensors to trigger results automatically.

## Project Structure

```
public/
├── index.html      # Main game UI (player flow)
├── admin.html      # Controller terminal (manual + sensor trigger)
├── stats.html      # Leaderboard & statistics
├── app.js          # Game logic, Firebase sync
├── style.css       # Styling
├── bgm/            # Background music manager
│   ├── music-manager.js
│   └── *.wav, *.mp3  # Audio files
└── images/         # UI assets (elevators, backgrounds)
```

## Setup

1. **Firebase**: The project uses Firebase Firestore. Configure `firebase.json` and `.firebaserc` for your project.

2. **Deploy**:
   ```bash
   firebase deploy
   ```

3. **Local preview**:
   ```bash
   firebase serve
   ```
   Or use any static server (e.g. `npx serve public`).

## Game Flow

1. **Start** → Click to continue, optional RANKING popup (QR to stats)
2. **Name** → Enter name (with suggestions from past players)
3. **Bet** → Choose elevator 1–4
4. **Confirm** → YES to place bet
5. **Thanks** → Brief celebration
6. **Waiting** → More players can join; controller triggers result
7. **Results** → Winners/losers + QR codes to stats & controller

## Controller (admin.html)

- **Manual mode**: Tap which elevator arrived
- **Sensor mode**: Connect Bluetooth light sensors; trigger when brightness exceeds threshold
- BGM volume config, history, force reset

## Tech Stack

- Vanilla JS, Firebase Firestore
- Bangers font, comic-style UI
- Web Bluetooth API (sensor mode)

## Assets Checklist

- **Images** (`public/images/`): SVG placeholders included. Replace with custom PNGs for production.
- **BGM** (`public/bgm/`): Add audio files per `bgm/README.md` (MAIN.wav, ALTERNATE.mp3, etc.) for full music support.
