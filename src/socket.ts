import EventEmitter from "eventemitter3";
import { WebSocketReadyState } from "./enum";
import { WebSocketClientEvent, WebSocketClientOptions, type WebSocketClientEventType } from "./types";

/**
 * WebSocket client with automatic reconnection, heartbeat, and event handling.
 * 具有自动重连、心跳和事件处理功能的 WebSocket 客户端。
 *
 * @template T - Type of messages sent/received. 发送/接收消息的类型。
 */
export class WebSocketClient {
  static ReadyState: WebSocketReadyState;
  #showLog?: boolean;
  #reconnectTimes: number = 0;
  #reconnectInterval: number;
  #heartbeatInterval: number;
  #heartbeatMessage: string = "ping";
  #heartBeatTimer: ReturnType<typeof setTimeout> | null = null;
  #maxReconnectAttempts: number = 0;
  #url: string = "";
  #protocols: string | string[] = [];
  #sendQueue: any[] = [];
  #connectResend: boolean = false;
  #jsonAble: boolean;
  #eventEmitter: EventEmitter;
  #instance: WebSocket | null = null;
  #WebSocketImpl: typeof WebSocket;

  /**
   * Constructs a WebSocket instance with specified options.
   * 使用指定的选项构造一个 WebSocket 实例。
   *
   * @param url - The WebSocket URL to connect to. 要连接的 WebSocket URL。
   * @param options - Configuration options for the WebSocket. WebSocket 的配置选项。
   * @param options.showLog - Whether to show logs. 是否显示日志。
   * @param options.reconnectInterval - Interval in milliseconds between reconnection attempts. Default: 1000. 重连间隔时间（毫秒），默认 1000。
   * @param options.heartbeatInterval - Interval in milliseconds between heartbeat messages. Default: 10000. 心跳间隔时间（毫秒），默认 10000。
   * @param options.heartbeatMessage - Message sent as heartbeat. Default: "ping". 心跳消息，默认 "ping"。
   * @param options.maxReconnectAttempts - Maximum reconnection attempts. 0 means unlimited. Default: 0. 最大重连次数，0 表示无限次，默认 0。
   * @param options.protocols - Array of protocols for WebSocket connection. Default: []. WebSocket 协议数组，默认 []。
   * @param options.connectResend - Whether to resend unsent messages after reconnection. Default: false. 重连后是否重发未发送消息，默认 false。
   * @param options.jsonAble - Whether to parse received messages as JSON. Default: false. 是否将接收消息解析为 JSON，默认 false。
   * @param WebSocketImpl - WebSocket implementation to use. Default: WebSocket. 使用的 WebSocket 实现，默认 WebSocket。
   */
  constructor(
    url: string,
    {
      showLog,
      reconnectInterval = 1_000,
      heartbeatInterval = 10_000,
      heartbeatMessage = "ping",
      maxReconnectAttempts = 0,
      protocols = [],
      connectResend = false,
      jsonAble = false
    }: WebSocketClientOptions = {},
    WebSocketImpl: typeof WebSocket = WebSocket
  ) {
    this.#showLog = showLog;
    this.#url = url;
    this.#reconnectInterval = reconnectInterval;
    this.#heartbeatInterval = heartbeatInterval;
    this.#heartbeatMessage = heartbeatMessage;
    this.#maxReconnectAttempts = maxReconnectAttempts;
    this.#protocols = protocols;
    this.#connectResend = connectResend;
    this.#jsonAble = jsonAble;
    this.#eventEmitter = new EventEmitter();
    this.#WebSocketImpl = WebSocketImpl;
  }

  /**
   * Returns the current WebSocket instance.
   * 返回当前 WebSocket 实例。
   *
   * @returns The current WebSocket instance or null. 当前 WebSocket 实例或 null。
   */
  get instance() {
    return this.#instance;
  }

