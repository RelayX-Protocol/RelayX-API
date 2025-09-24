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
    private connectCocoPay;
    /** Handles getSafeAreaInsets message */
    private getSafeAreaInsets;
    /** Handles getLanguage message */
    private getLanguage;
    /** Handles openURL message */
    private openURL;
    /** Handles scanQRCode message */
    private scanQRCode;
    /** Handles copyToClipboard message */
    private copyToClipboard;
    /** Handles saveImage message */
    private saveImage;
    /** Handles getAccount message */
    private getAccount;
    /** Handles setExtendedData message */
    private setExtendedData;
    /** Handles getExtendedData message */
    private getExtendedData;
    /** Handles generateSignature message */
    private generateSignature;
    /** Handles verifySignature message */
    private verifySignature;
    /** Handles encrypt message */
    private encrypt;
    /** Handles decrypt message */
    private decrypt;
    /** Handles registerService message */
    private registerService;
    /** Handles checkServiceStatus message */
    private checkServiceStatus;
    /** Handles sendServiceMessage message */
    private sendServiceMessage;
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
