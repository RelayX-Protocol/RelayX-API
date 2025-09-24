// Define the structure of the payload sent to the parent window
interface Payload {
  messageId?: string; // Optional unique identifier for the message
  [key: string]: any; // Other dynamic key-value pairs
}

// Define error code enumeration
enum ErrorCode {
  InvalidPayload = 30001,
  MissingCertificate = 30002,
  InvalidCertificate = 30003,
  methodNotFound = 30004,
  ExceededUploadSizeLimit = 30010,
  TimeoutError = 30011,
}

interface ErrorResponse {
  code?: ErrorCode;
  messageId: string;
  message?: string;
  data?: any;
}

interface SuccessResponse {
  code: 200;
  cmd: string;
  messageId: string;
  data?: any;
}

type Response = SuccessResponse | ErrorResponse;

type CommandParamType = "callbackOnly" | "payload" | "signOnly" | "payloadAndSign";

interface CommandConfig {
  type: CommandParamType;
  handler: Function;
}


interface RelayXClientConfig {
  timeout?: number;
}

// RelayXClient class to manage postMessage communication with the parent window
class RelayXClient  {
  private commandMap: { [key: string]: CommandConfig };
  private static instanceCount = 0;
  private static listenerFn: ((event: MessageEvent<any>) => void) | null = null;
  private readonly defaultTimeout: number = 30000; // 30 seconds default timeout

  private messageCallbacks: { 
    [key: string]: { 
      resolve: (value: Response) => void, 
      reject: (reason?: any) => void,
      timeoutId?: number
    } 
  } = {};

  

  constructor(config: RelayXClientConfig = {}) {
    // Initialize the callback map
    this.defaultTimeout = config.timeout || 30000;

    this.commandMap = {
      connectCocoPay: { type: "payload", handler: this.connectCocoPay.bind(this) },
      getSafeAreaInsets: { type: "callbackOnly", handler: this.getSafeAreaInsets.bind(this) },
      getLanguage: { type: "callbackOnly", handler: this.getLanguage.bind(this) },
      openURL: { type: "payload", handler: this.openURL.bind(this) },
      scanQRCode: { type: "callbackOnly", handler: this.scanQRCode.bind(this) },
      copyToClipboard: { type: "payload", handler: this.copyToClipboard.bind(this) },
      saveImage: { type: "payload", handler: this.saveImage.bind(this) },
      getAccount: { type: "payload", handler: this.getAccount.bind(this) },
      setExtendedData: { type: "payload", handler: this.setExtendedData.bind(this) },
      getExtendedData: { type: "callbackOnly", handler: this.getExtendedData.bind(this) },
      generateSignature: { type: "payload", handler: this.generateSignature.bind(this) },
      verifySignature: { type: "payload", handler: this.verifySignature.bind(this) },
      encrypt: { type: "payload", handler: this.encrypt.bind(this) },
      decrypt: { type: "payload", handler: this.decrypt.bind(this) },
      registerService: { type: "payloadAndSign", handler: this.registerService.bind(this) },
      checkServiceStatus: { type: "signOnly", handler: this.checkServiceStatus.bind(this) },
      sendServiceMessage: { type: "payloadAndSign", handler: this.sendServiceMessage.bind(this) }
    };

    // Set up event listener only once
    RelayXClient.instanceCount++;
    if (!RelayXClient.listenerFn) {
      RelayXClient.listenerFn = this.messageHandler.bind(this);
      window.addEventListener("message", RelayXClient.listenerFn);
    }
  }

  /**
   * Generate a globally unique command ID
   */
  private generateUniqueMessageId(): string {
    // Prefer using the native browser Crypto API
    if (typeof crypto === 'object' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // UUID v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Unified error handling function
  private handleError(cmd: string, messageId: string, options: { code?: ErrorCode; message?: string; data?: any; } = {}): ErrorResponse {
    const { code = ErrorCode.InvalidPayload, message, data } = options;
    
    //Provide a default error message
    const defaultMessages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.InvalidPayload]: 'Invalid request payload',
      [ErrorCode.MissingCertificate]: 'Certificate information is missing',
      [ErrorCode.InvalidCertificate]: 'Invalid certificate format',
      [ErrorCode.ExceededUploadSizeLimit]: 'File size exceeds the limit',
      [ErrorCode.TimeoutError]: 'Request timed out'
    };
    const errorMessage = message || defaultMessages[code] || 'An error occurred';

    const errorResponse: ErrorResponse = { code, messageId };
    if (data) errorResponse.data = data;
    return errorResponse;
  }

