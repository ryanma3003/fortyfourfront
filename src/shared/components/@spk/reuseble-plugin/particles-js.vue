<script lang="ts" setup>
import { ref, reactive, onMounted, watch } from 'vue';

const isDarkMode = ref(false);

const checkTheme = () => {
  const theme = document.documentElement.getAttribute('data-theme-mode');
  const hasClass =
    document.documentElement.classList.contains('dark-mode') ||
    document.body.classList.contains('dark-mode');

  isDarkMode.value = theme === 'dark' || hasClass;
};

const particlesOptions = reactive({
  particles: {
    number: {
      value: 200,
      density: {
        enable: true,
        area: 400
      }
    },
    color: {
      value: '#000000'
    },
    size: {
      value: 1.5
    },
    opacity: {
      value: 0.5
    },

    // ❌ NO STATIC LINES
    links: {
      enable: false
    },

    move: {
      enable: true,
      speed: 1,
      outModes: 'out'
    }
  },

  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: 'grab'
      }
    },
    modes: {
      grab: {
        distance: 130,
        links: {
          opacity: 0.6,
          width: 1.4,
          color: '#000000' // will be overridden
        }
      }
    }
  },

  detectRetina: false
});

// 🎯 THE REAL FIX
watch(
  isDarkMode,
  (dark) => {
    if (dark) {
      // 🌙 DARK MODE
      particlesOptions.particles.color.value = '#ffffff';
      particlesOptions.interactivity.modes.grab.links.color = '#ffffff';
      particlesOptions.interactivity.modes.grab.links.opacity = 0.35;
      particlesOptions.interactivity.modes.grab.links.width = 1.1;
    } else {
      // ☀️ LIGHT MODE (ANTI BERANTEM)
      particlesOptions.particles.color.value = '#000000';
      particlesOptions.interactivity.modes.grab.links.color = '#444444';
      particlesOptions.interactivity.modes.grab.links.opacity = 0.65;
      particlesOptions.interactivity.modes.grab.links.width = 1.5;
    }
  },
  { immediate: true }
);

onMounted(() => {
  checkTheme();

  const observer = new MutationObserver(checkTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme-mode', 'class']
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
});
</script>

<template>
  <vue-particles id="particles-js" :options="particlesOptions" />
</template>

<style scoped>
#particles-js {
  position: fixed;
  inset: 0;
  z-index: -1;
}
</style>
