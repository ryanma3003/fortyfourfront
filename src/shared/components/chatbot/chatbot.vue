<template>
  <div class="chatbot-button" @click="toggleChat">
    <div class="icon-container">
      <i class="ti ti-message-chatbot fs-24"></i>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const toggleChat = () => {
  // Future implementation: toggle chat window
};
</script>

<style scoped lang="scss">
.chatbot-button {
  position: fixed;
  bottom: 80px; /* Above back-to-top button if present, or just nicely spaced */
  right: 20px;
  z-index: 999;
  cursor: pointer;
  
  .icon-container {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    transition: all 0.3s ease;
    color: white;

    &:hover {
      transform: translateY(-5px) scale(1.05);
      box-shadow: 0 8px 16px rgba(99, 102, 241, 0.5);
    }
  }
}
</style>
