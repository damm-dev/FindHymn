const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ip = require('ip');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
const AUTH_KEYWORD = process.env.AUTH_KEYWORD || '';

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/ip', (req, res) => {
    res.json({ ip: ip.address(), port: PORT });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initial Auth Check
    socket.emit('auth_required', { required: AUTH_ENABLED });

    // Handle Login
    socket.on('login', (keyword) => {
        if (!AUTH_ENABLED) {
            socket.emit('auth_result', { success: true });
            return;
        }
        if (keyword === AUTH_KEYWORD) {
            socket.authenticated = true;
            socket.emit('auth_result', { success: true });
        } else {
            socket.emit('auth_result', { success: false });
        }
    });

    // Identify client type
    socket.on('register', (type) => {
        // Desktop is always trusted (it runs the server generally, but here it connects as localhost)
        // If coming from localhost, maybe auto-trust? 
        // For now, let's assume 'desktop' client (renderer) bypasses or handles auth?
        // Actually renderer.js connects but doesn't usually send 'command's for itself to handle.
        // It RECEIVES commands.
        // But if renderer sends 'status', it should be allowed.

        socket.join(type); // 'desktop' or 'mobile'
        console.log(`Client registered as: ${type}`);
    });

    // Relay commands from Mobile to Desktop
    socket.on('command', (data) => {
        // Auth Check
        if (AUTH_ENABLED && !socket.authenticated) {
            console.log("Unauthorized command attempt");
            socket.emit('auth_error', 'Authentication required');
            return;
        }

        console.log('Command received:', data);
        io.to('desktop').emit('command', data);
    });

    // Relay status from Desktop to Mobile (optional, for sync)
    socket.on('status', (data) => {
        // Desktop sending status updates - usually trusted or we can check IP/origin if needed
        // For simplicity, allow status broadcasting from anyone or lock strictly?
        // Let's assume desktop client handles this.
        io.to('mobile').emit('status', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://${ip.address()}:${PORT}`);
});
