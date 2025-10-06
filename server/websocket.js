const WebSocket = require('ws');

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server
    });
    
    this.clients = new Map(); // userId -> WebSocket
    this.adminClients = new Set(); // Set of admin WebSockets
    
    this.setupEventHandlers();
    this.setupKeepAlive();
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('🔌 Nuova connessione WebSocket');
      
      // Aggiungi proprietà isAlive come nel repository plot
      ws.isAlive = true;
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('❌ Errore parsing messaggio WebSocket:', error);
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ Errore WebSocket:', error);
      });
    });
  }

  setupKeepAlive() {
    // Keep-alive come nel repository plot (ogni 30 secondi)
    this.keepAliveInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('🔌 Terminando connessione inattiva');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'join':
        this.handleJoin(ws, data);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.log('📨 Messaggio WebSocket non gestito:', data.type);
    }
  }

  handleJoin(ws, data) {
    const { userId, role } = data;
    
    if (userId) {
      ws.userId = userId;
      ws.role = role;
      this.clients.set(userId, ws);
      
      if (role === 'admin') {
        this.adminClients.add(ws);
      }
      
      console.log(`👤 Utente ${userId} (${role}) connesso`);
      
      // Invia conferma di connessione
      ws.send(JSON.stringify({
        type: 'joined',
        userId,
        role
      }));
    }
  }

  handleDisconnect(ws) {
    if (ws.userId) {
      this.clients.delete(ws.userId);
      
      if (ws.role === 'admin') {
        this.adminClients.delete(ws);
      }
      
      console.log(`👤 Utente ${ws.userId} disconnesso`);
    }
  }

  // Broadcast a tutti i client
  broadcastToAll(data) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Broadcast solo agli admin
  broadcastToAdmins(data) {
    const message = JSON.stringify(data);
    this.adminClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Broadcast a un utente specifico
  broadcastToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }

  // Broadcast a tutti tranne un utente specifico
  broadcastToOthers(excludeUserId, data) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.userId !== excludeUserId) {
        client.send(message);
      }
    });
  }

  // Statistiche connessioni
  getStats() {
    return {
      totalClients: this.wss.clients.size,
      adminClients: this.adminClients.size,
      connectedUsers: Array.from(this.clients.keys())
    };
  }

  // Cleanup
  destroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    this.wss.close();
  }
}

module.exports = WebSocketManager;
