const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
    'https://z-chat-mini-cdn-oregon.onrender.com',
    'https://zchat-cdn-sg.onrender.com',
    'https://zchat-cdn-ohio.onrender.com',
    'https://zchat-cdn-fra.onrender.com',
    'https://zchat-cdn-oregon.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
];

app.use(cors({ origin: ALLOWED_ORIGINS, optionsSuccessStatus: 200 }));

const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('user-online', (uid) => {
        if (!uid) return;
        onlineUsers.set(uid, socket.id);
        socket.data.uid = uid;
        socket.join(`user:${uid}`);
        socket.broadcast.emit('user-status', { uid, online: true });
        console.log(`[Presence] ${uid} online`);
    });

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', { socketId: socket.id });
    });

    socket.on('call-offer', ({ targetUid, offer, callId, callerName, callType }) => {
        const t = onlineUsers.get(targetUid);
        if (t) io.to(t).emit('call-offer', { offer, callId, callerName, callType, callerUid: socket.data.uid });
    });

    socket.on('call-answer', ({ targetUid, answer, callId }) => {
        const t = onlineUsers.get(targetUid);
        if (t) io.to(t).emit('call-answer', { answer, callId });
    });

    socket.on('ice-candidate', ({ targetUid, candidate, callId }) => {
        const t = onlineUsers.get(targetUid);
        if (t) io.to(t).emit('ice-candidate', { candidate, callId });
    });

    socket.on('call-end', ({ targetUid, callId }) => {
        const t = onlineUsers.get(targetUid);
        if (t) io.to(t).emit('call-end', { callId });
    });

    socket.on('ping-check', () => socket.emit('pong-check'));

    socket.on('disconnect', (reason) => {
        const uid = socket.data.uid;
        if (uid) {
            onlineUsers.delete(uid);
            socket.broadcast.emit('user-status', { uid, online: false });
            console.log(`[Presence] ${uid} offline - ${reason}`);
        }
    });
});

app.get('/ping', (req, res) => res.json({ status: 'ok', timestamp: Date.now(), connections: onlineUsers.size }));
app.get('/health', (req, res) => res.json({ ok: true, onlineUsers: onlineUsers.size }));

// Self-ping every 14 min - keeps Render free tier awake
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3002}`;
setInterval(async () => {
    try {
        await axios.get(`${SELF_URL}/ping`, { timeout: 10000 });
        console.log(`[Keep-alive] Self-ping OK - ${new Date().toISOString()}`);
    } catch (e) {
        console.warn('[Keep-alive] Self-ping failed:', e.message);
    }
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Z Signal Server running on port ${PORT}`);
    console.log(`Self-ping every 14 min -> ${SELF_URL}/ping`);
});
