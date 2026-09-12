import { Client } from '@stomp/stompjs';

export class TrackingSocketClient {
  constructor(orderId, onMessage, onStatusChange) {
    this.orderId = orderId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.client = null;
    this.subscription = null;
  }

  connect() {
    this.client = new Client({
      brokerURL: 'ws://localhost:8080/ws-delivery',
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log(`[STOMP] Connected. Subscribing to /topic/orders/${this.orderId}/tracking`);
        if (this.onStatusChange) this.onStatusChange('CONNECTED');

        const topic = `/topic/orders/${this.orderId}/tracking`;
        this.subscription = this.client.subscribe(topic, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (this.onMessage) this.onMessage(data);
          } catch (e) {
            console.error('[STOMP] Failed to parse message body:', e);
          }
        });
      },
      onDisconnect: () => {
        if (this.onStatusChange) this.onStatusChange('DISCONNECTED');
      },
      onStompError: (frame) => {
        console.error('[STOMP Error]:', frame.headers ? frame.headers['message'] : frame);
        if (this.onStatusChange) this.onStatusChange('ERROR');
      },
      onWebSocketClose: () => {
        if (this.onStatusChange) this.onStatusChange('DISCONNECTED');
      }
    });

    this.client.activate();
  }

  disconnect() {
    if (this.subscription) {
      try {
        this.subscription.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing:', e);
      }
      this.subscription = null;
    }
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (e) {
        console.warn('Error deactivating client:', e);
      }
      this.client = null;
    }
  }

  sendLocation(latitude, longitude, headingDegrees = 45.0) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: `/app/orders/${this.orderId}/location`,
        body: JSON.stringify({ latitude, longitude, headingDegrees })
      });
    }
  }
}