  /**
   * Establishes a WebSocket connection.
   * 建立 WebSocket 连接。
   */
  connect() {
    if (this.#instance) {
      this.#instance = null;
      this.#reconnectInterval++;
    }
    this.#instance = new this.#WebSocketImpl(this.#url, this.#protocols);
    this.#instance.onclose = e => {
      this.#onClose(e);
    };
    this.#instance.onopen = e => {
      this.#onOpen(e);
    };
    this.#instance.onerror = e => {
      if (this.#showLog) {
        console.error("websocket error:", e);
      }
      this.#eventEmitter.emit(WebSocketClientEvent.ERROR, e);
    };
    this.#instance.onmessage = e => {
      this.#onMessage(e);
    };
  }

  #onOpen = (e: WebSocketEventMap['open']) => {
    this.#startHeartBeat();
    if (this.#connectResend) {
      while (this.#sendQueue.length) {
        const item = this.#sendQueue.shift();
        this.send(item);
      }
    }
    if (this.#showLog) {
      console.log("websocket had opened");
    }
    this.#eventEmitter.emit(WebSocketClientEvent.OPEN, e);
  };

  #onMessage(e: WebSocketEventMap["message"]) {
    let res = e.data;
    if(this.#jsonAble){
      try {
        res = JSON.parse(e.data);
      } catch {

      }
    }
    this.#eventEmitter.emit(WebSocketClientEvent.MESSAGE, res);
    if(this.#showLog){
      console.log("received a message:", res);
    }
  }

  /**
   * Sends a message through WebSocket. Objects will be JSON stringified automatically.
   * 通过 WebSocket 发送消息。对象会自动 JSON 序列化。
   *
   * @param e - The message to be sent. 要发送的消息。
   */
  send = (e: any) => {
    if (this.state === WebSocketReadyState.OPEN) {
      let data: string | ArrayBufferLike | ArrayBufferView | Blob;

      if (typeof e === "string") {
        // 纯文本：直接发送
        data = e;
      } else if (e instanceof ArrayBuffer) {
        // ArrayBuffer：按二进制发送
        data = e;
      } else if (ArrayBuffer.isView(e)) {
        // TypedArray / DataView：按二进制发送
        data = e;
      } else if (typeof Blob !== "undefined" && e instanceof Blob) {
        // Blob：按二进制发送
        data = e;
      } else if (typeof e === "object") {
        // 普通对象：JSON 序列化后按文本发送
        data = JSON.stringify(e);
      } else {
        // 其他类型（number/boolean/null/undefined 等）：转成字符串
        data = String(e);
      }

      this.#instance?.send(data);
      return
    }
    if (this.#connectResend) {
      this.#sendQueue.push(e as any);
    }
  };


  /**
   * Closes the WebSocket connection manually.
   * 主动关闭 WebSocket 连接。
   */
  close() {
    this.#instance?.close(1000, "Manually closing websocket connection");
  }

  #startHeartBeat() {
    if (this.#heartBeatTimer) return;
    this.#heartBeatTimer = setInterval(() => {
      this.send(this.#heartbeatMessage);
    }, this.#heartbeatInterval);
  }

  /**
   * Stops the heartbeat mechanism.
   * 停止心跳检测。
   */
  stopHeartBeat() {
    if (this.#heartBeatTimer) {
      clearInterval(this.#heartBeatTimer as number);
      this.#heartBeatTimer = null;
    }
  }

  #onClose(e: WebSocketEventMap["close"]) {
    this.stopHeartBeat();
    if (e.code !== 1000 && this.#maxReconnectAttempts > 0 && this.#reconnectTimes < this.#maxReconnectAttempts) {
      const timeout = setTimeout(() => {
        if (this.#showLog) {
          console.log("reconnecting...");
        }
        this.#reconnectTimes++;
        this.connect();
        clearTimeout(timeout);
      }, this.#reconnectInterval);
      return;
    }
    if (this.#showLog) {
      console.log("websocket had closed");
    }
    this.#eventEmitter.emit(WebSocketClientEvent.CLOSE, e);
  }

  /**
   * Adds an event listener for the specified event.
   * 为指定事件添加监听器。
   *
   * @param event - The event type to listen to. 要监听的事件类型。
   * @param listener - The callback function to execute when the event is emitted. 事件触发时执行的回调函数。
   */
  on<T extends (...args: any[]) => void>(event: WebSocketClientEventType, listener: T) {
    this.#eventEmitter.on(event, listener);
  }

  /**
   * Removes an event listener for the specified event.
   * 移除指定事件的监听器。
   *
   * @param event - The event type to remove listener from. 要移除监听器的事件类型。
   * @param listener - The specific listener to remove. If not provided, all listeners for the event will be removed. 要移除的特定监听器。如果未提供，则移除该事件的所有监听器。
   */
  off<T extends (...args: any[]) => void>(event: WebSocketClientEventType, listener?: T) {
    this.#eventEmitter.off(event, listener);
  }

  /**
   * Adds a one-time event listener for the specified event.
   * 为指定事件添加一次性监听器。
   *
   * @param event - The event type to listen to once. 要监听一次的事件类型。
   * @param listener - The callback function to execute when the event is emitted. 事件触发时执行的回调函数。
   */
  once<T extends (...args: any[]) => void>(event: WebSocketClientEventType, listener: T) {
    this.#eventEmitter.once(event, listener);
  }

  /**
   * Removes all event listeners for all events.
   * 移除所有事件的所有监听器。
   */
  offAll() {
    this.#eventEmitter.removeAllListeners();
  }

  /**
   * Gets the current WebSocket connection state.
   * 获取当前 WebSocket 连接状态。
   *
   * @returns The current ready state of the WebSocket connection. 当前 WebSocket 连接的就绪状态。
   */
  get state() {
    return this.#instance?.readyState
  }
}

export default WebSocketClient;
