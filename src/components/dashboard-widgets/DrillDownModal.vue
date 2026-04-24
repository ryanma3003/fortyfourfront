<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import DrillDownRow from './DrillDownRow.vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    title: { type: String, default: 'Detail' },
    items: { type: Array, default: () => [] },
    columns: { type: Array, default: () => ['nama_perusahaan', 'sektor', 'status'] },
    isLoading: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'navigate']);

function goToDetail(item) {
    emit('navigate', item);
    emit('close');
}

const search = ref('');
const sortKey = ref('');
const sortAsc = ref(true);
const currentPage = ref(1);
const perPage = 15;

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

// Reset page when search changes
watch(search, () => {
    currentPage.value = 1;
});

// Reset search & page when modal opens
watch(() => props.visible, (val) => {
    if (val) {
        search.value = '';
        currentPage.value = 1;
        sortKey.value = '';
        sortAsc.value = true;
    }
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

const totalPages = computed(() => Math.ceil(filteredItems.value.length / perPage) || 1);

const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * perPage;
    return filteredItems.value.slice(start, start + perPage);
});

const pageNumbers = computed(() => {
    const total = totalPages.value;
    const current = currentPage.value;
    const pages = [];
    if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (current > 3) pages.push('...');
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (current < total - 2) pages.push('...');
        pages.push(total);
    }
    return pages;
});

function toggleSort(key) {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortKey.value = key;
        sortAsc.value = true;
    }
    currentPage.value = 1;
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

// Map columns to appropriate icons
const columnIcons = {
    nama_perusahaan: 'ri-building-2-line',
    sektor: 'ri-pie-chart-2-line',
    sub_sektor: 'ri-organization-chart',
    status: 'ri-checkbox-circle-line',
    created_at: 'ri-calendar-line',
    updated_at: 'ri-time-line',
    csirt_status: 'ri-shield-check-line',
    csirt_nama: 'ri-shield-line',
    ikas_score: 'ri-star-line',
    ikas_kategori: 'ri-bar-chart-line',
    ikas_maturity: 'ri-award-line',
    nama_se: 'ri-file-text-line',
    kategori_se: 'ri-folder-line',
    periode: 'ri-calendar-check-line',
    status_data: 'ri-database-2-line',
    email: 'ri-mail-line',
    slug: 'ri-link',
};

function getColumnIcon(col) {
    return columnIcons[col] || 'ri-information-line';
}

// Cell rendering logic moved to DrillDownRow.vue

// Get title icon based on modal title
const titleIcon = computed(() => {
    const t = (props.title || '').toLowerCase();
    if (t.includes('csirt')) return 'ri-shield-check-line';
    if (t.includes('ikas')) return 'ri-star-line';
    if (t.includes('stakeholder') || t.includes('perusahaan')) return 'ri-building-2-line';
    if (t.includes('se ') || t.includes('surat')) return 'ri-file-text-line';
    if (t.includes('kse')) return 'ri-checkbox-circle-line';
    if (t.includes('sektor')) return 'ri-pie-chart-2-line';
    if (t.includes('data')) return 'ri-database-2-line';
    return 'ri-eye-line';
});
</script>

