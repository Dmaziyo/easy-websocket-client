import { describe, expect, test, vi } from 'vitest';
import { singleton } from '../src/utils';
import WebSocketClient from '../src/socket';
import { WebSocket } from 'ws';

describe('test easy-ws-client', () => {
  test('singleton', async () => {
    class A {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      say() {
        console.log(this.name);
      }
    }
    const SA = singleton(A);
    const a = new SA('aaa');
    a.say();
    // SA.reset();
    const b = new SA('bbb');
    b.say();
  })
  test('singleton decorator', async () => {
    @singleton
    class A {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      say() {
        console.log(this.name);
      }
    }
    const a = new A('aaa');
    a.say();
    // SA.reset();
    const b = new A('bbb');
    b.say();
  })

  test('websocket client', async () => {
    const ws = new WebSocketClient('wss://echo.websocket.org', {}, WebSocket);
    let isOpened = false;
    let receivedMessage = null;

    // 监听连接打开事件
    ws.on('open', () => {
      isOpened = true;
      // 连接成功后发送测试消息
      ws.send('Hello WebSocket!');
    });

    // 监听消息接收事件
    ws.on('message', (data) => {
      console.log('received message:', data);
      receivedMessage = data;
    });

    // 监听错误事件
    ws.on('error', (error) => {
      console.error('websocket error:', error);
    });

    // 监听连接关闭事件
    ws.on('close', (event) => {
      console.log('websocket closed:', event);
    });

    // 建立连接
    ws.connect();

    // 等待连接建立和消息接收
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isOpened && receivedMessage) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 2_000);

      // 设置超时时间避免测试永远等待
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });

    // 测试关闭连接
    ws.close();

    // 清理所有事件监听器
    ws.offAll();

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2_000);
    });

    expect(isOpened).toBe(true);
    expect(receivedMessage).toBe('Hello WebSocket!');
  })

  test('manual close while connecting does not reconnect', async () => {
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      static CONNECTING = 0;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockWebSocket.CONNECTING;
      onclose: ((event: WebSocketEventMap['close']) => void) | null = null;
      onopen: ((event: WebSocketEventMap['open']) => void) | null = null;
      onerror: ((event: WebSocketEventMap['error']) => void) | null = null;
      onmessage: ((event: WebSocketEventMap['message']) => void) | null = null;

      constructor(_url: string, _protocols?: string | string[]) {
        MockWebSocket.instances.push(this);
      }

      send(_data: string | ArrayBufferLike | ArrayBufferView | Blob) {}

      close(code = 1000, reason = '') {
        if (this.readyState === MockWebSocket.CLOSED) {
          return;
        }

        const wasConnecting = this.readyState === MockWebSocket.CONNECTING;
        this.readyState = MockWebSocket.CLOSING;

        setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          this.onclose?.({
            code: wasConnecting ? 1006 : code,
            reason
          } as WebSocketEventMap['close']);
        }, 0);
      }
    }

    vi.useFakeTimers();

    try {
      const ws = new WebSocketClient(
        'ws://test',
        {
          reconnectInterval: 100,
          maxReconnectAttempts: 5
        },
        MockWebSocket as unknown as typeof WebSocket
      );

      ws.connect();
      expect(MockWebSocket.instances).toHaveLength(1);

      ws.close();
      vi.runAllTimers();

      expect(MockWebSocket.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  })
})
