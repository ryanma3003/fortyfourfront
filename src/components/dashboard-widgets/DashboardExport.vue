<script setup>
import { ref } from 'vue';

const emit = defineEmits(['export']);
const exporting = ref(false);

async function exportPdf() {
    exporting.value = true;
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const el = document.getElementById('dashboard-capture');
        if (!el) {
            alert('Dashboard container tidak ditemukan');
            return;
        }

        // Hide interactive elements during capture
        const hideEls = el.querySelectorAll('.dw-quick-actions, .dw-toggle-group, .dw-filter-pill-close, button');
        hideEls.forEach(e => e.style.visibility = 'hidden');

        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f8f9fc',
            logging: false,
        });

        hideEls.forEach(e => e.style.visibility = '');

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        const pdf = new jsPDF('p', 'mm', 'a4');

        // Header
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Dashboard Report', 14, 15);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Generated: ${new Date().toLocaleString('id-ID')}`, 14, 21);
        pdf.line(14, 24, 196, 24);

        let position = 28;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - position);

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
        console.error('PDF Export failed:', err);
        alert('Gagal mengekspor PDF: ' + err.message);
    } finally {
        exporting.value = false;
    }
}
</script>

<template>
    <button class="dw-quick-btn" :disabled="exporting" @click="exportPdf">
        <i :class="exporting ? 'ri-loader-4-line spin-icon' : 'ri-file-pdf-2-line'"></i>
        <span class="d-none d-md-inline">{{ exporting ? 'Exporting...' : 'Export PDF' }}</span>
    </button>
</template>

<style scoped>
.spin-icon {
    animation: spin 1s linear infinite;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
</style>
