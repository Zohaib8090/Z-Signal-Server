# Z-Signal-Server

Z Chat WebSocket signal server with Socket.io and self-ping to stay alive on Render free tier.

## Deploy to Render
1. Connect this repo to a new Render Web Service
2. Build: `npm install` | Start: `node server.js`
3. Env vars: `RENDER_EXTERNAL_URL=https://your-service.onrender.com`
4. Update Z Chat: `VITE_SIGNALING_SERVER=https://your-service.onrender.com`
