<template>
  <Teleport to="body">
    <TransitionGroup name="notif-toast" tag="div" class="notif-toast-container" id="notif-toast-container">
      <div
        v-for="toast in visibleToasts"
        :key="toast.id"
        class="notif-toast"
        :class="[`notif-toast-${toast.type}`]"
        @click="handleClick(toast)"
      >
        <!-- Progress bar auto-dismiss -->
        <div class="notif-toast-progress" :style="{ animationDuration: `${TOAST_DURATION}ms` }"></div>

        <!-- Icon -->
        <div class="notif-toast-icon">
          <i :class="getIcon(toast.type)"></i>
        </div>

        <!-- Content -->
        <div class="notif-toast-body">
          <div class="notif-toast-title">
            <span class="notif-toast-user">{{ toast.user?.name || 'Sistem' }}</span>
            <span class="notif-toast-verb">{{ getVerb(toast.type) }}</span>
            <span class="notif-toast-entity">{{ getTargetLabel(toast) }}</span>
          </div>
          <div v-if="toast.message" class="notif-toast-subtitle">
            {{ toast.message }}
          </div>
        </div>

        <!-- Close -->
        <button class="notif-toast-close" @click.stop="dismiss(toast.id)" aria-label="Tutup">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import { ENTITY_LABELS, ACTION_VERBS } from '@/types/notification.types';
import type { ServerEvent } from '@/types/notification.types';
import { useRouter } from 'vue-router';

const notifStore = useNotificationStore();
const router = useRouter();

const TOAST_DURATION = 5000; // 5 seconds
const MAX_VISIBLE = 3;

const visibleToasts = ref<ServerEvent[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Watch for new toasts in the queue
watch(
  () => notifStore.toastQueue.length,
  () => {
    while (notifStore.toastQueue.length > 0 && visibleToasts.value.length < MAX_VISIBLE) {
      const toast = notifStore.toastQueue[0];
      notifStore.dismissToast(); // remove from queue

      // Don't show duplicates
      if (visibleToasts.value.some(t => t.id === toast.id)) continue;

      visibleToasts.value.push(toast);

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        dismiss(toast.id);
      }, TOAST_DURATION);
      timers.set(toast.id, timer);
    }
  }
);

function dismiss(id: string) {
  visibleToasts.value = visibleToasts.value.filter(t => t.id !== id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function handleClick(toast: ServerEvent) {
  dismiss(toast.id);
  router.push('/notif');
}

function getIcon(type: string): string {
  switch (type) {
    case 'created': return 'ri-add-circle-fill';
    case 'updated': return 'ri-edit-circle-fill';
    case 'deleted': return 'ri-delete-bin-fill';
    default: return 'ri-notification-3-fill';
  }
}

function getVerb(type: string): string {
  return ACTION_VERBS[type] || type;
}

function getEntityLabel(entity: string): string {
  if (!entity || entity === 'unknown') return 'Data';
  return ENTITY_LABELS[entity] || entity.replace(/_/g, ' ');
}

function getTargetLabel(toast: ServerEvent): string {
  const label = getEntityLabel(toast.entity);
  const name = String(toast.entity_name || '').trim();
  if (!name) return toast.entity === 'unknown' ? 'data' : label;

  return name.toLowerCase().startsWith(label.toLowerCase())
    ? name
    : `${label} ${name}`;
}

onUnmounted(() => {
  timers.forEach(timer => clearTimeout(timer));
  timers.clear();
});
</script>

<style scoped>
.notif-toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  max-width: 400px;
  width: 100%;
}

.notif-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(20px);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.notif-toast:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.16),
    0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Dark mode */
[data-theme-mode="dark"] .notif-toast,
html[data-theme-mode="dark"] .notif-toast {
  background: rgba(30, 33, 45, 0.97);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

[data-theme-mode="dark"] .notif-toast-body .notif-toast-title,
html[data-theme-mode="dark"] .notif-toast-body .notif-toast-title {
  color: #e0e0e0;
}

[data-theme-mode="dark"] .notif-toast-body .notif-toast-subtitle,
html[data-theme-mode="dark"] .notif-toast-body .notif-toast-subtitle {
  color: #999;
}

/* Progress bar */
.notif-toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 0 0 12px 12px;
  animation: toast-progress linear forwards;
}

.notif-toast-created .notif-toast-progress { background: linear-gradient(90deg, #10b981, #34d399); }
.notif-toast-updated .notif-toast-progress { background: linear-gradient(90deg, #6366f1, #818cf8); }
.notif-toast-deleted .notif-toast-progress { background: linear-gradient(90deg, #ef4444, #f87171); }

@keyframes toast-progress {
  from { width: 100%; }
  to { width: 0%; }
}

/* Icon */
.notif-toast-icon {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.notif-toast-created .notif-toast-icon {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #059669;
}
.notif-toast-updated .notif-toast-icon {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #4f46e5;
}
.notif-toast-deleted .notif-toast-icon {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #dc2626;
}

/* Body */
.notif-toast-body {
  flex: 1;
  min-width: 0;
}

.notif-toast-title {
  font-size: 13px;
  line-height: 1.4;
  color: #334155;
}

.notif-toast-user {
  font-weight: 600;
  color: #1e293b;
}

.notif-toast-verb {
  margin: 0 3px;
  color: #64748b;
}

.notif-toast-entity {
  font-weight: 500;
  color: #475569;
}

.notif-toast-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Close button */
.notif-toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0;
}

.notif-toast:hover .notif-toast-close {
  opacity: 1;
}

.notif-toast-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #475569;
}

/* Transition animations */
.notif-toast-enter-active {
  animation: toast-slide-in 0.4s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
}

.notif-toast-leave-active {
  animation: toast-slide-out 0.3s cubic-bezier(0.06, 0.71, 0.55, 1) forwards;
}

.notif-toast-move {
  transition: transform 0.3s ease;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-slide-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
}

/* Responsive */
@media (max-width: 576px) {
  .notif-toast-container {
    top: auto;
    bottom: 20px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
</style>
