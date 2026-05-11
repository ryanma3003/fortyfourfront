<script lang="ts">
import { ref, onMounted, computed } from 'vue';
import Pageheader from "@/shared/components/pageheader/pageheader.vue";
import { sektorService, subSektorService, type Sektor, type SubSektor, getSektorName, getSubSektorName } from '@/services/sektor.service';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export default {
  components: { Pageheader },
  setup() {
    const dataToPass = {
      title: "Stakeholder",
      currentpage: "Sektor Setup",
      activepage: "Setup",
    };

    const sektors = ref<Sektor[]>([]);
    const subSektors = ref<SubSektor[]>([]);
    const loadingSektor = ref(false);
    const loadingSubSektor = ref(false);
    
    const selectedSektorId = ref<string | number | null>(null);

    // Form state
    const showSektorModal = ref(false);
    const showSubSektorModal = ref(false);
    const isEditingSektor = ref(false);
    const isEditingSubSektor = ref(false);
    const isSavingSektor = ref(false);
    const isSavingSubSektor = ref(false);
    
    const sektorForm = ref({
      id: '',
      nama: ''
    });
    
    const subSektorForm = ref({
      id: '',
      nama: '',
      sektor_id: ''
    });

    const fetchSektors = async () => {
      loadingSektor.value = true;
      try {
        sektors.value = await sektorService.getAll();
      } catch (error) {
        console.error("Failed to fetch sektors", error);
      } finally {
        loadingSektor.value = false;
      }
    };

    const fetchSubSektors = async () => {
      loadingSubSektor.value = true;
      try {
        subSektors.value = await subSektorService.getAll();
      } catch (error) {
        console.error("Failed to fetch sub-sektors", error);
      } finally {
        loadingSubSektor.value = false;
      }
    };

    onMounted(() => {
      fetchSektors();
      fetchSubSektors();
    });

    const filteredSubSektors = computed(() => {
      if (!selectedSektorId.value) return subSektors.value;
      return subSektors.value.filter(s => (s.id_sektor || s.sektor_id) == selectedSektorId.value);
    });

    const openAddSektor = () => {
      isEditingSektor.value = false;
      sektorForm.value = { id: '', nama: '' };
      showSektorModal.value = true;
    };

    const openEditSektor = (sektor: Sektor) => {
      isEditingSektor.value = true;
      sektorForm.value = { 
        id: String(sektor.id), 
        nama: sektor.nama || sektor.nama_sektor || ''
      };
      showSektorModal.value = true;
    };

    const saveSektor = async () => {
      if (!sektorForm.value.nama.trim()) {
        Swal.fire('Peringatan', 'Nama sektor wajib diisi', 'warning');
        return;
      }
      
      isSavingSektor.value = true;
      try {
        if (isEditingSektor.value) {
          await sektorService.update(sektorForm.value.id, {
            nama_sektor: sektorForm.value.nama
          });
        } else {
          await sektorService.create({
            nama_sektor: sektorForm.value.nama
          });
        }
        showSektorModal.value = false;
        await fetchSektors();
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Sektor telah ${isEditingSektor.value ? 'diperbarui' : 'ditambahkan'}`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire('Error', 'Gagal menyimpan sektor', 'error');
      } finally {
        isSavingSektor.value = false;
      }
    };

    const deleteSektor = async (id: string | number) => {
      const sektor = sektors.value.find(s => s.id === id);
      const name = sektor ? getSektorName(sektor) : 'Sektor';
      
      const result = await Swal.fire({
        title: 'Hapus Sektor?',
        html: `Apakah Anda yakin ingin menghapus sektor <b>${name}</b>?<br><small class="text-danger">Catatan: Pastikan tidak ada sub-sektor yang terhubung.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
      });

      if (result.isConfirmed) {
        try {
          await sektorService.delete(id);
          fetchSektors();
          Swal.fire('Deleted!', 'Sektor telah dihapus.', 'success');
        } catch (error) {
          Swal.fire('Error', 'Gagal menghapus sektor', 'error');
        }
      }
    };

    const openAddSubSektor = () => {
      isEditingSubSektor.value = false;
      subSektorForm.value = { 
        id: '', 
        nama: '', 
        sektor_id: selectedSektorId.value ? String(selectedSektorId.value) : '' 
      };
      showSubSektorModal.value = true;
    };

    const openEditSubSektor = (sub: SubSektor) => {
      isEditingSubSektor.value = true;
      subSektorForm.value = { 
        id: String(sub.id), 
        nama: sub.nama || sub.nama_sub_sektor || '', 
        sektor_id: String(sub.id_sektor || sub.sektor_id)
      };
      showSubSektorModal.value = true;
    };

    const saveSubSektor = async () => {
      if (!subSektorForm.value.nama.trim() || !subSektorForm.value.sektor_id) {
        Swal.fire('Peringatan', 'Nama dan Induk Sektor wajib diisi', 'warning');
        return;
      }

      isSavingSubSektor.value = true;
      try {
        if (isEditingSubSektor.value) {
          await subSektorService.update(subSektorForm.value.id, {
            nama_sub_sektor: subSektorForm.value.nama,
            sektor_id: subSektorForm.value.sektor_id
          });
        } else {
          await subSektorService.create({
            nama_sub_sektor: subSektorForm.value.nama,
            sektor_id: subSektorForm.value.sektor_id
          });
        }
        showSubSektorModal.value = false;
        await fetchSubSektors();
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Sub-Sektor telah ${isEditingSubSektor.value ? 'diperbarui' : 'ditambahkan'}`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire('Error', 'Gagal menyimpan sub sektor', 'error');
      } finally {
        isSavingSubSektor.value = false;
      }
    };

    const deleteSubSektor = async (id: string | number) => {
      const sub = subSektors.value.find(s => s.id === id);
      const name = sub ? getSubSektorName(sub) : 'Sub-Sektor';

      const result = await Swal.fire({
        title: 'Hapus Sub-Sektor?',
        html: `Apakah Anda yakin ingin menghapus <b>${name}</b>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
      });

      if (result.isConfirmed) {
        try {
          await subSektorService.delete(id);
          fetchSubSektors();
          Swal.fire('Deleted!', 'Sub Sektor telah dihapus.', 'success');
        } catch (error) {
          Swal.fire('Error', 'Gagal menghapus sub sektor', 'error');
        }
      }
    };

    return {
      dataToPass,
      sektors,
      subSektors,
      loadingSektor,
      loadingSubSektor,
      selectedSektorId,
      filteredSubSektors,
      showSektorModal,
      showSubSektorModal,
      isEditingSektor,
      isEditingSubSektor,
      sektorForm,
      subSektorForm,
      openAddSektor,
      openEditSektor,
      saveSektor,
      deleteSektor,
      openAddSubSektor,
      openEditSubSektor,
      saveSubSektor,
      deleteSubSektor,
      isSavingSektor,
      isSavingSubSektor,
      getSektorName,
      getSubSektorName
    };
  }
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12">
      <div class="card custom-card">
        <div class="card-body">
          <div class="d-flex align-items-center">
            <div class="flex-grow-1">
              <p class="mb-1 fs-12 text-muted">Total Sektor</p>
              <div class="d-flex align-items-center">
                <h4 class="mb-0 fw-semibold">{{ sektors.length }}</h4>
                <span class="ms-2 badge bg-primary-transparent fs-10">Sectors</span>
              </div>
            </div>
            <div class="avatar avatar-md bg-primary-transparent text-primary">
              <i class="ri-government-line fs-20"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12">
      <div class="card custom-card">
        <div class="card-body">
          <div class="d-flex align-items-center">
            <div class="flex-grow-1">
              <p class="mb-1 fs-12 text-muted">Total Sub-Sektor</p>
              <div class="d-flex align-items-center">
                <h4 class="mb-0 fw-semibold">{{ subSektors.length }}</h4>
                <span class="ms-2 badge bg-info-transparent fs-10">Sub-Sectors</span>
              </div>
            </div>
            <div class="avatar avatar-md bg-info-transparent text-info">
              <i class="ri-node-tree fs-20"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="row">
    <!-- SEKTOR LIST -->
    <div class="col-xl-5">
      <div class="card custom-card">
        <div class="card-header justify-content-between">
          <div class="card-title d-flex align-items-center gap-2">
            <i class="ri-government-line fs-18 text-primary"></i>
            Master Sektor
          </div>
          <button @click="openAddSektor" class="btn btn-primary-light btn-sm d-flex align-items-center gap-1">
            <i class="ri-add-line"></i> Tambah Sektor
          </button>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
            <table class="table table-hover text-nowrap mb-0">
              <thead class="table-custom-header sticky-top" style="z-index: 1;">
                <tr>
                  <th scope="col">Nama Sektor</th>
                  <th scope="col" class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loadingSektor">
                  <td colspan="2" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2 text-muted">Memuat data...</span>
                  </td>
                </tr>
                <tr v-else v-for="sektor in sektors" :key="sektor.id" 
                  :class="selectedSektorId === sektor.id ? 'table-active-selected' : ''"
                  @click="selectedSektorId = sektor.id"
                  style="cursor: pointer;">
                  <td>
                    <div class="fw-semibold">{{ getSektorName(sektor) }}</div>
                  </td>
                  <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                      <button @click.stop="openEditSektor(sektor)" class="btn btn-icon btn-sm btn-info-light" title="Edit">
                        <i class="ri-edit-line"></i>
                      </button>
                      <button @click.stop="deleteSektor(sektor.id)" class="btn btn-icon btn-sm btn-danger-light" title="Delete">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- SUB SEKTOR LIST -->
    <div class="col-xl-7">
      <div class="card custom-card">
        <div class="card-header justify-content-between">
          <div class="card-title d-flex align-items-center gap-2">
            <i class="ri-node-tree fs-18 text-info"></i>
            Master Sub-Sektor
            <span v-if="selectedSektorId" class="badge bg-info-transparent ms-2 fs-11">
              Filter: {{ sektors.find(s => s.id === selectedSektorId)?.nama_sektor || sektors.find(s => s.id === selectedSektorId)?.nama || 'Selected' }}
            </span>
          </div>
          <div class="d-flex gap-2">
            <button v-if="selectedSektorId" @click="selectedSektorId = null" class="btn btn-light btn-sm">
              Reset Filter
            </button>
            <button @click="openAddSubSektor" class="btn btn-info-light btn-sm d-flex align-items-center gap-1">
              <i class="ri-add-line"></i> Tambah Sub-Sektor
            </button>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
            <table class="table table-hover text-nowrap mb-0">
              <thead class="table-custom-header sticky-top" style="z-index: 1;">
                <tr>
                  <th scope="col">Nama Sub-Sektor</th>
                  <th scope="col">Induk Sektor</th>
                  <th scope="col" class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loadingSubSektor">
                  <td colspan="3" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-info" role="status"></div>
                    <span class="ms-2 text-muted">Memuat data...</span>
                  </td>
                </tr>
                <tr v-else-if="filteredSubSektors.length === 0">
                  <td colspan="3" class="text-center py-5 text-muted">
                    Tidak ada sub-sektor ditemukan.
                  </td>
                </tr>
                <tr v-else v-for="sub in filteredSubSektors" :key="sub.id">
                  <td>
                    <div class="fw-semibold">{{ getSubSektorName(sub) }}</div>
                  </td>
                  <td>
                    <span class="badge badge-sector-light text-muted fw-normal border">
                      {{ getSektorName(sektors.find(s => s.id == (sub.id_sektor || sub.sektor_id)) || { id: '?', nama: 'Unknown' }) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                      <button @click="openEditSubSektor(sub)" class="btn btn-icon btn-sm btn-info-light" title="Edit">
                        <i class="ri-edit-line"></i>
                      </button>
                      <button @click="deleteSubSektor(sub.id)" class="btn btn-icon btn-sm btn-danger-light" title="Delete">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL SEKTOR -->
  <div v-if="showSektorModal" class="modal fade show d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content custom-modal card custom-card">
        <div class="modal-header">
          <h5 class="modal-title">{{ isEditingSektor ? 'Edit Sektor' : 'Tambah Sektor Baru' }}</h5>
          <button type="button" class="btn-close" @click="showSektorModal = false"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Nama Sektor</label>
            <input v-model="sektorForm.nama" type="text" class="form-control" placeholder="Masukkan nama sektor">
          </div>
        </div>
        <div class="modal-footer border-top-0">
          <button type="button" class="btn btn-light" :disabled="isSavingSektor" @click="showSektorModal = false">Batal</button>
          <button type="button" class="btn btn-primary" :disabled="isSavingSektor" @click="saveSektor">
            <span v-if="isSavingSektor" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSavingSektor ? 'Menyimpan...' : 'Simpan Sektor' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL SUB SEKTOR -->
  <div v-if="showSubSektorModal" class="modal fade show d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content custom-modal card custom-card">
        <div class="modal-header">
          <h5 class="modal-title">{{ isEditingSubSektor ? 'Edit Sub-Sektor' : 'Tambah Sub-Sektor Baru' }}</h5>
          <button type="button" class="btn-close" @click="showSubSektorModal = false"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Induk Sektor</label>
            <select v-model="subSektorForm.sektor_id" class="form-select">
              <option value="">Pilih Sektor...</option>
              <option v-for="s in sektors" :key="s.id" :value="s.id">{{ getSektorName(s) }}</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Nama Sub-Sektor</label>
            <input v-model="subSektorForm.nama" type="text" class="form-control" placeholder="Masukkan nama sub-sektor">
          </div>
        </div>
        <div class="modal-footer border-top-0">
          <button type="button" class="btn btn-light" :disabled="isSavingSubSektor" @click="showSubSektorModal = false">Batal</button>
          <button type="button" class="btn btn-info text-white" :disabled="isSavingSubSektor" @click="saveSubSektor">
            <span v-if="isSavingSubSektor" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSavingSubSektor ? 'Menyimpan...' : 'Simpan Sub-Sektor' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Extremely aggressive dark mode overrides */
html[data-theme-mode="dark"] .table-custom-header,
html[data-theme-mode="dark"] .table-custom-header th {
  background-color: #2a2a35 !important;
  background: #2a2a35 !important;
  color: #adb5bd !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

html[data-theme-mode="dark"] .custom-card {
  background-color: #23232a !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

html[data-theme-mode="dark"] .custom-card .card-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  background-color: transparent !important;
}

html[data-theme-mode="dark"] .table {
  color: #adb5bd !important;
}

html[data-theme-mode="dark"] .table-active-selected {
  background-color: rgba(var(--primary-rgb), 0.3) !important;
  color: #fff !important;
}

html[data-theme-mode="dark"] .badge-sector-light {
  background-color: #2a2a35 !important;
  color: #adb5bd !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

/* Fix for total card badges in dark mode */
html[data-theme-mode="dark"] .bg-primary-transparent {
  background-color: rgba(var(--primary-rgb), 0.2) !important;
  color: #fff !important;
}

html[data-theme-mode="dark"] .bg-info-transparent {
  background-color: rgba(var(--info-rgb), 0.2) !important;
  color: #fff !important;
}
</style>

<style scoped>
.custom-card {
  border: none;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border-radius: 0.75rem;
  overflow: hidden;
}

.table-custom-header {
  background-color: #f9fafb;
}

.table-custom-header th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  font-weight: 700;
  padding: 1rem 1.5rem;
  color: #4b5563;
}

.table-hover tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.table-active-selected {
  background-color: rgba(var(--primary-rgb), 0.1) !important;
}

.badge-sector-light {
  background-color: #f3f4f6;
}

.custom-modal {
  border: none;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  border-bottom: 1px solid #f3f4f6;
  padding: 1.25rem 1.5rem;
}

.modal-footer {
  border-top: 1px solid #f3f4f6;
  padding: 1rem 1.5rem;
}

.form-control, .form-select {
  border-radius: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-color: #d1d5db;
}

.form-control:focus, .form-select:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
}

.avatar {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}

.bg-primary-transparent {
  background-color: rgba(var(--primary-rgb), 0.1);
}

.bg-info-transparent {
  background-color: rgba(var(--info-rgb), 0.1);
}

.modal.fade.show.d-block {
  display: flex !important;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
}

.modal-dialog {
  margin: 0 auto;
  width: 100%;
  max-width: 500px;
}
</style>
