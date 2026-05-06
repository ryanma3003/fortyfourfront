<script setup>
import { computed, watch, nextTick, ref, onMounted, onUnmounted } from 'vue';
import gsap from 'gsap';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const props = defineProps({
    sektorList: { type: Array, default: () => [] },
    subSektorList: { type: Array, default: () => [] },
});

const filterStore = useDashboardFilterStore();
const isDarkMode = ref(false);
const isFilterBodyHidden = ref(false);
let themeObserver;

function syncThemeMode() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    isDarkMode.value =
        root.getAttribute('data-theme-mode') === 'dark' ||
        body?.getAttribute('data-theme-mode') === 'dark' ||
        root.classList.contains('dark') ||
        body?.classList.contains('dark');
}

onMounted(() => {
    syncThemeMode();
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
    }
});

onUnmounted(() => {
    themeObserver?.disconnect();
});

const currentYear = new Date().getFullYear();
const startYear = 2025;
const years = Array.from(
    { length: Math.max(1, currentYear - startYear + 1) }, 
    (_, i) => String(startYear + i)
).reverse();

// Computed binding for date picker (so it understands Date objects while store holds strings)
const datePickerModel = computed({
    get() {
        const [start, end] = filterStore.dateRange;
        if (!start) return null;
        return [new Date(start), end ? new Date(end) : new Date(start)];
    },
    set(val) {
        if (!val) {
            filterStore.updateDateRange(null, null);
            return;
        }
        if (Array.isArray(val)) {
            filterStore.updateDateRange(val[0], val[1] || val[0]);
        }
    }
});

const activeFilterCount = computed(() => {
    let c = 0;
    if (filterStore.sektorId) c++;
    // Don't count "ALL" (Semua Sub Sektor) as an active filter
    if (filterStore.subSektorId && filterStore.subSektorId !== 'ALL') c++;
    // Don't count the current year if it's the only time filter
    if (filterStore.year && filterStore.year !== String(currentYear)) c++;
    if (filterStore.quarter) c++;
    if (filterStore.kategoriSe) c++;
    // if custom date range is selected (not bound cleanly to year/quarter)
    if (filterStore.dateRange[0] && !filterStore.year) c++; 
    return c;
});

const isRangeActive = (range) => {
    if (range.year) {
        return filterStore.year === range.year && filterStore.quarter === (range.quarter || '');
    }
    if (range.start && range.end) {
        const startStr = filterStore.formatDate(range.start);
        const endStr = filterStore.formatDate(range.end);
        return filterStore.dateRange[0] === startStr && filterStore.dateRange[1] === endStr;
    }
    return false;
};

const filteredSubSektorList = computed(() => {
    if (!filterStore.sektorId) return props.subSektorList;
    return props.subSektorList.filter(ss => {
        const pid = ss.id_sektor || ss.sektor_id;
        return String(pid) === String(filterStore.sektorId);
    });
});

function handleSubSektorChange(id) {
    if (id === 'ALL_GLOBAL') {
        filterStore.setSektorId('');
        nextTick(() => {
            filterStore.setSubSektorId('ALL');
        });
        return;
    }

    filterStore.setSubSektorId(id);
    
    // Auto-select parent sektor if not already selected
    if (id && id !== 'ALL' && !filterStore.sektorId) {
        const ss = props.subSektorList.find(x => String(x.id) === String(id));
        const pid = ss?.id_sektor || ss?.sektor_id;
        if (pid) {
            filterStore.setSektorId(String(pid));
            // Restore the subSektorId because setSektorId resets it
            nextTick(() => {
                filterStore.setSubSektorId(id);
            });
        }
    }
}

const quickRanges = [
    { label: 'Bulan Ini', start: new Date(currentYear, new Date().getMonth(), 1), end: new Date(currentYear, new Date().getMonth() + 1, 0) },
    { label: 'Q1', year: String(currentYear), quarter: '1' },
    { label: 'Q2', year: String(currentYear), quarter: '2' },
    { label: 'Q3', year: String(currentYear), quarter: '3' },
    { label: 'Q4', year: String(currentYear), quarter: '4' },
    { label: 'Tahun Ini', year: String(currentYear), quarter: '' },
];

