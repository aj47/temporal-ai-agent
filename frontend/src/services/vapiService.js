import Vapi from '@vapi-ai/web';

// Get the VAPI public key from environment variables
// Make sure to create a .env file based on .env.example
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || 'your-vapi-public-key';

class VapiService {
  constructor() {
    this.vapi = null;
    this.initialized = false;
    this.listeners = [];
    this.isSpeaking = false;
    this.isCallActive = false;
    this.onMessageCallback = null;
  }

  initialize() {
    if (this.initialized) return;

    try {
      this.vapi = new Vapi(VAPI_PUBLIC_KEY);
      this.setupEventListeners();
      this.initialized = true;
      console.log('VAPI service initialized');
    } catch (error) {
      console.error('Failed to initialize VAPI service:', error);
    }
  }

  setupEventListeners() {
    if (!this.vapi) return;

    // Speech events
    this.vapi.on('speech-start', () => {
      this.isSpeaking = true;
      this.notifyListeners('speech-start');
    });

    this.vapi.on('speech-end', () => {
      this.isSpeaking = false;
      this.notifyListeners('speech-end');
    });

    // Call lifecycle events
    this.vapi.on('call-start', () => {
      this.isCallActive = true;
      this.notifyListeners('call-start');
    });

    this.vapi.on('call-end', () => {
      this.isCallActive = false;
      this.notifyListeners('call-end');
    });

    // Volume level for visualization
    this.vapi.on('volume-level', (volume) => {
      this.notifyListeners('volume-level', volume);
    });

    // Messages from the assistant
    this.vapi.on('message', (message) => {
      console.log('VAPI message received:', message);

      // If it's a transcript, we can forward it to our API
      if (message.type === 'transcript' && message.transcript && this.onMessageCallback) {
        this.onMessageCallback(message.transcript);
      }

      this.notifyListeners('message', message);
    });

    // Error handling
    this.vapi.on('error', (error) => {
      console.error('VAPI error:', error);
      this.notifyListeners('error', error);
    });
  }

  startVoiceSession(assistantConfig = null) {
    if (!this.vapi) {
      this.initialize();
    }

    if (!this.vapi) {
      console.error('VAPI service not initialized');
      return;
    }

    try {
      if (assistantConfig) {
        // Start with custom configuration
        this.vapi.start(assistantConfig);
      } else {
        // Start with default configuration
        this.vapi.start({
          model: {
            provider: "openai",
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant. The user's messages will be forwarded to the main API for processing. Your role is to listen and respond naturally.",
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "echo", // You can choose a different voice
          },
        });
      }
    } catch (error) {
      console.error('Failed to start VAPI session:', error);
    }
  }

  stopVoiceSession() {
    if (!this.vapi || !this.isCallActive) return;

    try {
      this.vapi.stop();
    } catch (error) {
      console.error('Failed to stop VAPI session:', error);
    }
  }

  setMuted(muted) {
    if (!this.vapi) return;

    try {
      this.vapi.setMuted(muted);
    } catch (error) {
      console.error('Failed to set mute state:', error);
    }
  }

  isMuted() {
    if (!this.vapi) return false;
    return this.vapi.isMuted();
  }

  // Say something through the voice interface
  say(message, endCallAfterSpoken = false) {
    if (!this.vapi || !this.isCallActive) return;

    try {
      this.vapi.say(message, endCallAfterSpoken);
    } catch (error) {
      console.error('Failed to say message:', error);
    }
  }

  // Send a text message to the assistant
  sendTextMessage(message, role = 'user') {
    if (!this.vapi || !this.isCallActive) return;

    try {
      this.vapi.send({
        type: 'add-message',
        message: {
          role: role,
          content: message,
        },
      });
    } catch (error) {
      console.error('Failed to send text message:', error);
    }
  }

  // Register a callback for when messages are received
  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  // Add event listener
  addEventListener(event, callback) {
    this.listeners.push({ event, callback });
  }

  // Remove event listener
  removeEventListener(event, callback) {
    this.listeners = this.listeners.filter(
      (listener) => !(listener.event === event && listener.callback === callback)
    );
  }

  // Notify all listeners of an event
  notifyListeners(event, data) {
    this.listeners
      .filter((listener) => listener.event === event)
      .forEach((listener) => listener.callback(data));
  }

  // Clean up
  cleanup() {
    if (this.vapi) {
      this.vapi.removeAllListeners();
      if (this.isCallActive) {
        this.vapi.stop();
      }
    }
    this.listeners = [];
    this.onMessageCallback = null;
    this.initialized = false;
  }
}

// Create a singleton instance
const vapiService = new VapiService();

export default vapiService;
