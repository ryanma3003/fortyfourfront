<script setup>
const props = defineProps({
  item: { type: Object, required: true },
  columns: { type: Array, required: true },
  index: { type: Number, required: true },
  pageOffset: { type: Number, default: 0 },
});

const emit = defineEmits(['navigate']);

function handleNavigate() {
  emit('navigate', props.item);
}

function formatValue(val, col) {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'object') return JSON.stringify(val);

  if (col === 'created_at' || col === 'updated_at') {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch { /* fallback */ }
  }

  if (col === 'ikas_score') {
    const num = Number(val);
    if (!isNaN(num)) return num.toFixed(2);
  }

  return String(val);
}

function getCellBadge(col, val) {
  if (!val || val === '-') return null;

  if (col === 'csirt_status' || col === 'status_csirt') {
    const v = String(val).toLowerCase();
    if (v.includes('belum') || v === 'tidak' || v === '✗ tidak') return { variant: 'muted', icon: 'ri-record-circle-line' };
    if (v.includes('ada') || v.includes('terdaftar') || v.includes('lengkap') || v.includes('complete') || v.includes('aktif') || v === '✓ ada' || v === '✓ lengkap') return { variant: 'success', icon: 'ri-record-circle-fill' };
    return { variant: 'muted', icon: 'ri-record-circle-line' };
  }

  if (col === 'status_data') {
    const v = String(val).toLowerCase();
    if (v === 'lengkap' || v === 'complete') return { variant: 'success', icon: 'ri-check-double-line' };
    if (v === 'sebagian' || v === 'partial') return { variant: 'warning', icon: 'ri-error-warning-line' };
    return { variant: 'danger', icon: 'ri-close-line' };
  }

  if (col === 'ikas_kategori' || col === 'ikas_maturity') {
    const v = String(val).toLowerCase();
    if (v.includes('tinggi') || v.includes('baik') || v.includes('high') || v.includes('matang')) return { variant: 'success', icon: 'ri-arrow-up-line' };
    if (v.includes('sedang') || v.includes('medium') || v.includes('cukup')) return { variant: 'warning', icon: 'ri-subtract-line' };
    return { variant: 'danger', icon: 'ri-arrow-down-line' };
  }

  return null;
}

function getSektorClass(val) {
  if (!val) return '';
  const v = String(val).toLowerCase().trim();
  if (v.includes('ikft') || v.includes('ikaft')) return 'ddm-sektor-ikft';
  if (v.includes('agro')) return 'ddm-sektor-agro';
  if (v.includes('ilmate') || v.includes('ilamte')) return 'ddm-sektor-ilmate';
  return '';
}

function getSubSektorClass(val) {
  if (!val || val === '-') return '';
  const str = String(val);
  
  const colors = [
    'ddm-subsektor-teal',
    'ddm-subsektor-emerald',
    'ddm-subsektor-amber',
    'ddm-subsektor-orange',
    'ddm-subsektor-cyan',
    'ddm-subsektor-lime',
    'ddm-subsektor-red'
  ];
  
  let sum = str.length;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  
  const index = sum % colors.length;
  return colors[index];
}

</script>

<template>
  <tr 
    class="ddm-row"
    :style="{ animationDelay: `${index * 30}ms` }"
    @click="handleNavigate"
    @keydown.enter="handleNavigate"
    tabindex="0"
    role="button"
    aria-label="Lihat Detail"
  >
    <td class="ddm-td-no">
      {{ pageOffset + index + 1 }}
    </td>
    <td v-for="col in columns" :key="col" class="ddm-td">
      <template v-if="getCellBadge(col, item[col])">
        <span :class="'ddm-status-badge ddm-status-' + getCellBadge(col, item[col]).variant">
          <i :class="getCellBadge(col, item[col]).icon" class="ddm-status-icon"></i>
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else-if="col === 'ikas_score' && item[col]">
        <span class="ddm-score-pill">
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else-if="col === 'nama_perusahaan'">
        <span class="ddm-cell-primary fw-semibold">
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else-if="col === 'sektor'">
        <span class="ddm-sektor-tag" :class="getSektorClass(item[col])">
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else-if="col === 'sub_sektor'">
        <span class="ddm-sektor-tag" :class="getSubSektorClass(item[col])">
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else-if="col === 'created_at' || col === 'updated_at'">
        <span class="ddm-cell-date">
          <i class="ri-calendar-line me-1"></i>
          {{ formatValue(item[col], col) }}
        </span>
      </template>
      <template v-else>
        {{ formatValue(item[col], col) }}
      </template>
    </td>
  </tr>
</template>