function applyQuickRange(range) {
    if (range.year) {
        if (range.quarter) filterStore.updateQuarter(range.quarter, range.year);
        else filterStore.updateYear(range.year);
    } else if (range.start && range.end) {
        filterStore.updateDateRange(range.start, range.end);
    }
}

const detailedFilterLabel = computed(() => {
    const parts = [];

    // Date
    let dateLabel = filterStore.year ? filterStore.year : 'Semua Waktu';
    if (filterStore.quarter) {
        dateLabel = `Q${filterStore.quarter} ${dateLabel}`;
    } else if (filterStore.dateRange[0] && filterStore.dateRange[1] && !filterStore.year) {
        dateLabel = `${filterStore.dateRange[0]} s/d ${filterStore.dateRange[1]}`;
    }
    parts.push(dateLabel);

    // Sektor
    if (filterStore.sektorId) {
        const s = props.sektorList.find(x => String(x.id) === String(filterStore.sektorId));
        if (s) {
            parts.push(s.nama_sektor || s.nama);
        } else {
            parts.push('Sektor Terpilih');
        }
    }

    // Sub Sektor
    if (filterStore.sektorId && filterStore.subSektorId && filterStore.subSektorId !== 'ALL') {
        const ss = props.subSektorList.find(x => String(x.id) === String(filterStore.subSektorId));
        if (ss) {
            parts.push(ss.nama_sub_sektor || ss.nama);
        } else {
            parts.push('Sub Sektor Terpilih');
        }
    } else if (filterStore.sektorId && filterStore.subSektorId === 'ALL') {
        parts.push('Semua Sub Sektor');
    }

    // Kategori SE
    if (filterStore.kategoriSe) {
        parts.push(filterStore.kategoriSe);
    }

    return parts.join(' | ');
});

function beforeFilterEnter(el) {
    gsap.killTweensOf(el);
    gsap.set(el, {
        height: 0,
        overflow: 'hidden',
    });
}

function enterFilter(el, done) {
    gsap.killTweensOf(el);
    gsap.to(el, {
        height: el.scrollHeight,
        duration: 0.18,
        ease: 'power1.out',
        onComplete: () => {
            gsap.set(el, { height: 'auto', overflow: 'visible' });
            done();
        },
    });
}

function leaveFilter(el, done) {
    gsap.killTweensOf(el);
    gsap.fromTo(
        el,
        {
            height: el.offsetHeight,
            overflow: 'hidden',
        },
        {
            height: 0,
            duration: 0.16,
            ease: 'power1.in',
            onComplete: done,
        },
    );
}
</script>


