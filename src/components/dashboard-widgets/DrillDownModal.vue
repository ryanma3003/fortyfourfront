<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    title: { type: String, default: 'Detail' },
    items: { type: Array, default: () => [] },
    columns: { type: Array, default: () => ['nama_perusahaan', 'sektor', 'status'] },
});

const emit = defineEmits(['close', 'navigate']);

const search = ref('');
const sortKey = ref('');
const sortAsc = ref(true);

// ─── ESC Key Handler ───────────────────────────────────────
const handleEscKey = (event) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
        if (props.visible) {
            emit('close');
        }
    }
};

onMounted(() => {
    document.addEventListener('keydown', handleEscKey);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleEscKey);
});

const filteredItems = computed(() => {
    let data = [...props.items];
    if (search.value.trim()) {
        const q = search.value.toLowerCase();
        data = data.filter(item =>
            Object.values(item).some(v =>
                v && String(v).toLowerCase().includes(q)
            )
        );
    }
    if (sortKey.value) {
        data.sort((a, b) => {
            const va = a[sortKey.value] || '';
            const vb = b[sortKey.value] || '';
            return sortAsc.value
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    }
    return data;
});

function toggleSort(key) {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortKey.value = key;
        sortAsc.value = true;
    }
}

const columnLabels = {
    nama_perusahaan: 'Nama Perusahaan',
    sektor: 'Sektor',
    sub_sektor: 'Sub Sektor',
    status: 'Status',
    created_at: 'Tanggal Dibuat',
    updated_at: 'Tanggal Update',
    csirt_status: 'Status CSIRT',
    csirt_nama: 'Nama CSIRT',
    ikas_score: 'Skor IKAS',
    ikas_kategori: 'Kategori IKAS',
    ikas_maturity: 'Kematangan IKAS',
    nama_se: 'Nama SE',
    kategori_se: 'Kategori SE',
    periode: 'Periode',
    status_data: 'Status Data',
    email: 'Email',
    slug: 'Slug',
};

function getLabel(col) {
    return columnLabels[col] || col.replace(/_/g, ' ');
}

function formatValue(val) {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="dw-modal-overlay" @click.self="$emit('close')">
            <div class="dw-modal-content dw-scale-in">
                <div class="dw-modal-header">
                    <h6 style="font-weight:700; font-size:1rem; margin:0; color:var(--dw-text);">
                        <i class="ri-eye-line me-2" style="color:var(--dw-primary);"></i>
                        {{ title }}
                    </h6>
                    <div class="d-flex align-items-center gap-2">
                        <span class="dw-badge dw-badge-info">{{ filteredItems.length }} item</span>
                        <button class="dw-modal-close" @click="$emit('close')">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>
                </div>
                <div class="dw-modal-body">
                    <!-- Search -->
                    <div class="mb-3 position-relative">
                        <i class="ri-search-line" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--dw-text-muted);font-size:14px;"></i>
                        <input v-model="search" class="form-control form-control-sm"
                               placeholder="Cari data..."
                               style="padding-left:36px; border-radius:10px; font-size:0.82rem;">
                    </div>
                    <!-- Table -->
                    <div class="table-responsive">
                        <table class="dw-table">
                            <thead>
                                <tr>
                                    <th style="width:40px">#</th>
                                    <th v-for="col in columns" :key="col"
                                        @click="toggleSort(col)"
                                        style="cursor:pointer;user-select:none;">
                                        {{ getLabel(col) }}
                                        <i v-if="sortKey === col" :class="sortAsc ? 'ri-arrow-up-s-fill' : 'ri-arrow-down-s-fill'" style="font-size:12px;"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in filteredItems" :key="idx"
                                    @click="$emit('navigate', item)">
                                    <td class="text-muted">{{ idx + 1 }}</td>
                                    <td v-for="col in columns" :key="col">
                                        {{ formatValue(item[col]) }}
                                    </td>
                                </tr>
                                <tr v-if="filteredItems.length === 0">
                                    <td :colspan="columns.length + 1" class="text-center py-4" style="color:var(--dw-text-muted);">
                                        <i class="ri-inbox-line" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.5;"></i>
                                        Tidak ada data
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
