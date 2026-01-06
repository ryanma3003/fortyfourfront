<template>
  <div v-if="isOpen" class="chat-modal-overlay" @click.self="close">
    <div class="chat-modal-window">
      <!-- Header -->
      <div class="chat-header bg-primary">
        <div class="d-flex align-items-center">
          <div class="icon-box me-3">
            <i class="ti ti-message-chatbot fs-20 text-white"></i>
          </div>
          <div>
            <h5 class="mb-0 text-white fw-semibold">AI Assistant</h5>
            <span class="text-white-50 fs-12">Always here to help</span>
          </div>
        </div>
        <button class="btn-close-custom" @click="close">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="chat-body" ref="chatBody">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="avatar avatar-xl bg-primary-transparent mb-3">
            <i class="ti ti-message-chatbot fs-30 text-primary"></i>
          </div>
          <p class="text-muted">How can I assist you today?</p>
        </div>
        
        <div v-else class="messages-list">
          <div 
            v-for="(msg, index) in messages" 
            :key="index" 
            :class="['message-item', msg.isUser ? 'user' : 'ai']"
          >
            <div class="message-content">
              {{ msg.text }}
            </div>
            <span class="message-time">{{ msg.time }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="chat-footer">
        <input 
          type="text" 
          class="form-control chat-input" 
          placeholder="Type your message..." 
          v-model="newMessage"
          @keyup.enter="sendMessage"
        >
        <button class="btn btn-primary btn-icon btn-send" @click="sendMessage">
          <i class="ti ti-send"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const messages = ref([
  { text: "Hello! I'm your AI Agent. How can I help you optimize your workflow today?", isUser: false, time: 'Now' }
]);
const newMessage = ref('');
const chatBody = ref(null);

const close = () => {
  emit('close');
};

const sendMessage = () => {
  if (!newMessage.value.trim()) return;

  // Add user message
  messages.value.push({
    text: newMessage.value,
    isUser: true,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const userText = newMessage.value;
  newMessage.value = '';

  scrollToBottom();

  // Simulate AI response
  setTimeout(() => {
    messages.value.push({
      text: "I'm just a demo UI for now, but I received: " + userText,
      isUser: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    scrollToBottom();
  }, 1000);
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight;
    }
  });
};
</script>

<style scoped lang="scss">
.chat-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.2); /* Light backdrop */
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 20px;
  backdrop-filter: blur(2px);
}

.chat-modal-window {
  width: 380px;
  height: 600px;
  max-height: 80vh;
  background: var(--menu-bg); /* Use theme bg */
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--menu-border-color);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  margin-left: 260px; /* Offset for sidebar - desktop default */
  
  @media (max-width: 992px) {
    margin-left: 0;
    width: 100%;
    max-width: 400px;
  }
}

.chat-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary) 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;

  .icon-box {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close-custom {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }
  }
}

.chat-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: var(--default-background); /* Theme background */
  display: flex;
  flex-direction: column;

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    opacity: 0.7;
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .message-item {
    display: flex;
    flex-direction: column;
    max-width: 80%;

    &.ai {
      align-self: flex-start;
      
      .message-content {
        background: var(--menu-bg);
        color: var(--default-text-color);
        border: 1px solid var(--default-border);
        border-radius: 12px 12px 12px 2px;
      }
    }

    &.user {
      align-self: flex-end;
      align-items: flex-end;

      .message-content {
        background: var(--primary-color);
        color: white;
        border-radius: 12px 12px 2px 12px;
      }
    }

    .message-content {
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .message-time {
      font-size: 10px;
      margin-top: 4px;
      opacity: 0.6;
    }
  }
}

.chat-footer {
  padding: 16px;
  background: var(--menu-bg);
  border-top: 1px solid var(--menu-border-color);
  display: flex;
  align-items: center;
  gap: 10px;

  .chat-input {
    border-radius: 20px;
    padding: 10px 16px;
    border: 1px solid var(--input-border);
    background: var(--gray-1);
    
    &:focus {
      box-shadow: none;
      border-color: var(--primary-color);
    }
  }

  .btn-send {
    border-radius: 50%;
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
