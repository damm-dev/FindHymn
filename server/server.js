const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
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

function getBestLocalIP() {
    const interfaces = os.networkInterfaces();
    const virtualPattern = /vethernet|wsl|virtualbox|vmware|vbox|hyper-v|docker|pseudo|loopback|tap|tun|vpn|hamachi|radmin|zerotier/i;
    const candidates = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            const family = iface.family === 4 ? 'IPv4' : iface.family;
            if (family !== 'IPv4' || iface.internal) continue;
            const addr = iface.address;
            if (!addr || addr.startsWith('169.254.')) continue;

            const isVirtual = virtualPattern.test(name) || addr === '192.168.56.1';
            const isPreferredName = /wi-?fi|wlan|wireless|ethernet|eth|en\d/i.test(name);
            let priority = 50;
            if (isVirtual) priority = 100;
            else if (isPreferredName && addr.startsWith('192.168.')) priority = 1;
            else if (addr.startsWith('192.168.')) priority = 5;
            else if (isPreferredName) priority = 10;
            else if (addr.startsWith('10.')) priority = 20;

            candidates.push({ addr, priority });
        }
    }

    candidates.sort((a, b) => a.priority - b.priority);
    if (candidates.length > 0) return candidates[0].addr;
    return ip.address() || 'localhost';
}

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/ip', (req, res) => {
    res.json({ ip: getBestLocalIP(), port: PORT });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initial Auth Check
    socket.emit('auth_required', { required: AUTH_ENABLED });

    // Handle Login
    socket.on('login', (keyword) => {
        if (!AUTH_ENABLED) {
            socket.authenticated = true;
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
        if (type === 'desktop') {
            socket.authenticated = true;
        }
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
        io.to('mobile').emit('status', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://${getBestLocalIP()}:${PORT}`);
});
