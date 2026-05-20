# Parul University — 360° Indoor Campus Navigation

An immersive, browser-based 360° virtual tour of **Parul University** (Vadodara, Gujarat), built with the Pannellum panorama viewer. Students, parents, and visitors can explore campus buildings, labs, and corridors interactively — from any device, with no installation required.

🌐 **Live Demo:** [test-nine-sepia-35.vercel.app](https://test-nine-sepia-35.vercel.app)

---

## What It Does

The platform lets users virtually walk through the ground floor of the CV Raman Center at Parul University. Starting from the main entrance, users navigate through corridors and into individual labs by clicking arrow hotspots embedded in the 360° panoramas. Info hotspots along the way reveal detailed information — equipment specs, lab purposes, and skills developed — through popup cards.

---

## Features

- **360° Panoramic Viewer** — Full spherical navigation powered by [Pannellum](https://pannellum.org/), with click-and-drag, scroll zoom, and touch pinch support
- **Arrow Hotspot Navigation** — Directional hotspots (up, left, right, upper-left, upper-right) guide users through scenes with animated indicators
- **Info Hotspots & Popups** — Click info icons to read detailed descriptions of labs, equipment, and facilities (with images where available)
- **Indoor Navigation Panel** — Select a floor and destination from dropdowns; the system shows the route with step-by-step direction banners
- **Direction Banner** — Step-by-step guidance overlay with previous/next controls when navigating to a destination
- **Grid View** — Browse all scenes as a thumbnail gallery from the top bar
- **Fullscreen Mode** — One-click fullscreen toggle for an immersive experience
- **Loading Screen** — Animated loader with progress bar on startup
- **Keyboard Shortcuts** — `N` Navigate, `G` Grid view, `H` Help, `F` Fullscreen, `Esc` Close
- **Home Landing Page** — Marketing-style landing page with About University, platform explanation, features section, and a CTA to enter the tour
- **Mobile & Desktop Responsive** — Works on phones, tablets, and desktops

---

## Campus Locations Covered

The tour currently covers the **Ground Floor** of the CV Raman Center across 58 scenes, including:

- CV Raman Center Entrance, Lobby, and Corridors A–L
- **L-102 AI & Machine Learning Lab** — GPU workstations, TensorFlow/PyTorch environment
- **Apple Authorized Training Center** — iMac M1, iPad Pro, iPhone 14 Pro, MacBook Pro
- **L-103 Cloud Computing Lab** — AWS, Azure, GCP, Docker/Kubernetes
- **L-104 Cyber Security Lab** — SIEM tools, IDS/IPS, threat monitoring dashboards
- **Data Center** — 12 server racks including ISP connectivity, CCTV NVR storage, Palo Alto Firewall, CDAC Supercomputer, SAN storage, and GPU tower servers
- **System Support Cell** — University-wide IT infrastructure (3300+ workstations, 1500+ IP cameras, 150+ computer labs)
- **iOS Lab / Apple Lab** — Hands-on iOS development stations
- Various **Lab Sections A–J**, corridors, and the **Seminar Hall**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Panorama Viewer | [Pannellum 2.5.6](https://pannellum.org/) (CDN) |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Fonts | Google Fonts — Inter, Poppins |
| Deployment | Vercel |
| Scene Data | `config.json` (Pannellum config), `scenes.json` (simple scene index) |

No frameworks, no build step, no dependencies to install — it runs as a static site.

---

## Project Structure

```
├── home.html           # Landing page (About, Features, CTA)
├── home.css            # Landing page styles
├── home.js             # Landing page interactivity (scroll animations, counter)
├── index.html          # 360° tour viewer (main app)
├── style.css           # Tour viewer styles
├── script.js           # Tour logic (scene loading, hotspots, navigation, UI)
├── config.json         # Pannellum scene config — all scenes with hotspot coords and info
├── scenes.json         # Linear scene index (for grid view and indoor navigation)
├── settings.json       # App settings (default scene, buffer, preload, image paths)
├── vercel.json         # Vercel deployment config
└── assets/
    ├── parul university.png    # University logo
    └── ground floor/           # 360° panorama images (photo1.jpg … photo58.jpg)
```

---

## How It Works

### Scene System
Scenes are defined in `config.json` with Pannellum's multi-scene format. Each scene has a panorama image path, initial field-of-view (`hfov`), north offset, and an array of hotspots:

- **Navigation hotspots** (`cssClass: "nav-btn"`) — arrow buttons that call `script.js`'s scene-transition handler with the target scene ID and camera yaw
- **Info hotspots** (`type: "info"`) — trigger a popup with a title, HTML description, and optional image

### Indoor Navigation
The `Indoor Navigation` panel (opened with the `N` key or the map button) lets users pick a floor and destination. The JavaScript then computes the path through the scene graph and displays step-by-step direction instructions in the direction banner.

### Image Loading
`settings.json` controls the default starting scene, how many scenes to buffer, and how many to preload, keeping performance smooth even with many 360° images.

---

## Getting Started

This is a fully static project — no server or build step needed.

### Run Locally

```bash
# Clone the repo
git clone https://github.com/SorathiyaDhruvin/test.git
cd test

# Open in a browser
# Option 1: use any static file server
npx serve .

# Option 2: VS Code Live Server extension
# Right-click index.html → Open with Live Server

# Option 3: Python
python -m http.server 8080
```

Then open `http://localhost:8080/home.html` for the landing page or `http://localhost:8080/index.html` to go straight into the tour.

> **Note:** Panorama images in `assets/ground floor/` must be present for the tour to load. If you're cloning for development, ensure the image assets are included.

### Deploy to Vercel

The repo includes a `vercel.json` config. To deploy your own instance:

```bash
npm install -g vercel
vercel --prod
```

---

## Adding New Scenes

To add a new 360° location:

1. Add the panorama image to `assets/ground floor/` (`.jpg` or `.webp`)
2. Add a new scene entry in `config.json` with hotspot coordinates and optional info popups
3. Add a matching entry in `scenes.json` with `next` and `prev` scene IDs for the linear navigation path
4. If adding a new floor, update the floor dropdown logic in `script.js`

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `N` | Open Indoor Navigation panel |
| `G` | Open Grid (scene gallery) |
| `H` | Open Help panel |
| `F` | Toggle Fullscreen |
| `Esc` | Close any open panel |

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Touch navigation is supported on mobile and tablet. No WebVR/WebXR required — runs in a standard browser tab.

---

## License

© 2026 Parul University 360 Indoor Campus Navigation Project. All rights reserved.
