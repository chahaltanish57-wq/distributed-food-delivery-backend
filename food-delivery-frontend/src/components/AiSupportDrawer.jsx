import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  X, 
  RotateCcw, 
  Navigation, 
  ShoppingBag, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  UtensilsCrossed,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { sendAiChatMessage, getAiStatus } from '../api';

export default function AiSupportDrawer({ 
  currentOrderId, 
  selectedCity, 
  onTrackOrder, 
  onAddToCart,
  theme 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "👋 Namaste! I am your Swiggy AI Concierge.\n\nI can track your live orders across Noida & Dehradun, help you cancel eligible orders, or recommend mouth-watering dishes right from our menu. How can I help you today?",
      suggestedChips: [
        `Where is my order #${currentOrderId || 15}?`,
        `Recommend Biryani in ${selectedCity || 'Noida'}`,
        `Desserts under ₹250`,
        `Can I cancel my order?`
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // Load AI provider status on mount
  useEffect(() => {
    getAiStatus()
      .then((status) => setAiStatus(status))
      .catch((err) => console.warn('Could not fetch AI status:', err));
  }, []);

  // Auto scroll chat to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessageId = Date.now().toString();
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history format
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content
        }));

      const res = await sendAiChatMessage(
        text,
        currentOrderId || 15,
        selectedCity || 'Noida',
        history
      );

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply || "I'm sorry, I couldn't process that request right now.",
        intent: res.intent,
        aiPowered: res.aiPowered,
        modelUsed: res.modelUsed,
        orderDetails: res.orderDetails,
        recommendations: res.recommendations,
        suggestedChips: res.suggestedChips || [
          `Where is order #${currentOrderId || 15}?`,
          `Recommend food in ${selectedCity || 'Noida'}`
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "⚠️ We're having trouble connecting to Swiggy AI right now. Please verify your backend connection or try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`ai-concierge-wrapper ${theme === 'dark' ? 'theme-dark' : ''}`}>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button 
          className="ai-floating-trigger"
          onClick={() => setIsOpen(true)}
          title="Chat with Swiggy AI Assistant"
        >
          <div className="ai-trigger-beacon"></div>
          <div className="ai-trigger-icon">
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div className="ai-trigger-label">
            <span className="ai-trigger-badge">AI Assistant</span>
            <span className="ai-trigger-sub">Track & Recommend</span>
          </div>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="ai-chat-drawer">
          {/* Header */}
          <div className="ai-drawer-header">
            <div className="ai-header-left">
              <div className="ai-avatar-badge">
                <Bot size={20} color="#fc8019" />
                <span className="ai-online-indicator"></span>
              </div>
              <div className="ai-header-titles">
                <div className="ai-title-row">
                  <h4>Swiggy Genie AI</h4>
                  <span className="ai-model-tag">
                    {aiStatus?.configured ? 'Gemini 2.5 Flash' : 'Smart Assistant'}
                  </span>
                </div>
                <p className="ai-sub-title">Live Tracking • Recommendations • Noida & Doon</p>
              </div>
            </div>

            <div className="ai-header-actions">
              <button 
                className="ai-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="ai-messages-container">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`ai-message-row ${msg.role === 'user' ? 'user-side' : 'assistant-side'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="ai-msg-avatar">
                    <Sparkles size={14} color="#fc8019" />
                  </div>
                )}

                <div className="ai-bubble-wrap">
                  <div className={`ai-message-bubble ${msg.role}`}>
                    {/* Render message text with simple markdown support */}
                    <div className="ai-bubble-text">
                      {msg.content.split('\n').map((paragraph, idx) => (
                        <p key={idx}>
                          {paragraph.startsWith('• ') ? (
                            <span>{paragraph}</span>
                          ) : paragraph.startsWith('🛵') || paragraph.startsWith('✨') || paragraph.startsWith('👉') || paragraph.startsWith('👋') ? (
                            <strong>{paragraph}</strong>
                          ) : (
                            paragraph
                          )}
                        </p>
                      ))}
                    </div>

                    {/* Rich Order Details Card */}
                    {msg.orderDetails && msg.orderDetails.found && (
                      <div className="ai-order-card">
                        <div className="ai-order-card-header">
                          <span className="ai-order-num">Order #{msg.orderDetails.orderId}</span>
                          <span className={`ai-status-pill status-${msg.orderDetails.status?.toLowerCase()}`}>
                            {msg.orderDetails.status?.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="ai-order-card-body">
                          <div className="ai-order-row">
                            <span className="ai-order-k">Restaurant:</span>
                            <span className="ai-order-v">{msg.orderDetails.restaurantName} ({msg.orderDetails.restaurantCity})</span>
                          </div>
                          <div className="ai-order-row">
                            <span className="ai-order-k">Delivery Partner:</span>
                            <span className="ai-order-v">{msg.orderDetails.driverName}</span>
                          </div>
                          <div className="ai-order-row">
                            <span className="ai-order-k">Estimated ETA:</span>
                            <span className="ai-order-v">~{msg.orderDetails.etaMinutes || 25} mins</span>
                          </div>
                          <div className="ai-order-row">
                            <span className="ai-order-k">Total Bill:</span>
                            <span className="ai-order-v highlight">₹{msg.orderDetails.totalAmount}</span>
                          </div>
                        </div>

                        {/* 1-Click Track Button */}
                        <button 
                          className="ai-track-order-btn"
                          onClick={() => {
                            if (onTrackOrder) onTrackOrder(msg.orderDetails.orderId);
                            setIsOpen(false);
                          }}
                        >
                          <Navigation size={14} />
                          <span>View on Real OpenStreetMap</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {/* Rich Food Recommendations Carousel / Grid */}
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="ai-recommendations-box">
                        <div className="ai-recs-title">
                          <UtensilsCrossed size={14} color="#fc8019" />
                          <span>Recommended for You</span>
                        </div>
                        <div className="ai-recs-list">
                          {msg.recommendations.map((dish) => (
                            <div key={dish.id} className="ai-dish-card">
                              <div className="ai-dish-info">
                                <div className="ai-dish-header">
                                  <span className={`veg-dot ${dish.isVegetarian ? 'veg' : 'non-veg'}`}>●</span>
                                  <strong className="ai-dish-name">{dish.name}</strong>
                                </div>
                                <span className="ai-dish-rest">{dish.restaurantName} • ⭐ {dish.rating || '4.5'}</span>
                                <span className="ai-dish-price">₹{dish.price}</span>
                              </div>

                              <button 
                                className="ai-add-cart-btn"
                                onClick={() => {
                                  if (onAddToCart) onAddToCart(dish.restaurantId, dish.id, dish.name, dish.price);
                                }}
                                title="Add to Swiggy Cart"
                              >
                                <ShoppingBag size={13} />
                                <span>+ Add</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <span className="ai-bubble-time">{msg.timestamp}</span>
                  </div>

                  {/* Suggested Quick Prompt Chips */}
                  {msg.suggestedChips && msg.suggestedChips.length > 0 && (
                    <div className="ai-chips-group">
                      {msg.suggestedChips.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          className="ai-quick-chip"
                          onClick={() => handleSendMessage(chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pulsing Loading Skeleton */}
            {isLoading && (
              <div className="ai-message-row assistant-side">
                <div className="ai-msg-avatar">
                  <Sparkles size={14} color="#fc8019" />
                </div>
                <div className="ai-bubble-wrap">
                  <div className="ai-message-bubble assistant ai-loading-bubble">
                    <span className="ai-dot-pulse"></span>
                    <span className="ai-dot-pulse"></span>
                    <span className="ai-dot-pulse"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="ai-drawer-footer">
            <div className="ai-input-wrapper">
              <input
                type="text"
                placeholder={`Ask anything (e.g. "Where is order 15?", "Biryani in ${selectedCity || 'Noida'}")`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="ai-chat-input"
              />
              <button
                className={`ai-send-btn ${inputMessage.trim() ? 'active' : ''}`}
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                title="Send query"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="ai-footer-note">
              <span>Powered by Google Gemini AI • Noida & Dehradun</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
