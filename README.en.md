# Easy-Websocket-Client

**[中文文档](https://github.com/Dmaziyo/easy-websocket-client/blob/main/README.md)**

## Introduction

`Easy-Websocket-Client` is a library for managing WebSocket connections, providing features such as automatic reconnection, heartbeat messages, and event handling.

## Installation

```bash
# Using npm
npm install easy-websocket-client

# Using yarn
yarn add easy-websocket-client

# Using pnpm
pnpm add easy-websocket-client
```

## ⚠️ Breaking Changes

**v1.0.0** removes callback options from constructor and uses event listener pattern instead:

- **Removed**: `onOpen`, `onClose`, `onMessage`, `onError` constructor options
- **Added**: Use `client.on()`, `client.once()`, `client.off()` methods to listen to events
- **Added**: `jsonAble` option for automatic JSON message parsing
- **Added**: `WebSocketImpl` parameter for Node.js support, pass WebSocket from 'ws' library in Node.js environment
- **Improved**: Better TypeScript type support

## Basic Usage

### Create a WebSocket Connection

```typescript
import WebSocketClient from 'easy-websocket-client';

// Create client instance
const client = new WebSocketClient('wss://example.com/socket', {
  showLog: true,
  reconnectInterval: 2000,
  heartbeatInterval: 10000,
  heartbeatMessage: 'ping',
  maxReconnectAttempts: 5,
  protocols: ['chat'],
  connectResend: true,
  jsonAble: true // Auto parse JSON messages
});

// Add event listeners
client.on('open', () => console.log('Connection opened'));
client.on('close', (e) => console.log('Connection closed', e));
client.on('message', (message) => console.log('Received message', message));
client.on('error', (error) => console.error('Error occurred', error));

// Start connection
client.connect();

// Send message
client.send({ type: 'chat', content: 'Hello World' });

// Close connection
client.close();
```

## Singleton Pattern Usage

When doing a secondary encapsulation of `easy-websocket-client`, you can use the singleton pattern to ensure that the same WebSocket connection is used across different pages, avoiding duplicate connections.
Note: Using a singleton allows you to instantiate in all pages or lifecycle hooks, so you don’t need to handle too many reconnection or reconnection-after-refresh scenarios—these will be handled automatically.

### Singleton via Decorator

```typescript
import WebSocketClient, { singleton } from 'easy-websocket-client';

// Define the type of message you want to receive
interface Message {
  type: string;
  data: any;
}

@singleton
class MyWebSocketClient extends WebSocketClient {
  constructor() {
    // Handle url
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    // Process protocol and host for the url
    const baseURL = import.meta.env.DEV
      ? "ws://" + import.meta.env.VITE_WS_HOST + ":" + import.meta.env.VITE_PORT + "/ws"
      : import.meta.env.VITE_API_URL.includes("ws") || import.meta.env.VITE_API_URL.includes("http")
        ? import.meta.env.VITE_API_URL
        : `${protocol}://${host}${import.meta.env.VITE_API_URL.includes("/") ? "" : "/"}${import.meta.env.VITE_API_URL}`;

    super(baseURL, {
      heartbeatMessage: JSON.stringify({ type: 'HEARTBEAT', textMsg: "ping" }),
      heartbeatInterval: 10000,
      maxReconnectAttempts: 3,
      connectResend: true,
      jsonAble: true // Auto parse JSON
    });

    // Use event listeners instead of constructor options
    this.on('message', (data: Message) => {
      // Handle received message here (recommend using pub/sub pattern)
      console.log('Received:', data);
    });

    this.on('open', (e) => {
      // Handle successful connection here (recommend using pub/sub pattern)
      console.log('Connected:', e);
    });

    this.on('close', (e) => {
      // Handle connection close here (recommend using pub/sub pattern)
      console.log('Disconnected:', e);
    });

    this.on('error', (e) => {
      // Handle connection error here (recommend using pub/sub pattern)
      console.error('WebSocket error:', e);
    });

    this.connect();
  }

  public close = () => {
    super.close();
    MyWebSocketClient.reset();
  };
}

const clientInstance = new MyWebSocketClient();
```

### Singleton via Higher-Order Function (when decorators are not supported)

```typescript
import WebSocketClient, { singleton } from 'easy-websocket-client';

const SingletonWebSocketClient = singleton(WebSocketClient);

const clientInstance = new SingletonWebSocketClient('wss://example.com/socket', {
  jsonAble: true,
  connectResend: true
});

// Add event listeners
clientInstance.on('message', (data) => {
  console.log('Message received:', data);
});

clientInstance.connect();
```

## API Reference

### Constructor Options

```typescript
interface WebSocketClientOptions {
  showLog?: boolean;              // Whether to show logs
  reconnectInterval?: number;     // Reconnect interval (ms), default: 1000
  heartbeatInterval?: number;     // Heartbeat interval (ms), default: 10000
  heartbeatMessage?: string;      // Heartbeat message, default: "ping"
  maxReconnectAttempts?: number;  // Max reconnect attempts, default: 0 (unlimited)
  protocols?: string[];           // WebSocket protocols
  connectResend?: boolean;        // Resend messages after reconnect, default: false
  jsonAble?: boolean;             // Auto parse JSON, default: false
}
```

### Event Types

- `open`: Triggered when connection is established
- `close`: Triggered when connection is closed
- `message`: Triggered when message is received
- `error`: Triggered when an error occurs

### Methods

- `connect()`: Establish connection
- `send(message)`: Send message
- `close()`: Close connection
- `on(event, listener)`: Add event listener
- `once(event, listener)`: Add one-time event listener
- `off(event, listener)`: Remove event listener
- `offAll()`: Remove all event listeners

## 📝 Contribution Guide

You are welcome to submit `issues` or `pull requests` to help improve `Easy-Websocket-Client` together.

## 📄 License

MIT