<template>
    <div class="gf-card" :class="{ 'is-dark': isDarkMode }">
        <!-- ── Header ── -->
        <div class="gf-header">
            <div class="gf-header-inner">
                <button
                    type="button"
                    class="gf-icon-box"
                    :title="isFilterBodyHidden ? 'Tampilkan filter' : 'Sembunyikan filter'"
                    :aria-label="isFilterBodyHidden ? 'Tampilkan filter' : 'Sembunyikan filter'"
                    @click="isFilterBodyHidden = !isFilterBodyHidden"
                >
                    <i class="ri-filter-3-line"></i>
                </button>
                <div>
                    <h5 class="gf-header-title">Filter & Analisis</h5>
                    <p class="gf-header-sub">Sesuaikan periode, sektor, dan kategori data</p>
                </div>
            </div>
            <div class="gf-header-actions">
                <span v-if="activeFilterCount" class="gf-count-badge">
                    <i class="ri-filter-3-fill"></i> {{ activeFilterCount }} aktif
                </span>
                <button v-if="activeFilterCount > 0" class="gf-reset-btn" @click="filterStore.resetFilter()">
                    <i class="ri-restart-line"></i> Reset
                </button>
            </div>
        </div>

        <!-- ── Body ── -->
        <transition
            :css="false"
            @before-enter="beforeFilterEnter"
            @enter="enterFilter"
            @leave="leaveFilter"
        >
        <div v-if="!isFilterBodyHidden" class="gf-body">
            <!-- Quick Range Pills -->
            <div class="gf-quick-bar">
                <span class="gf-quick-label">
                    <i class="ri-flashlight-line"></i> Periode
                </span>
                <div class="gf-quick-pills">
                    <button v-for="range in quickRanges" 
                            :key="range.label"
                            class="gf-pill"
                            :class="{ active: isRangeActive(range) }"
                            @click="applyQuickRange(range)">
                        {{ range.label }}
                    </button>
                </div>
            </div>



            <!-- Filter Controls Grid -->
            <div class="gf-controls">
                <!-- Tahun -->
                <div class="gf-field">
                    <label class="gf-label"><i class="ri-calendar-2-line"></i> Tahun</label>
                    <div class="gf-select-wrap">
                        <select :value="filterStore.year" 
                                @change="filterStore.updateYear($event.target.value)" 
                                class="gf-select">
                            <option value="">Semua Tahun</option>
                            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
                        </select>
                        <i class="ri-arrow-down-s-line gf-select-caret"></i>
                    </div>
                </div>

                <!-- Kuartal -->
                <div class="gf-field">
                    <label class="gf-label"><i class="ri-calendar-check-line"></i> Kuartal</label>
                    <div class="gf-select-wrap">
                        <select :value="filterStore.quarter" 
                                @change="filterStore.updateQuarter($event.target.value)" 
                                class="gf-select"
                                :disabled="!filterStore.year">
                            <option value="">Semua</option>
                            <option value="1">Q1 (Jan-Mar)</option>
                            <option value="2">Q2 (Apr-Jun)</option>
                            <option value="3">Q3 (Jul-Sep)</option>
                            <option value="4">Q4 (Okt-Des)</option>
                        </select>
                        <i class="ri-arrow-down-s-line gf-select-caret"></i>
                    </div>
                </div>

                <!-- Sektor -->
                <div class="gf-field">
                    <label class="gf-label"><i class="ri-building-4-line"></i> Sektor</label>
                    <div class="gf-select-wrap">
                        <select :value="filterStore.sektorId" 
                                @change="filterStore.setSektorId($event.target.value)" 
                                class="gf-select">
                            <option value="">Semua Sektor</option>
                            <option v-for="s in sektorList" :key="s.id" :value="s.id">
                                {{ s.nama_sektor || s.nama }}
                            </option>
                        </select>
                        <i class="ri-arrow-down-s-line gf-select-caret"></i>
                    </div>
                </div>

                <!-- Sub Sektor -->
                <div class="gf-field">
                    <label class="gf-label"><i class="ri-building-2-line"></i> Sub Sektor</label>
                    <div class="gf-select-wrap">
                        <select :value="filterStore.sektorId ? filterStore.subSektorId : (filterStore.subSektorId === 'ALL' ? 'ALL_GLOBAL' : filterStore.subSektorId)" 
                                @change="handleSubSektorChange($event.target.value)" 
                                class="gf-select">
                            <option value="ALL_GLOBAL">Semua Sektor</option>
                            <option value="">Pilih Sub Sektor</option>
                            <option v-if="filterStore.sektorId" value="ALL">Semua Sub Sektor (Per Sektor)</option>
                            <option v-for="ss in filteredSubSektorList" :key="ss.id" :value="ss.id">
                                {{ ss.nama_sub_sektor || ss.nama }}
                            </option>
                        </select>
                        <i class="ri-arrow-down-s-line gf-select-caret"></i>
                    </div>
                </div>




            </div>

            <!-- Active filter summary -->
            <transition name="gf-slide">
                <div v-if="activeFilterCount > 0" class="gf-summary">
                    <i class="ri-filter-3-line"></i>
                    <span>{{ detailedFilterLabel }}</span>
                </div>
            </transition>
        </div>
        </transition>
    </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════
   GlobalFilter — style2.css design language
   Palette: #0c1e6b → #2563eb → #3b82f6  (blue-indigo)
   Matches: gradient-header-card, stat-card, badge-sektor
   ══════════════════════════════════════════════════════════ */

/* ── Card shell ── */
.gf-card {
    border: 1px solid #dae4f0;
    border-radius: 16px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 4px 20px rgba(30,64,175,0.08),
                0 2px 8px rgba(30,64,175,0.05);
}

/* ── Header (clean, no background color) ── */
.gf-header {
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #e8eef6;
}