<template>
    <Teleport to="body">
        <Transition name="ddm-overlay">
            <div v-if="visible" class="ddm-overlay" @click.self="$emit('close')">
                <Transition name="ddm-panel" appear>
                    <div class="ddm-panel">
                        <!-- ═══ HEADER ═══ -->
                        <div class="ddm-header">
                            <div class="ddm-header-inner">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="ddm-header-icon">
                                        <i :class="titleIcon"></i>
                                    </div>
                                    <div>
                                        <h6 class="ddm-header-title mb-0">{{ title }}</h6>
                                        <p class="ddm-header-sub mb-0">
                                            <i class="ri-database-2-line me-1"></i>
                                            {{ filteredItems.length }} data ditemukan
                                        </p>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="ddm-count-badge">
                                        <i class="ri-list-check me-1"></i>
                                        {{ filteredItems.length }}
                                    </span>
                                    <button class="ddm-close-btn" @click="$emit('close')" title="Tutup (ESC)">
                                        <i class="ri-close-line"></i>
                                    </button>
                                </div>
                            </div>
                            <!-- Gradient accent line -->
                            <div class="ddm-header-accent"></div>
                        </div>

                        <!-- ═══ BODY ═══ -->
                        <div class="ddm-body">
                            <!-- Search Bar -->
                            <div class="ddm-search-wrap">
                                <div class="ddm-search-box">
                                    <i class="ri-search-line ddm-search-icon"></i>
                                    <input v-model="search" 
                                           class="ddm-search-input form-control"
                                           placeholder="Cari nama, sektor, status..."
                                           autocomplete="off" />
                                    <button v-if="search" class="ddm-search-clear" @click="search = ''">
                                        <i class="ri-close-circle-fill"></i>
                                    </button>
                                </div>
                                <div class="ddm-search-info">
                                    <span class="text-muted" style="font-size:0.72rem;">
                                        Menampilkan {{ paginatedItems.length }} dari {{ filteredItems.length }} data
                                    </span>
                                </div>
                            </div>

                            <!-- Table -->
                            <div class="ddm-table-wrap">
                                <table class="ddm-table">
                                    <thead>
                                        <tr>
                                            <th class="ddm-th-no">#</th>
                                            <th v-for="col in columns" :key="col"
                                                @click="toggleSort(col)"
                                                class="ddm-th-sortable">
                                                <div class="d-flex align-items-center gap-1">
                                                    <i :class="getColumnIcon(col)" class="ddm-th-icon"></i>
                                                    <span>{{ getLabel(col) }}</span>
                                                    <span class="ddm-sort-indicator" v-if="sortKey === col">
                                                        <i :class="sortAsc ? 'ri-arrow-up-s-fill' : 'ri-arrow-down-s-fill'"></i>
                                                    </span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Loading State -->
                                        <template v-if="isLoading">
                                            <tr v-for="i in 5" :key="'skel-' + i" class="ddm-row">
                                                <td class="ddm-td-no">
                                                    <span class="ddm-skeleton" style="width: 20px;"></span>
                                                </td>
                                                <td v-for="col in columns" :key="'skel-col-' + col" class="ddm-td">
                                                    <span class="ddm-skeleton"></span>
                                                </td>
                                            </tr>
                                        </template>

                                        <!-- Data Rows -->
                                        <template v-else-if="filteredItems.length > 0">
                                            <DrillDownRow 
                                                v-for="(item, idx) in paginatedItems" 
                                                :key="idx"
                                                :item="item"
                                                :columns="columns"
                                                :index="idx"
                                                :pageOffset="(currentPage - 1) * perPage"
                                                @navigate="goToDetail"
                                            />
                                        </template>

                                        <!-- Empty State -->
                                        <tr v-else>
                                            <td :colspan="columns.length + 1" class="ddm-empty-state">
                                                <div class="ddm-empty-icon-wrap">
                                                    <div class="ddm-empty-icon-ring">
                                                        <i class="ri-inbox-2-line"></i>
                                                    </div>
                                                </div>
                                                <h6 class="fw-bold mt-3 mb-1" style="color: var(--dw-text);">Data tidak tersedia</h6>
                                                <p class="text-muted mb-0" style="font-size: 0.8rem;">
                                                    {{ search ? 'Coba ubah kata kunci pencarian Anda' : 'Belum ada data untuk ditampilkan saat ini' }}
                                                </p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- ═══ FOOTER ═══ -->
                        <div v-if="totalPages > 1" class="ddm-footer">
                            <div class="ddm-footer-info">
                                <span class="text-muted" style="font-size:0.75rem;">
                                    Halaman {{ currentPage }} dari {{ totalPages }}
                                </span>
                            </div>
                            <nav class="ddm-pagination">
                                <button class="ddm-page-btn" 
                                        :disabled="currentPage === 1"
                                        @click="currentPage = currentPage - 1">
                                    <i class="ri-arrow-left-s-line"></i>
                                </button>
                                <template v-for="(p, i) in pageNumbers" :key="i">
                                    <span v-if="p === '...'" class="ddm-page-ellipsis">…</span>
                                    <button v-else 
                                            class="ddm-page-btn"
                                            :class="{ active: currentPage === p }"
                                            @click="currentPage = p">
                                        {{ p }}
                                    </button>
                                </template>
                                <button class="ddm-page-btn"
                                        :disabled="currentPage === totalPages"
                                        @click="currentPage = currentPage + 1">
                                    <i class="ri-arrow-right-s-line"></i>
                                </button>
                            </nav>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
