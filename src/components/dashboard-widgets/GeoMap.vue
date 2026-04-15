<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useStakeholdersStore } from '@/stores/stakeholders';
import { useDashboardFilterStore } from '@/stores/dashboardFilter';
import { sektorService, subSektorService, getSektorName, getSubSektorParentId } from '@/services/sektor.service';

const stakeholdersStore = useStakeholdersStore();
const filterStore = useDashboardFilterStore();
const emit = defineEmits(['sektor-click']);

const mapReady = ref(false);
const mapError = ref(false);
const sektorList = ref([]);
const subSektorList = ref([]);

const sektorColors = [
    '#845adf', '#e6533c', '#26bf94', '#f5b849', '#0ea5e9',
    '#6366f1', '#14b8a6', '#8c57ff', '#ea580c', '#059669',
    '#dc2626', '#0891b2',
];

// Helper to filter by date range from the global filter store
function isInDateRange(createdAt) {
    const range = filterStore.dateRange;
    if (!range || !range[0] || !range[1] || !createdAt) return true;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return false;
    const start = new Date(range[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range[1]);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
}

onMounted(async () => {
    try {
        const [sektors, subSektors] = await Promise.all([
            sektorService.getAll(),
            subSektorService.getAll(),
        ]);
        sektorList.value = sektors;
        subSektorList.value = subSektors;
        await nextTick();
        mapReady.value = true;
    } catch (e) {
        console.error('GeoMap: failed to load', e);
        mapError.value = true;
    }
});

// Group stakeholders by sektor using sub_sektor ID → parent sektor ID matching
// Now reactive to global filter changes (date range & sektor filter)
const sektorSummary = computed(() => {
    const all = stakeholdersStore.allStakeholders.filter(s => isInDateRange(s.created_at));
    if (!sektorList.value.length || !subSektorList.value.length) return [];

    // If a specific sektor is selected in the global filter, only show that sektor
    const activeSektorId = filterStore.sektorId;

    const sektorsToShow = activeSektorId
        ? sektorList.value.filter(s => String(s.id) === String(activeSektorId))
        : sektorList.value;

    return sektorsToShow.map((sektor, idx) => {
        const name = getSektorName(sektor);

        // Find all sub_sektors belonging to this sektor
        const children = subSektorList.value.filter(ss => {
            const pid = getSubSektorParentId(ss);
            return pid !== undefined && String(pid) === String(sektor.id);
        });
        const childIds = new Set(children.map(c => String(c.id)));

        // Count stakeholders whose sub_sektor.id matches any child
        const count = all.filter(s => {
            const subSektorId = s.sub_sektor?.id || s.id_sub_sektor;
            return subSektorId && childIds.has(String(subSektorId));
        }).length;

        // Use original index for color assignment when filtering
        const originalIdx = sektorList.value.findIndex(s => String(s.id) === String(sektor.id));

        return {
            id: sektor.id,
            name,
            count,
            color: sektorColors[(originalIdx >= 0 ? originalIdx : idx) % sektorColors.length],
            percent: all.length > 0 ? Math.round((count / all.length) * 100) : 0,
        };
    }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
});

const maxCount = computed(() => Math.max(1, ...sektorSummary.value.map(s => s.count)));

function handleSektorClick(sektor) {
    emit('sektor-click', sektor);
}
</script>

<template>
    <div class="dw-card dw-fade-up d-flex flex-column h-100">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff;">
                    <i class="ri-map-pin-line"></i>
                </div>
                <div>
                    <span>Peta Distribusi Stakeholder</span>
                    <div class="dw-card-header-sub">Distribusi per sektor industri</div>
                </div>
            </h6>
        </div>
        <div class="dw-card-body flex-grow-1 d-flex flex-column justify-content-center" style="padding: 16px;">
            <!-- Error -->
            <div v-if="mapError" class="text-center py-4">
                <i class="ri-error-warning-line" style="font-size:2rem; color:var(--dw-danger); opacity:0.5;"></i>
                <p style="font-size:0.8rem; color:var(--dw-text-muted); margin-top:8px;">Gagal memuat peta</p>
            </div>

            <!-- Geo Bars Visualization -->
            <div v-else class="dw-geo-grid">
                <div v-for="(sektor, idx) in sektorSummary" :key="sektor.id"
                     class="dw-geo-row dw-fade-up"
                     :style="{ animationDelay: `${idx * 40}ms` }"
                     @click="handleSektorClick(sektor)">
                    <div class="dw-geo-label">
                        <div class="dw-geo-color" :style="{ background: sektor.color }"></div>
                        <span class="dw-geo-name" :title="sektor.name">{{ sektor.name }}</span>
                    </div>
                    <div class="dw-geo-progress-row">
                        <div class="dw-geo-bar-wrap">
                            <div class="dw-geo-bar"
                                 :style="{
                                     width: `${Math.max(4, (sektor.count / maxCount) * 100)}%`,
                                     background: `linear-gradient(90deg, ${sektor.color}, ${sektor.color}88)`,
                                 }">
                            </div>
                        </div>
                        <div class="dw-geo-stats">
                            <span class="dw-geo-count">{{ sektor.count }}</span>
                            <span class="dw-geo-pct">{{ sektor.percent }}%</span>
                        </div>
                    </div>
                </div>

                <div v-if="sektorSummary.length === 0" class="text-center py-4">
                    <i class="ri-map-2-line" style="font-size:2rem; color:var(--dw-text-muted); opacity:0.4;"></i>
                    <p style="font-size:0.8rem; color:var(--dw-text-muted); margin-top:8px;">Tidak ada data sektor</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dw-geo-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.dw-geo-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    transition: all 0.2s ease;
    cursor: pointer;
}

.dw-geo-row:hover {
    background: rgba(132, 90, 223, 0.04);
}

.dw-geo-label {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.dw-geo-color {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex-shrink: 0;
}

.dw-geo-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--dw-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dw-geo-progress-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding-left: 18px; /* Indent to align with text */
}

.dw-geo-bar-wrap {
    flex-grow: 1;
    height: 8px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 4px;
    overflow: hidden;
}

.dw-geo-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.8s ease-out;
    min-width: 4px;
}

.dw-geo-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 65px;
    flex-shrink: 0;
    justify-content: flex-end;
}

.dw-geo-count {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--dw-text);
}

.dw-geo-pct {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--dw-text-muted);
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 6px;
    border-radius: 4px;
}

@media (max-width: 768px) {
    .dw-geo-progress-row { padding-left: 0; }
}
</style>
