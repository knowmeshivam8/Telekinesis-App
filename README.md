# Telekinesis

A browser-based AR-style demo that blends webcam hand tracking with Three.js particle effects to create a neon telekinesis experience.

## Overview

Antigravity is a static web app that detects hand gestures using MediaPipe Hands and overlays responsive visual effects on a live camera feed.

It simulates:
- open palm repulsion
- fist gravity attraction
- Spidey pose web energy
- two-hand energy ball arcs
- glowing particle trails, shockwaves, and palm aura

## Highlights

- **Real-time hand tracking** in the browser
- **Three.js rendering** with custom shaders
- **Neon sci-fi UI** and particle motion
- **Live webcam background** with AR-style overlay
- **Responsive experience** for desktop and mobile screens

## Files

- `index.html` — page layout, UI overlays, and script includes
- `style.css` — dark neon theme, HUD, loading overlay, and instructions
- `app.js` — Three.js scene, shaders, particle system, gesture logic, and MediaPipe integration

## Run locally

1. Open a terminal in the project folder.
2. Start a local server:

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000` in your browser.

## Project pitch

Antigravity is an interactive web demo that turns a webcam into a handheld telekinetic stage. It uses hand pose detection to push, pull, and connect neon particles in real time, delivering a polished AR-style effect without any native app install.
