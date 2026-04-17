<script setup>
import { computed, watch } from 'vue';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const props = defineProps({
    sektorList: { type: Array, default: () => [] },
    subSektorList: { type: Array, default: () => [] },
});

const filterStore = useDashboardFilterStore();

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

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
    if (filterStore.year) c++;
    if (filterStore.quarter) c++;
    if (filterStore.kategoriSe) c++;
    // if custom date range is selected (not bound cleanly to year/quarter)
    if (filterStore.dateRange[0] && !filterStore.year) c++; 
    return c;
});

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
</script>


<template>
    <div class="gf-card">
        <!-- ── Header ── -->
        <div class="gf-header">
            <div class="gf-header-inner">
                <div class="gf-icon-box">
                    <i class="ri-filter-3-line"></i>
                </div>
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
        <div class="gf-body">
            <!-- Quick Range Pills -->
            <div class="gf-quick-bar">
                <span class="gf-quick-label">
                    <i class="ri-flashlight-line"></i> Cepat
                </span>
                <div class="gf-quick-pills">
                    <button v-for="range in quickRanges" 
                            :key="range.label"
                            class="gf-pill"
                            :class="{ active: (filterStore.year === range.year && filterStore.quarter === range.quarter) }"
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
                            <option value="">Custom Range</option>
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

                <!-- Kategori SE -->
                <div class="gf-field">
                    <label class="gf-label"><i class="ri-shield-star-line"></i> Kategori SE</label>
                    <div class="gf-select-wrap">
                        <select :value="filterStore.kategoriSe" 
                                @change="filterStore.setKategoriSe($event.target.value)" 
                                class="gf-select">
                            <option value="">Semua</option>
                            <option value="Strategis">Strategis</option>
                            <option value="Tinggi">Tinggi</option>
                            <option value="Rendah">Rendah</option>
                        </select>
                        <i class="ri-arrow-down-s-line gf-select-caret"></i>
                    </div>
                </div>


            </div>

            <!-- Active filter summary -->
            <transition name="gf-slide">
                <div v-if="activeFilterCount > 0" class="gf-summary">
                    <i class="ri-filter-3-line"></i>
                    <span>{{ filterStore.activeFilterLabel }}</span>
                </div>
            </transition>
        </div>
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
    box-shadow: 0 2px 12px rgba(99,51,228,0.08),
                0 1px 4px rgba(37,99,235,0.06);
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
    gap: 14px;
}

/* Icon box */
.gf-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #60a5fa 100%);
    box-shadow: 0 4px 14px rgba(37,99,235,0.35);
}

.gf-icon-box i {
    font-size: 1.2rem;
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
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 14px rgba(37,99,235,0.35);
    transform: translateY(-1px);
}

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