  /** Verify signature */
  private validateSigInfo(sigInfo: Payload, cmd: string, messageId: string): { isValid: boolean; errorCode?: ErrorCode; errorMessage?: string } {
    if (!sigInfo) {
      return {
        isValid: false,
        errorCode: ErrorCode.MissingCertificate,
        errorMessage: 'Missing certificate information'
      };
    }
    
    if (typeof sigInfo.content !== 'string' || typeof sigInfo.signature !== 'string' || 
        !sigInfo.content.trim() || !sigInfo.signature.trim()) {
      return {
        isValid: false,
        errorCode: ErrorCode.InvalidCertificate,
        errorMessage: 'Invalid certificate format'
      };
    }
    
    return {
      isValid: true
    };
  }

  /**
   * Calculates the original size of a Base64-encoded image.
   *
   * @param {string} base64String - The Base64-encoded image string (with or without data URI prefix).
   * @returns {{ bytes: number, kb: string, mb: string }} - The image size in bytes, kilobytes (KB), and megabytes (MB).
   */
  private getBase64ImageSize(base64String: string) {
    // Remove prefix
    let base64 = base64String.split(',')[1] || base64String;
    base64 = base64.replace(/\s/g, ''); // Remove spaces, line breaks, etc.
    
    // Calculate padding
    const padding = (base64.match(/=*$/) || [''])[0].length;
    const bytes = base64.length * 3 / 4 - padding;
    const kb = bytes / 1024;
    const mb = kb / 1024;

    return {
      bytes: Math.floor(bytes),
      kb: kb.toFixed(2),
      mb: mb.toFixed(2)
    };
  }

  private cleanupCallback(messageId: string) {
    if (!messageId || !this.messageCallbacks[messageId]) return;
    
    // Clear the timeout if it exists
    const callback = this.messageCallbacks[messageId];
    if (callback.timeoutId) {
      window.clearTimeout(callback.timeoutId);
    }
    
    // Remove the callback
    delete this.messageCallbacks[messageId];
  }

  private handleTimeout(messageId: string, cmd: string) {
    const callback = this.messageCallbacks[messageId];
    if (callback) {
      callback.resolve(this.handleError(cmd, messageId, {
        code: ErrorCode.TimeoutError,
        message: 'Request timed out'
      }));
      
      // Clean up
      this.cleanupCallback(messageId);
    }
  }

  /**
   * Sends a message to the parent window using postMessage.
   * Returns a Promise that resolves with the response.
   * 
   * @param cmd - The command name to send
   * @param payload - The data payload including optional messageId
   * @returns Promise that resolves with the response
   */
  private _sendMessage(cmd: string, payload: Payload, timeoutMs: number = this.defaultTimeout): Promise<Response> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateUniqueMessageId();
      const message = {
        cmd: cmd,
        messageId: messageId,
        ...payload
      };

      // Make sure to clean up callbacks in error cases as well
      const cleanupAndResolve = (error: ErrorResponse) => {
        this.cleanupCallback(messageId);
        resolve(error);
      };

