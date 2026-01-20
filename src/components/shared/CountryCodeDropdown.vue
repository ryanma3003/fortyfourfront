<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

interface CountryCode {
  code: string;
  country: string;
  flag: string;
  priority?: boolean;
}

const props = defineProps<{
  modelValue: string;
  error?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// Top priority country codes (ASEAN + Major economies)
const priorityCountryCodes = ["+62", "+1", "+44", "+65", "+60", "+61", "+81", "+82", "+86", "+91", "+66", "+84", "+63", "+673"];

// Comprehensive fallback - Major & Important Countries
const defaultCountryCodes: CountryCode[] = [
  // ASEAN & Priority
  { code: "+62", country: "Indonesia", flag: "🇮🇩", priority: true },
  { code: "+65", country: "Singapore", flag: "🇸🇬", priority: true },
  { code: "+60", country: "Malaysia", flag: "🇲🇾", priority: true },
  { code: "+66", country: "Thailand", flag: "🇹🇭", priority: true },
  { code: "+84", country: "Vietnam", flag: "🇻🇳", priority: true },
  { code: "+63", country: "Philippines", flag: "🇵🇭", priority: true },
  { code: "+673", country: "Brunei", flag: "🇧🇳", priority: true },
  { code: "+95", country: "Myanmar", flag: "🇲🇲", priority: true },
  { code: "+856", country: "Laos", flag: "🇱🇦", priority: true },
  { code: "+855", country: "Cambodia", flag: "🇰🇭", priority: true },
  // Major Economies
  { code: "+1", country: "USA", flag: "🇺🇸", priority: true },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", priority: true },
  { code: "+86", country: "China", flag: "🇨🇳", priority: true },
  { code: "+81", country: "Japan", flag: "🇯🇵", priority: true },
  { code: "+82", country: "South Korea", flag: "🇰🇷", priority: true },
  { code: "+91", country: "India", flag: "🇮🇳", priority: true },
  { code: "+61", country: "Australia", flag: "🇦🇺", priority: true },
];

const countryCodes = ref<CountryCode[]>(defaultCountryCodes);
const isLoading = ref(false);
const searchQuery = ref("");
const showDropdown = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const filteredCountries = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  let filtered = countryCodes.value;
  
  if (query) {
    filtered = countryCodes.value.filter(c => 
      c.country.toLowerCase().includes(query) || c.code.includes(query)
    );
  }
  
  return filtered.sort((a, b) => {
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    return a.country.localeCompare(b.country);
  });
});

const selectedDisplay = computed(() => {
  const country = countryCodes.value.find(c => c.code === props.modelValue);
  return country ? `${country.flag} ${country.code}` : props.modelValue;
});

const priorityList = computed(() => filteredCountries.value.filter(c => c.priority));
const otherList = computed(() => filteredCountries.value.filter(c => !c.priority));

const fetchCountryCodes = async () => {
  isLoading.value = true;
  try {
    const response = await fetch("https://restcountries.com/v3.1/all");
    const data = await response.json();
    
    const codes = data
      .filter((c: any) => c.idd?.root)
      .map((c: any) => ({
        code: c.idd.root + (c.idd.suffixes?.[0] || ""),
        country: c.name.common,
        flag: c.flag || "🏳️",
        priority: priorityCountryCodes.includes(c.idd.root + (c.idd.suffixes?.[0] || ""))
      }))
      .filter((c: CountryCode) => c.code !== "+" && c.code.length > 1);
    
    if (codes.length > 0) countryCodes.value = codes;
  } catch (error) {
    console.error("Failed to fetch country codes:", error);
  } finally {
    isLoading.value = false;
  }
};

const selectCountry = (country: CountryCode) => {
  emit("update:modelValue", country.code);
  showDropdown.value = false;
  searchQuery.value = "";
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false;
  }
};

