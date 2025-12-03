# EcoVision

EcoVision is a full-stack waste-detection platform that combines a Node.js + Express backend with a React + Vite + Tailwind CSS frontend. This project scaffold sets up everything you need to start developing computer-vision powered waste classification features.

## Getting Started

### 1. Bootstrap the project

```bash
npm install
npm run install:all
```

The first command installs root-level tooling (`concurrently`). The second command installs all backend and frontend dependencies in one go.

### 2. Run everything locally

1. `npm run dev:backend` – start the Express API with nodemon.
2. `npm run dev:frontend` – start the Vite dev server for the React app.
3. (Optional) `npm run dev:all` – run both servers together via `concurrently`.
4. Open `http://localhost:3000` in your browser (or the port Vite reports if different).

> Tip: Vite defaults to `5173`, but you can proxy through another dev server or update `frontend/vite.config.js` to match `3000` if that works better with your setup.

### Camera + mobile considerations

- **Camera permissions**: When the browser prompts for camera access, choose “Allow”. On mobile Safari/Chrome ensure the site is served over `https://` or `localhost` due to camera security rules.
- **Backend URL on mobile**: Set `VITE_API_BASE` in `frontend/.env` to your computer’s LAN IP (e.g., `http://192.168.1.25:5000`) so phones on the same Wi‑Fi can reach the backend.
- **Future HTTPS**: Add a reverse proxy (ngrok, Caddy, or Nginx) or generate local certificates for Vite/Express to satisfy camera requirements on remote devices.

## Project Structure

```
.
├── backend/          # Node.js + Express API
├── frontend/         # React + Vite + Tailwind UI
├── package.json      # Root scripts for orchestrating both apps
└── README.md
```

### Backend entry point

`backend/server.js` loads environment variables and starts the Express instance defined inside `backend/src/server.js`. The app wires up middleware (JSON parsing, CORS, logging), the `/api/health` status route, and the YOLO-powered `/api/detect` route.

### Frontend entry point

`frontend/src/main.jsx` hydrates the React application into `index.html`, wraps global providers, and renders the root `App` component. The `App` component (in `frontend/src/App.jsx`) houses the initial dashboard layout where waste-detection results, camera feeds, and analytics will live.

## Tailwind CSS

Tailwind is already configured inside the `frontend` app via `tailwind.config.js` and `postcss.config.js`. Global styles and Tailwind directives live in `frontend/src/index.css`.

## Waste detection API

1. Place your ONNX model at `backend/models/yolov8-waste.onnx` (or point `YOLO_MODEL_PATH` to another file via `.env`).
2. From `/backend`, copy `.env.example` to `.env` and tweak:

```
PORT=5000
YOLO_MODEL_PATH=./models/yolov8-waste.onnx
DETECTION_THRESHOLD=0.25
NMS_IOU_THRESHOLD=0.45
MAX_DETECTIONS=1
```

3. Install deps and start the watcher:

```bash
cd backend
npm install
npm run dev
```

4. Send a POST to `http://localhost:5000/api/detect` with JSON:

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSk..."
}
```

The route also accepts multipart uploads (`image` field) but base64 is the primary path.

### Response payload

```
{
  "model": "yolov8-waste",
  "count": 2,
  "detections": [
    {
      "item": "plastic bottle",
      "confidence": 0.92,
      "type": "Plastic"
    }
  ],
  "insights": [
    {
      "detected_item": "Plastic Bottle",
      "type": "Plastic",
      "dispose": "Rinse, flatten, and place in the mixed recycling bin.",
      "reduce": ["Switch to refillable bottles or hydration stations.", "..."],
      "reuse": ["Convert into planters or seed starters.", "..."],
      "recycle": ["Drop at curbside recycling or supermarket collection points.", "..."],
      "confidence": 0.92
    }
  ]
}
```

The insight objects merge detections with `backend/waste_guide.json`, which stores disposal, reduce, reuse, and recycle guidance for each waste class. Update this guide as you expand your label set.

