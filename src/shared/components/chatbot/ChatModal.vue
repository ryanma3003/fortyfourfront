<template>
  <Transition name="chat-fade">
    <div v-if="isOpen" class="chat-floating-window">
      <!-- Header -->
      <div class="chat-header">
        <div class="d-flex align-items-center">
          <div class="icon-box me-3">
            <i class="ti ti-message-chatbot fs-20 text-white"></i>
          </div>
          <div>
            <h5 class="mb-0 text-white fw-bold">AI Assistant</h5>
            <span class="text-white-50 fs-12">Tanya apa saja &bull; Powered by AI</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn-close-custom" @click="clearChat" title="Hapus Sesi Chat" :disabled="isLoading">
            <i class="ti ti-trash"></i>
          </button>
          <button class="btn-close-custom" @click="close">
            <i class="ti ti-x"></i>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="chat-body" ref="chatBody">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-icon-ring mb-4">
            <div class="empty-icon-inner">
              <i class="ti ti-message-chatbot"></i>
            </div>
          </div>
          <h6 class="empty-state-title">AI Siap Membantu</h6>
          <p class="text-muted fs-13">Silakan ketik pertanyaan Anda di bawah ini.</p>
        </div>
        
        <div v-else class="messages-list">
          <div 
            v-for="(msg, index) in messages" 
            :key="index" 
            :class="['message-item', msg.isUser ? 'user' : 'ai']"
          >
            <div class="message-content">
              {{ msg.text }}
              <span v-if="!msg.isUser && index === messages.length - 1 && isLoading" class="typing-indicator">
                <span></span><span></span><span></span>
              </span>
            </div>
            <span class="message-time">{{ msg.time }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="chat-footer">
        <div class="input-container">
          <input 
            type="text" 
            class="form-control chat-input" 
            placeholder="Ketik pesan Anda..." 
            v-model="newMessage"
            @keyup.enter="sendMessage"
            :disabled="isLoading"
          >
          <button class="btn-send" @click="sendMessage" :disabled="isLoading || !newMessage.trim()">
            <i class="ti ti-send" v-if="!isLoading"></i>
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" v-else></span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const messages = ref([
  { text: "Halo! Saya AI Agent Anda. Ada yang bisa saya bantu hari ini?", isUser: false, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
]);
const newMessage = ref('');
const chatBody = ref(null);
const isLoading = ref(false);

const close = () => {
  emit('close');
};

const clearChat = async () => {
  try {
    isLoading.value = true;
    await fetch('/api/chat/delete-session', { method: 'DELETE' });
    messages.value = [
      { text: "Sesi chat telah dihapus. Ada yang bisa saya bantu?", isUser: false, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
  } catch (error) {
    console.error('Error clearing chat session:', error);
  } finally {
    isLoading.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || isLoading.value) return;

  const userText = newMessage.value;

  messages.value.push({
    text: userText,
    isUser: true,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  newMessage.value = '';
  scrollToBottom();
  
  isLoading.value = true;

  const aiMsgIndex = messages.value.push({
    text: '',
    isUser: false,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }) - 1;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: userText })
    });

    if (!response.ok) throw new Error('Terjadi kesalahan dari jaringan');

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 

        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();
            if (dataStr === '[DONE]') {
               done = true;
               break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.message || data.text) {
                messages.value[aiMsgIndex].text += (data.message || data.text || '');
              } else if (data.choices && data.choices.length > 0 && data.choices[0].delta) {
                const content = data.choices[0].delta.content || "";
                messages.value[aiMsgIndex].text += content;
              } else if (data.content !== undefined) {
                messages.value[aiMsgIndex].text += data.content;
              } else {
                messages.value[aiMsgIndex].text += dataStr;
              }
            } catch (e) {
              messages.value[aiMsgIndex].text += dataStr;
            }
            scrollToBottom();
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching AI response:', error);
    messages.value[aiMsgIndex].text += "\n\n(Maaf, terjadi kesalahan saat menghubungi server AI.)";
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
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
.chat-floating-window {
  position: fixed;
  bottom: 20px;
  left: 280px; 
  width: 400px;
  height: 650px;
  max-height: calc(100vh - 40px);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(8,20,80,.25), 0 8px 24px rgba(37,99,235,.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  z-index: 9999;
  
  @media (max-width: 992px) {
    left: 20px;
    right: 20px;
    width: auto;
    bottom: 20px;
  }
}

.chat-fade-enter-active { animation: kse-modal-in .22s ease; }
.chat-fade-leave-active { animation: kse-modal-in .18s ease reverse; }
@keyframes kse-modal-in { 
  from { opacity: 0; transform: scale(.96) translateY(20px); } 
  to { opacity: 1; transform: scale(1) translateY(0); } 
}

.chat-header {
  background: linear-gradient(135deg, #0c1e6b 0%, #1130a0 25%, #1a3fc8 50%, #2563eb 75%, #3b82f6 100%);
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(255,255,255,.2);
    display: flex;
    align-items: center;
    justify-content: center;
    i { font-size: 1.4rem; }
  }

  .btn-close-custom {
    background: rgba(255,255,255,.15); 
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 8px; 
    width: 32px; 
    height: 32px; 
    display: flex; 
    align-items: center;
    justify-content: center; 
    cursor: pointer; 
    color: #fff; 
    font-size: 18px; 
    transition: background .2s;

    &[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not([disabled]) {
      background: rgba(255,255,255,.28);
    }
  }
}

.chat-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background: #f8fafc;
  display: flex;
  flex-direction: column;

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;

    .empty-icon-ring {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(124, 58, 237, 0.12));
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px dashed rgba(37, 99, 235, 0.35);
        animation: rotate 10s linear infinite;
      }
    }

    .empty-icon-inner {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.35);
      i { font-size: 2rem; color: #fff; }
    }

    .empty-state-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e3a8a;
    }
  }
}

@keyframes rotate {
  100% { transform: rotate(360deg); }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .message-item {
    display: flex;
    flex-direction: column;
    max-width: 85%;

    &.ai {
      align-self: flex-start;
      
      .message-content {
        background: #fff;
        color: #334155;
        border: 1px solid #e2e8f0;
        border-radius: 12px 12px 12px 2px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }
    }

    &.user {
      align-self: flex-end;
      align-items: flex-end;

      .message-content {
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        color: #fff;
        border-radius: 12px 12px 2px 12px;
        box-shadow: 0 4px 12px rgba(37,99,235,0.25);
      }
    }

    .message-content {
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message-time {
      font-size: 11px;
      margin-top: 5px;
      color: #94a3b8;
      font-weight: 500;
    }
  }
}

.chat-footer {
  padding: 1rem 1.5rem;
  background: #fff;
  border-top: 1px solid #f0f4fa;

  .input-container {
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1.5px solid #dde5f4;
    border-radius: 50px;
    padding: 4px 4px 4px 16px;
    transition: all 0.2s;

    &:focus-within {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
      background: #fff;
    }
  }

  .chat-input {
    border: none;
    background: transparent;
    padding: 8px 0;
    flex: 1;
    font-size: 13.5px;
    
    &:focus {
      box-shadow: none;
      outline: none;
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  .btn-send {
    border: none;
    border-radius: 50px;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    color: #fff;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(37,99,235,0.25);

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(37,99,235,0.35);
    }

    &:disabled {
      background: #cbd5e1;
      box-shadow: none;
      cursor: not-allowed;
    }
  }
}

/* Typing indicator dots */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;

  span {
    display: inline-block;
    width: 5px;
    height: 5px;
    background-color: currentColor;
    border-radius: 50%;
    margin: 0 2px;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
