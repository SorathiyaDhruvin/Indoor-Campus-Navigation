# 🧭 Indoor Campus Navigation – Parul University

An immersive **360° Virtual Campus Tour** for Parul University that lets students, faculty, and visitors explore indoor spaces and navigate between rooms using interactive panoramic hotspots — no physical map required.

🔗 **Live Demo:** [indoor-campus-navigation.vercel.app](https://indoor-campus-navigation.vercel.app/)

---

## 📌 Overview

Indoor Campus Navigation is a web-based virtual reality experience built to help people digitally explore Parul University's buildings — starting with the **CV Raman Center** (a Center of Excellence for Advanced Computational Skills & Research). The platform combines 360° panoramic photography with an interactive navigation system, allowing users to "walk through" the campus and find their way to specific labs, rooms, or facilities.

This project was built as part of an **AR/VR internship at Parul University**.

---

## ✨ Features

- **360° Panoramic Scenes** – Multiple immersive, click-and-drag panoramas of real campus locations.
- **Interactive Hotspots** – Arrow-based navigation points to move between connected scenes.
- **Floor & Destination Selector** – Choose a floor and destination to get guided directions (e.g., *"Go straight ahead → L-107 XR Lab"*).
- **Path Visualization** – "Show Path" / "Clear" controls to highlight the route to a chosen destination.
- **Grid / All Scenes View** – Quickly jump to any scene from a visual overview.
- **Info Hotspots** – Tap info icons within a scene to view details about that location.
- **Keyboard Shortcuts** for power users:
  | Key | Action |
  |-----|--------|
  | `N` | Navigate |
  | `G` | Grid View |
  | `H` | Help |
  | `F` | Fullscreen |
  | `Esc` | Close |
- **Marketing / Landing Page** – A separate home page introducing the project with stats (panoramic scene count, 360° immersive view, 100% interactivity) and an "Enter 360° Experience" CTA.
- **Scalable Scene Structure** – Organized by floor (e.g., `assets/ground floor/`) to support multi-floor expansion.

---

## 🖥️ Pages

| Page | Description |
|------|--------------|
| **Home** | Landing page with project intro, stats, and entry point to the experience |
| **About University** | Information about Parul University |
| **Indoor Campus Navigation** | The core 360° navigation experience |
| **Features** | Highlights of what the platform offers |

---

## 🗂️ Project Structure

```
Indoor-Campus-Navigation/
├── assets/
│   ├── ground floor/          # Panoramic scenes for the ground floor
│   ├── Network_architecture.png
│   ├── arrow.png              # Navigation hotspot icon
│   ├── holoboard.png
│   ├── hololens.png
│   ├── irusu_player.png
│   ├── meta.png
│   └── parul university.png   # University logo
├── index.html                  # 360° navigation experience
├── home.html                   # Landing / marketing page
└── ...                         # Supporting scripts & styles
```

> Note: Some floors are still being captured and will show a **"Coming Soon"** message until their 360° images are uploaded.

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **360° Panorama Rendering:** JavaScript-based panoramic viewer with hotspot navigation
- **Hosting / Deployment:** [Vercel](https://vercel.com/)
- **Version Control:** Git & GitHub

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Edge, Firefox)
- (Optional) [Node.js](https://nodejs.org/) if running a local dev/build server

### Run Locally
```bash
# Clone the repository
git clone https://github.com/SorathiyaDhruvin/Indoor-Campus-Navigation.git

# Move into the project directory
cd Indoor-Campus-Navigation

# Open index.html directly in your browser
# or serve it locally, e.g.:
npx serve .
```

Then open `http://localhost:3000` (or the port shown) in your browser.

---

## 🗺️ How to Navigate the Experience

1. Click **"Enter 360° Experience"** on the home page.
2. Use your mouse (or finger on mobile) to **click & drag** to look around.
3. **Scroll or pinch** to zoom in/out.
4. Click the **arrow hotspots** to move between connected scenes.
5. Use the **Navigate** panel to select a floor and destination, then hit **Show Path** to see directions.
6. Click **info icons** for details about a specific location.

---

## 🔮 Roadmap

- [ ] Add 360° coverage for remaining floors and buildings
- [ ] Expand destination database with more rooms/labs
- [ ] Add multilingual support
- [ ] Improve mobile/touch navigation experience
- [ ] Add search functionality for destinations

---

## 👤 Author

**Dhruvin Sorathiya**
B.Tech CSE (AI Specialization), Parul University
AR/VR Intern, Parul University

---

## 📄 License

This project is intended for educational and institutional use by Parul University. Add a license of your choice (e.g., MIT) if you plan to open-source it further.