      // Ensure the parent window exists before sending the message
      if (window.parent) { 
        window.parent.postMessage(message, '*');

        this.messageCallbacks[messageId] = { resolve, reject };
        
        // Set timeout for commands that expect a response
        if (cmd !== "openURL" && cmd !== "scanQRCode") {
          const timeoutId = window.setTimeout(() => {
            this.handleTimeout(messageId, cmd);
          }, timeoutMs);
          
          this.messageCallbacks[messageId].timeoutId = timeoutId;
        }
      } else {
        cleanupAndResolve(this.handleError(cmd, messageId, {
          message: 'Unable to send message to parent window. Parent window not found.'
        }));
      }
    });
  }

  sendMessage(cmd: string, payload: Payload = {}): Promise<Response> {
    const commandHandler = this.commandMap[cmd];
    
    // If the command does not exist, send the original message directly
    if (!commandHandler) {
      return this._sendMessage(cmd, payload);
    }

    // Add protection to prevent unknown type from causing recursion
    const validTypes = ["callbackOnly", "payload", "signOnly", "payloadAndSign"]; 

    // Extract messageId from payload for error handling
    const messageId = payload?.messageId || this.generateUniqueMessageId();

    if (!validTypes.includes(commandHandler.type)) {
      return this._sendMessage(cmd, payload);
    }
    
    try {
      switch (commandHandler.type) {
        case "callbackOnly":
          return commandHandler.handler();
        case "payload":
          return commandHandler.handler(payload);
        case "payloadAndSign":
          return commandHandler.handler(payload.data, payload.sign);
        case "signOnly":
          return commandHandler.handler(payload.sign);
        default:
          return this._sendMessage(cmd, payload);
      }
    } catch (error) {
      return Promise.resolve(this.handleError(cmd, messageId, {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code:ErrorCode.methodNotFound
      }));
    }
  }

  /** Handles connectCocoPay message */
  private connectCocoPay(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || 
        !Array.isArray(payload.chainList) || 
        (payload.walletSupports !== undefined && !Array.isArray(payload.walletSupports))) {
        return Promise.resolve(this.handleError('connectCocoPay', messageId, {
          code: ErrorCode.InvalidPayload,
          message: 'Invalid payload for connectCocoPay'
        }));
    }
    
    return this._sendMessage('connectCocoPay', { data: payload });
  }

  /** Handles getSafeAreaInsets message */
  private getSafeAreaInsets(): Promise<Response> {
    return this._sendMessage('getSafeAreaInsets', { data: {} });
  }

  /** Handles getLanguage message */
  private getLanguage(): Promise<Response> {
    return this._sendMessage('getLanguage', { data: {} });
  }

  /** Handles openURL message */
  private openURL(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || 
        typeof payload.url !== 'string' || 
        !payload.url.startsWith('https://') || 
        payload.url.length > 200 || 
        !payload.url.trim() ||
        (payload.useSystemOpen !== undefined && typeof payload.useSystemOpen !== 'boolean')) {
      return Promise.resolve(this.handleError('openURL', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid URL provided'
      }));
    }
    
    return this._sendMessage('openURL', { data: payload });
  }

  /** Handles scanQRCode message */
  private scanQRCode(): Promise<Response> {
    return this._sendMessage('scanQRCode', { data: {} });
  }

  /** Handles copyToClipboard message */
  private copyToClipboard(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
      return Promise.resolve(this.handleError('copyToClipboard', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid text for clipboard'
      }));
    }
    
    return this._sendMessage('copyToClipboard', { data: payload });
  }

  /** Handles saveImage message */
  private saveImage(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || 
        typeof payload.image !== 'string' || 
        !payload.image.trim() ||
        !payload.image.startsWith('data:image/')) {
      return Promise.resolve(this.handleError('saveImage', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid image data'
      }));
    }

    try {
      const imageSize = this.getBase64ImageSize(payload.image);
      const maxSizeInBytes = 1 * 1024 * 1024; // 1MB
      
      if (imageSize.bytes > maxSizeInBytes) {
        return Promise.resolve(this.handleError('saveImage', messageId, {
          code: ErrorCode.ExceededUploadSizeLimit,
          message: 'Image size exceeds limit'
        }));
      }
    } catch (e) {
      return Promise.resolve(this.handleError('saveImage', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Failed to process image data'
      }));
    }

    return this._sendMessage('saveImage', { data: payload });
  }

  /** Handles getAccount message */
  private getAccount(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (payload && 'type' in payload && (typeof payload.type !== 'string' || payload.type !== "1")) {
      return Promise.resolve(this.handleError('getAccount', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid account type'
      }));
    }
    
    return this._sendMessage('getAccount', { data: payload || {} });
  }

  /** Handles setExtendedData message */
  private setExtendedData(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload ||
        !('extend' in payload) ||
        payload.extend === null || 
        Array.isArray(payload.extend) ||
        (typeof payload.extend !== 'object' && typeof payload.extend !== 'string')) {
      return Promise.resolve(this.handleError('setExtendedData', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid extended data format'
      }));
    }
    
    return this._sendMessage('setExtendedData', { data: payload });
  }

  /** Handles getExtendedData message */
  private getExtendedData(): Promise<Response> {
    return this._sendMessage('getExtendedData', { data: {} });
  }

  /** Handles generateSignature message */
  private generateSignature(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || typeof payload.message !== 'string' || !payload.message.trim()) {
      return Promise.resolve(this.handleError('generateSignature', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid message for signature'
      }));
    }
    
    return this._sendMessage('generateSignature', { data: payload });
  }

  /** Handles verifySignature message */
  private verifySignature(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || 
        typeof payload.message !== 'string' || 
        typeof payload.signature !== 'string' || 
        !payload.message.trim() || 
        !payload.signature.trim()) {
      return Promise.resolve(this.handleError('verifySignature', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid signature data'
      }));
    }
    
    return this._sendMessage('verifySignature', { data: payload });
  }

  /** Handles encrypt message */
  private encrypt(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || typeof payload.message !== 'string' || !payload.message.trim()) {
      return Promise.resolve(this.handleError('encrypt', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid message for encryption'
      }));
    }
    
    return this._sendMessage('encrypt', { data: payload });
  }

  /** Handles decrypt message */
  private decrypt(payload: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || typeof payload.content !== 'string' || !payload.content.trim()) {
      return Promise.resolve(this.handleError('decrypt', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid content for decryption'
      }));
    }
    
    return this._sendMessage('decrypt', { data: payload });
  }

  /** Handles registerService message */
  private registerService(payload: Payload, sigInfo: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || typeof payload.serviceKey !== 'string' || !payload.serviceKey.trim()) {
      return Promise.resolve(this.handleError('registerService', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid service key'
      }));
    }

    const sigCheck = this.validateSigInfo(sigInfo, 'registerService', messageId);

    if (!sigCheck.isValid) {
      return Promise.resolve(this.handleError('registerService', messageId, {
        code: sigCheck.errorCode!,
        message: sigCheck.errorMessage || 'Invalid signature info'
      }));
    }
    
    return this._sendMessage('registerService', { data: payload, sign: sigInfo });
  }

  /** Handles checkServiceStatus message */
  private checkServiceStatus(sigInfo: Payload): Promise<Response> {
    const messageId = sigInfo?.messageId || this.generateUniqueMessageId();
    
    const sigCheck = this.validateSigInfo(sigInfo, 'checkServiceStatus', messageId);
    
    if (!sigCheck.isValid) {
      return Promise.resolve(this.handleError('checkServiceStatus', messageId, {
        code: sigCheck.errorCode!,
        message: sigCheck.errorMessage || 'Invalid signature info'
      }));
    }

    return this._sendMessage('checkServiceStatus', { data: {}, sign: sigInfo });
  }

  /** Handles sendServiceMessage message */
  private sendServiceMessage(payload: Payload, sigInfo: Payload): Promise<Response> {
    const messageId = payload?.messageId || this.generateUniqueMessageId();
    
    if (!payload || 
        typeof payload.content !== 'object' || 
        Array.isArray(payload.content) || 
        typeof payload.type !== 'string' || 
        payload.type.trim() === '' || 
        payload.type !== 'HTTP') {
      return Promise.resolve(this.handleError('sendServiceMessage', messageId, {
        code: ErrorCode.InvalidPayload,
        message: 'Invalid service message format'
      }));
    }
    
    const sigCheck = this.validateSigInfo(sigInfo, 'sendServiceMessage', messageId);
    
    if (!sigCheck.isValid) {
      return Promise.resolve(this.handleError('sendServiceMessage', messageId, {
        code: sigCheck.errorCode!,
        message: sigCheck.errorMessage || 'Invalid signature info'
      }));
    }

    return this._sendMessage('sendServiceMessage', { data: payload, sign: sigInfo });
  }

  /**
   * Sets up a listener for messages from the parent window.
   * When a message is received, it checks for a matching callback by messageId
   * and invokes it with the result.
   */
  private messageHandler(event: MessageEvent) {
    // Verify the origin for security in production
    // if (event.origin !== EXPECTED_ORIGIN) return;
    
    const result = event.data;
    if (result && typeof result === 'object' && typeof result.messageId === 'string') {
      const messageId = result.messageId;
      const callback = this.messageCallbacks[messageId];
      
      if (callback) {
        this.cleanupCallback(messageId);
        callback.resolve(result);
        
      }
    }
  }

  /** Destruction method: remove monitoring and clean up callbacks */
  destroy() {
    RelayXClient.instanceCount--;
    
    // Only remove listener when no instances remain
    if (RelayXClient.instanceCount === 0 && RelayXClient.listenerFn) {
      window.removeEventListener("message", RelayXClient.listenerFn);
      RelayXClient.listenerFn = null;
    }

    // Clear all pending callbacks
    Object.keys(this.messageCallbacks).forEach(messageId => {
      const callback = this.messageCallbacks[messageId];
      if (callback) {
        callback.resolve(this.handleError('', messageId, {
          code: ErrorCode.TimeoutError,
          message: 'Connection destroyed'
        }));
        
        if (callback.timeoutId) {
          window.clearTimeout(callback.timeoutId);
        }
      }
    });
    
    this.messageCallbacks = {};
  }
}

export { RelayXClient , ErrorCode };
export default RelayXClient;