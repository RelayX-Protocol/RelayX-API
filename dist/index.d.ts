interface Payload {
    messageId?: string;
    [key: string]: any;
}
declare enum ErrorCode {
    InvalidPayload = 30001,
    MissingCertificate = 30002,
    InvalidCertificate = 30003,
    methodNotFound = 30004,
    ExceededUploadSizeLimit = 30010,
    TimeoutError = 30011
}
interface ErrorResponse {
    code?: ErrorCode;
    cmd?: string;
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
interface RelayXClientConfig {
    timeout?: number;
}
declare class RelayXClient {
    private commandMap;
    private static instanceCount;
    private static listenerFn;
    private readonly defaultTimeout;
    private messageCallbacks;
    constructor(config?: RelayXClientConfig);
    /**
     * Generate a globally unique command ID
     */
    private generateUniqueMessageId;
    private handleError;
    /** Verify signature */
    private validateSigInfo;
    /**
     * Calculates the original size of a Base64-encoded image.
     *
     * @param {string} base64String - The Base64-encoded image string (with or without data URI prefix).
     * @returns {{ bytes: number, kb: string, mb: string }} - The image size in bytes, kilobytes (KB), and megabytes (MB).
     */
    private getBase64ImageSize;
    private cleanupCallback;
    private handleTimeout;
    /**
     * Sends a message to the parent window using postMessage.
     * Returns a Promise that resolves with the response.
     *
     * @param cmd - The command name to send
     * @param payload - The data payload including optional messageId
     * @returns Promise that resolves with the response
     */
    private _sendMessage;
    sendMessage(cmd: string, payload?: Payload): Promise<Response>;
    /** Handles connectCocoPay message */
    connectCocoPay(payload: Payload): Promise<Response>;
    /** Handles getSafeAreaInsets message */
    getSafeAreaInsets(): Promise<Response>;
    /** Handles getLanguage message */
    getLanguage(): Promise<Response>;
    /** Handles openURL message */
    openURL(payload: Payload): Promise<Response>;
    /** Handles scanQRCode message */
    scanQRCode(): Promise<Response>;
    /** Handles copyToClipboard message */
    copyToClipboard(payload: Payload): Promise<Response>;
    /** Handles saveImage message */
    saveImage(payload: Payload): Promise<Response>;
    /** Handles getAccount message */
    getAccount(payload: Payload): Promise<Response>;
    /** Handles setExtendedData message */
    setExtendedData(payload: Payload): Promise<Response>;
    /** Handles getExtendedData message */
    getExtendedData(): Promise<Response>;
    /** Handles generateSignature message */
    generateSignature(payload: Payload): Promise<Response>;
    /** Handles verifySignature message */
    verifySignature(payload: Payload): Promise<Response>;
    /** Handles encrypt message */
    encrypt(payload: Payload): Promise<Response>;
    /** Handles decrypt message */
    decrypt(payload: Payload): Promise<Response>;
    /** Handles registerService message */
    registerService(payload: Payload, sigInfo: Payload): Promise<Response>;
    /** Handles checkServiceStatus message */
    checkServiceStatus(sigInfo: Payload): Promise<Response>;
    /** Handles sendServiceMessage message */
    sendServiceMessage(payload: Payload, sigInfo: Payload): Promise<Response>;
    /**
     * Sets up a listener for messages from the parent window.
     * When a message is received, it checks for a matching callback by messageId
     * and invokes it with the result.
     */
    private messageHandler;
    /** Destruction method: remove monitoring and clean up callbacks */
    destroy(): void;
}
export { RelayXClient, ErrorCode };
export default RelayXClient;