.gf-header-inner {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* Icon box */
.gf-icon-box {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
    box-shadow: 0 3px 10px rgba(37,99,235,0.3);
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.gf-icon-box:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 14px rgba(37,99,235,0.38);
}

.gf-icon-box i {
    font-size: 1rem;
    color: #fff;
}

.gf-header-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: #1e3a5f;
    margin: 0;
    letter-spacing: 0.01em;
}

.gf-header-sub {
    font-size: 12px;
    color: #6b84a3;
    margin: 2px 0 0 0;
}

.gf-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

/* ── Count badge ── */
.gf-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    background: #dbeafe;
    border: 1px solid #93c5fd;
    border-radius: 50px;
    font-size: 11.5px;
    font-weight: 700;
    color: #1e40af;
    white-space: nowrap;
}

/* ── Reset button ── */
.gf-reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.gf-reset-btn:hover {
    background: #dc2626;
    color: #fff;
    border-color: #dc2626;
    box-shadow: 0 4px 14px rgba(220,38,38,0.3);
}

.gf-reset-btn i {
    font-size: 14px;
}

/* ── Body ── */
.gf-body {
    padding: 1.25rem 1.5rem 1rem;
    background: linear-gradient(145deg, #fff 0%, #f8fbff 100%);
}

/* ── Quick range bar ── */
.gf-quick-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 1.1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e8eef6;
    flex-wrap: wrap;
}

.gf-quick-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 800;
    color: #6b84a3;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
}

.gf-quick-label i {
    font-size: 14px;
    color: #2563eb;
}

.gf-quick-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.gf-pill {
    padding: 5px 14px;
    border: 1.5px solid #dae4f0;
    border-radius: 50px;
    background: #fff;
    font-size: 12px;
    font-weight: 600;
    color: #4a6fa5;
    cursor: pointer;
    transition: all 0.22s ease;
}

.gf-pill:hover {
    border-color: #2563eb;
    color: #1d4ed8;
    background: #e8f0fe;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(37,99,235,0.12);
}

.gf-pill.active {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 14px rgba(37,99,235,0.35);
    transform: translateY(-1px);
}

.kse-pill.active {
    background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
    box-shadow: 0 4px 14px rgba(249,115,22,0.3);
}

.mt-n1 { margin-top: -0.25rem !important; }
.border-0 { border: 0 !important; }
.pt-0 { padding-top: 0 !important; }

/* ── Controls grid ── */
.gf-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 14px;
    margin-bottom: 10px;
}

.gf-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}



.gf-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.69rem;
    font-weight: 800;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.gf-label i {
    font-size: 13px;
    color: #2563eb;
}

/* ── Custom select ── */
.gf-select-wrap {
    position: relative;
}

.gf-select {
    width: 100%;
    padding: 8px 32px 8px 12px;
    border: 1.5px solid #dde5f4;
    border-radius: 10px;
    background: #fff;
    font-size: 13px;
    font-weight: 500;
    color: #1e3a5f;
    cursor: pointer;
    transition: border-color 0.25s, box-shadow 0.25s;
    height: 40px;
    font-family: inherit;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
}

.gf-select-caret {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: #93b8de;
    pointer-events: none;
    transition: color 0.25s;
}

.gf-select:hover {
    border-color: #2563eb;
}

.gf-select:hover + .gf-select-caret {
    color: #2563eb;
}

.gf-select:focus {
    outline: none;
    border-color: #1a3fc8;
    box-shadow: 0 0 0 3px rgba(26,63,200,0.1);
}

.gf-select:focus + .gf-select-caret {
    color: #1a3fc8;
}

.gf-select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: #f3f4f6;
    border-color: #e2e8f0;
}



/* ── Summary bar ── */
.gf-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    margin-top: 12px;
    background: linear-gradient(145deg, #f8fbff 0%, #eef3fb 100%);
    border: 1px solid #dae4f0;
    border-radius: 10px;
    font-size: 12.5px;
    font-weight: 500;
    color: #1e3a5f;
}

.gf-summary i {
    color: #2563eb;
    font-size: 15px;
    flex-shrink: 0;
}

.gf-card.is-dark {
    color-scheme: dark;
    background: #151a2b;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow:
        0 16px 38px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.gf-card.is-dark .gf-header {
    border-bottom-color: rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96));
}