onMounted(() => {
  fetchCountryCodes();
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="country-code-dropdown position-relative" ref="dropdownRef">
    <button 
      type="button"
      class="btn btn-light border d-flex align-items-center justify-content-between country-code-btn"
      :class="{ 'border-danger': error }"
      @click.stop="showDropdown = !showDropdown"
    >
      <span v-if="isLoading" class="spinner-border spinner-border-sm"></span>
      <span v-else>{{ selectedDisplay }}</span>
      <i class="ri-arrow-down-s-line" :class="{ 'rotate-180': showDropdown }"></i>
    </button>
    
    <!-- Dropdown Menu -->
    <div v-if="showDropdown" class="dropdown-menu-custom position-absolute border rounded shadow-sm mt-1"
      style="top: 100%; left: 0; z-index: 1050; width: 300px; max-height: 350px; overflow: hidden;">
      <!-- Search -->
      <div class="p-2 border-bottom bg-light">
        <div class="input-group input-group-sm">
          <span class="input-group-text bg-white"><i class="ri-search-line text-muted"></i></span>
          <input type="text" class="form-control border-start-0" v-model="searchQuery"
            placeholder="Cari negara..." @click.stop />
          <button v-if="searchQuery" class="btn btn-light border" @click.stop="searchQuery = ''">
            <i class="ri-close-line"></i>
          </button>
        </div>
      </div>
      
      <!-- List -->
      <div class="country-list" style="max-height: 280px; overflow-y: auto;">
        <template v-if="!searchQuery">
          <div class="section-header px-3 py-2 bg-light border-bottom">
            <small class="text-muted fw-semibold text-uppercase" style="font-size: 10px;">⭐ Populer</small>
          </div>
          <div v-for="c in priorityList" :key="c.code" class="country-item d-flex align-items-center gap-2 px-3 py-2"
            :class="{ 'selected': modelValue === c.code }" @click="selectCountry(c)">
            <span class="country-flag">{{ c.flag }}</span>
            <span class="flex-fill text-truncate fw-medium">{{ c.country }}</span>
            <span class="country-code text-muted">{{ c.code }}</span>
            <i v-if="modelValue === c.code" class="ri-check-line text-success"></i>
          </div>
          
          <div class="section-header px-3 py-2 bg-light border-top border-bottom">
            <small class="text-muted fw-semibold text-uppercase" style="font-size: 10px;">🌍 Lainnya</small>
          </div>
          <div v-for="c in otherList" :key="c.code" class="country-item d-flex align-items-center gap-2 px-3 py-2"
            :class="{ 'selected': modelValue === c.code }" @click="selectCountry(c)">
            <span class="country-flag">{{ c.flag }}</span>
            <span class="flex-fill text-truncate">{{ c.country }}</span>
            <span class="country-code text-muted">{{ c.code }}</span>
            <i v-if="modelValue === c.code" class="ri-check-line text-success"></i>
          </div>
        </template>
        
        <template v-else>
          <div class="section-header px-3 py-2 bg-light border-bottom">
            <small class="text-muted">Hasil: "{{ searchQuery }}"</small>
          </div>
          <div v-for="c in filteredCountries" :key="c.code" class="country-item d-flex align-items-center gap-2 px-3 py-2"
            :class="{ 'selected': modelValue === c.code }" @click="selectCountry(c)">
            <span class="country-flag">{{ c.flag }}</span>
            <span class="flex-fill text-truncate">{{ c.country }}</span>
            <span class="country-code text-muted">{{ c.code }}</span>
            <i v-if="modelValue === c.code" class="ri-check-line text-success"></i>
          </div>
        </template>
        
        <div v-if="filteredCountries.length === 0" class="text-center text-muted py-4">
          <i class="ri-search-line fs-28 d-block mb-2 opacity-50"></i>
          <p class="mb-0">Tidak ditemukan</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.country-code-btn {
  min-width: 110px;
  height: calc(2.5rem + 2px); /* Match form-control height */
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-right: none !important;
  padding: 0.375rem 0.75rem;
}

.country-item { cursor: pointer; transition: background-color 0.15s ease; }
.country-item:hover { background-color: rgba(var(--primary-rgb), 0.08) !important; }
.country-item.selected { background-color: rgba(var(--success-rgb), 0.1) !important; }
.dropdown-menu-custom { background-color: var(--custom-white); animation: fadeIn 0.15s ease; }
.country-flag { font-size: 1.25rem; }
.country-code { font-size: 0.75rem; font-family: monospace; }
.rotate-180 { transform: rotate(180deg); transition: transform 0.2s ease; }
.section-header { position: sticky; top: 0; z-index: 1; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

html[data-theme-mode="dark"] .dropdown-menu-custom,
html.dark .dropdown-menu-custom { background-color: var(--custom-white) !important; }
html[data-theme-mode="dark"] .country-item:hover,
html.dark .country-item:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
html[data-theme-mode="dark"] .country-item.selected,
html.dark .country-item.selected { background-color: rgba(34, 197, 94, 0.15) !important; }
</style>
