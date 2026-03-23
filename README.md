# Webion AR — Live Try-On

## Project Structure

```
client/          → React (Vite) frontend
server/          → Express + Python (Flask) backend
docs/            → Agent guide documents for each development track
```

## Quick Start

### Frontend
```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

### Backend (Node.js)
```bash
cd server
npm install
node app.js      # http://localhost:3001
```

### Backend (Python Segmentation Service)
```bash
cd server/scripts
pip install -r requirements.txt
python segment_service.py    # http://localhost:5001
```

### Environment Variables
Copy `server/.env` and update values as needed.
Set `VITE_API_URL` and `VITE_AGORA_APP_ID` in `client/.env`.

## Development Tracks

| Track | Agent | Branch | Guide |
|---|---|---|---|
| A+C (Session + Capture) | Agent 1 | `feature/track-a-c` | `docs/TRACK_A_C_GUIDE.md` |
| B (AR Overlay) | Agent 2 | `feature/track-b` | `docs/TRACK_B_GUIDE.md` |
| D (Backend) | Agent 3 | `feature/track-d` | `docs/TRACK_D_GUIDE.md` |