.gf-card.is-dark .gf-body {
    background:
        radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.12), transparent 34%),
        linear-gradient(145deg, #161b2d 0%, #111827 100%);
}

.gf-card.is-dark .gf-header-title {
    color: #eef4ff;
}

.gf-card.is-dark .gf-header-sub,
.gf-card.is-dark .gf-quick-label {
    color: #8fa3bf;
}

.gf-card.is-dark .gf-quick-bar {
    border-bottom-color: rgba(148, 163, 184, 0.18);
}

.gf-card.is-dark .gf-pill {
    background: rgba(15, 23, 42, 0.86) !important;
    border-color: rgba(147, 197, 253, 0.26) !important;
    color: #bfdbfe !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.gf-card.is-dark .gf-pill:hover {
    background: rgba(37, 99, 235, 0.2) !important;
    border-color: rgba(96, 165, 250, 0.72) !important;
    color: #e0f2fe !important;
}

.gf-card.is-dark .gf-pill.active {
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #60a5fa 100%) !important;
    border-color: rgba(96, 165, 250, 0.72) !important;
    color: #fff !important;
    box-shadow:
        0 8px 20px rgba(37, 99, 235, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.gf-card.is-dark .gf-label {
    color: #c6d3e5;
}

.gf-card.is-dark .gf-select {
    background-color: rgba(15, 23, 42, 0.9) !important;
    border-color: rgba(147, 197, 253, 0.28) !important;
    color: #e5eefb !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    color-scheme: dark;
}

.gf-card.is-dark .gf-select:hover {
    background-color: rgba(17, 24, 39, 0.96) !important;
    border-color: rgba(96, 165, 250, 0.76) !important;
}

.gf-card.is-dark .gf-select:focus {
    background-color: rgba(17, 24, 39, 0.98) !important;
    border-color: #60a5fa !important;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18) !important;
}

.gf-card.is-dark .gf-select:disabled {
    background: rgba(30, 41, 59, 0.62) !important;
    border-color: rgba(148, 163, 184, 0.14) !important;
    color: #7f8da3 !important;
}

.gf-card.is-dark .gf-select option {
    background: #111827 !important;
    color: #e5eefb !important;
}

.gf-card.is-dark .gf-select-caret {
    color: #93c5fd !important;
}

.gf-card.is-dark .gf-count-badge {
    background: rgba(37, 99, 235, 0.18);
    border-color: rgba(96, 165, 250, 0.35);
    color: #bfdbfe;
}

.gf-card.is-dark .gf-reset-btn {
    background: rgba(239, 68, 68, 0.13);
    border-color: rgba(248, 113, 113, 0.3);
    color: #fca5a5;
}

.gf-card.is-dark .gf-reset-btn:hover {
    background: #dc2626;
    border-color: #dc2626;
    color: #fff;
}

.gf-card.is-dark .gf-summary {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.88) 0%, rgba(17, 24, 39, 0.92) 100%);
    border-color: rgba(148, 163, 184, 0.2);
    color: #dbeafe;
}

/* Dark mode */
:global(html[data-theme-mode="dark"]) .gf-card,
:global(html.dark) .gf-card {
    color-scheme: dark;
    background: #151a2b;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow:
        0 16px 38px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:global(html[data-theme-mode="dark"]) .gf-header,
:global(html.dark) .gf-header {
    border-bottom-color: rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96));
}

:global(html[data-theme-mode="dark"]) .gf-body,
:global(html.dark) .gf-body {
    background:
        radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.12), transparent 34%),
        linear-gradient(145deg, #161b2d 0%, #111827 100%);
}

:global(html[data-theme-mode="dark"]) .gf-header-title,
:global(html.dark) .gf-header-title {
    color: #eef4ff;
}

:global(html[data-theme-mode="dark"]) .gf-header-sub,
:global(html.dark) .gf-header-sub,
:global(html[data-theme-mode="dark"]) .gf-quick-label,
:global(html.dark) .gf-quick-label {
    color: #8fa3bf;
}

:global(html[data-theme-mode="dark"]) .gf-quick-bar,
:global(html.dark) .gf-quick-bar {
    border-bottom-color: rgba(148, 163, 184, 0.18);
}

:global(html[data-theme-mode="dark"]) .gf-pill,
:global(html.dark) .gf-pill {
    background: rgba(15, 23, 42, 0.72);
    border-color: rgba(147, 197, 253, 0.24);
    color: #bfdbfe;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

:global(html[data-theme-mode="dark"]) .gf-pill:hover,
:global(html.dark) .gf-pill:hover {
    background: rgba(37, 99, 235, 0.16);
    border-color: rgba(96, 165, 250, 0.62);
    color: #e0f2fe;
}

:global(html[data-theme-mode="dark"]) .gf-pill.active,
:global(html.dark) .gf-pill.active {
    color: #fff;
    box-shadow:
        0 8px 20px rgba(37, 99, 235, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

:global(html[data-theme-mode="dark"]) .gf-label,
:global(html.dark) .gf-label {
    color: #c6d3e5;
}

:global(html[data-theme-mode="dark"]) .gf-select,
:global(html.dark) .gf-select {
    background-color: rgba(15, 23, 42, 0.76);
    border-color: rgba(147, 197, 253, 0.24);
    color: #e5eefb;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

:global(html[data-theme-mode="dark"]) .gf-select:hover,
:global(html.dark) .gf-select:hover {
    border-color: rgba(96, 165, 250, 0.68);
}

:global(html[data-theme-mode="dark"]) .gf-select:focus,
:global(html.dark) .gf-select:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
}

:global(html[data-theme-mode="dark"]) .gf-select:disabled,
:global(html.dark) .gf-select:disabled {
    background: rgba(30, 41, 59, 0.62);
    border-color: rgba(148, 163, 184, 0.14);
    color: #7f8da3;
}

:global(html[data-theme-mode="dark"]) .gf-select option,
:global(html.dark) .gf-select option {
    background: #111827;
    color: #e5eefb;
}

:global(html[data-theme-mode="dark"]) .gf-select-caret,
:global(html.dark) .gf-select-caret {
    color: #7aa7e8;
}

:global(html[data-theme-mode="dark"]) .gf-count-badge,
:global(html.dark) .gf-count-badge {
    background: rgba(37, 99, 235, 0.18);
    border-color: rgba(96, 165, 250, 0.35);
    color: #bfdbfe;
}

:global(html[data-theme-mode="dark"]) .gf-reset-btn,
:global(html.dark) .gf-reset-btn {
    background: rgba(239, 68, 68, 0.13);
    border-color: rgba(248, 113, 113, 0.3);
    color: #fca5a5;
}

:global(html[data-theme-mode="dark"]) .gf-reset-btn:hover,
:global(html.dark) .gf-reset-btn:hover {
    background: #dc2626;
    border-color: #dc2626;
    color: #fff;
}

:global(html[data-theme-mode="dark"]) .gf-summary,
:global(html.dark) .gf-summary {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.88) 0%, rgba(17, 24, 39, 0.92) 100%);
    border-color: rgba(148, 163, 184, 0.2);
    color: #dbeafe;
}

/* ═══════ Animations ═══════ */
.gf-slide-enter-active,
.gf-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.gf-slide-enter-from,
.gf-slide-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

/* ═══════ Responsive ═══════ */
@media (max-width: 1024px) {
    .gf-controls {
        grid-template-columns: repeat(2, 1fr);
    }
    .gf-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    .gf-header-actions {
        width: 100%;
        justify-content: flex-start;
    }
}

@media (max-width: 768px) {
    .gf-body {
        padding: 1rem 1.25rem 0.75rem;
    }
    .gf-controls {
        grid-template-columns: 1fr;
    }
    .gf-quick-bar {
        flex-direction: column;
        align-items: flex-start;
    }
    .gf-quick-pills {
        width: 100%;
    }
    .gf-pill {
        flex: 1;
        min-width: 70px;
        text-align: center;
    }
    .gf-header-title {
        font-size: 0.95rem;
    }
}

@media (max-width: 576px) {
    .gf-body {
        padding: 0.75rem;
    }
    .gf-quick-pills {
        gap: 5px;
    }
    .gf-pill {
        padding: 4px 10px;
        font-size: 11px;
    }
    .gf-header-actions {
        flex-direction: column;
        width: 100%;
        gap: 6px;
    }
    .gf-reset-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>

