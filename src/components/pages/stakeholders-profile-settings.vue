<script setup lang="ts">
import { ref, onMounted, reactive, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useRouter, useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder, CreateStakeholderPayload } from "../../types/stakeholders.types";
import { subSektorService, sektorService, getSubSektorName } from "../../services/sektor.service";
import type { SubSektor, Sektor } from "../../services/sektor.service";

// Sub Sektor state
const subSektorList = ref<SubSektor[]>([]);
const sektorList = ref<Sektor[]>([]);
const loadingSubSektors = ref(false);
const selectedSubSektorId = ref<string | number | "">("");

const loadAllSubSektors = async () => {
  loadingSubSektors.value = true;
  try {
    const [sektors, subSektors] = await Promise.all([
      sektorService.getAll(),
      subSektorService.getAll(),
    ]);
    sektorList.value = sektors;
    subSektorList.value = subSektors;
  } catch (e) {
    console.error("Gagal memuat sub_sektor:", e);
  } finally {
    loadingSubSektors.value = false;
  }
};

// Phone input state — fixed +62 prefix
const PHONE_PREFIX = "+62";
const phoneNumber = ref("");

const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
};

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const numbers = input.value.replace(/\D/g, "").slice(0, 11);
  phoneNumber.value = formatPhoneNumber(numbers);
  form.telepon = PHONE_PREFIX + " " + phoneNumber.value;
};

const router = useRouter();
const route = useRoute();
const stakeholdersStore = useStakeholdersStore();

const handleCancel = () => {
  router.back();
};

const form = reactive<Partial<Stakeholder>>({
  nama_perusahaan: "",
  email: "",
  telepon: "",
  sektor: "",
  website: "",
  alamat: "",
  photo: "",
});

const currentSlug = ref("");
const currentId = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const photoFile = ref<File | null>(null);

// Form Input Refs for click-to-focus
const namaInput = ref<HTMLInputElement | null>(null);
const sektorSelect = ref<HTMLSelectElement | null>(null);
const emailInput = ref<HTMLInputElement | null>(null);
const phoneInput = ref<HTMLInputElement | null>(null);
const websiteInput = ref<HTMLInputElement | null>(null);
const alamatInput = ref<HTMLTextAreaElement | null>(null);

// Image validation constants
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/jpg"];
const ALLOWED_EXTENSIONS = "JPEG, PNG, JPG";

// Draggable Photo State
const photoContainer = ref<HTMLElement | null>(null);
const photoPosition = ref({ x: 50, y: 50 });
const dragState = ref({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

// Drag Handlers
const getClientPos = (e: MouseEvent | TouchEvent) => 
  'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

const startDrag = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  const pos = getClientPos(e);
  dragState.value = { 
    isDragging: true, 
    startX: pos.x, 
    startY: pos.y, 
    initialX: photoPosition.value.x, 
    initialY: photoPosition.value.y 
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', onDrag);
  document.addEventListener('touchend', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!dragState.value.isDragging || !photoContainer.value) return;
  const pos = getClientPos(e);
  const rect = photoContainer.value.getBoundingClientRect();
  const deltaX = ((pos.x - dragState.value.startX) / rect.width) * 100;
  const deltaY = ((pos.y - dragState.value.startY) / rect.height) * 100;
  photoPosition.value = {
    x: Math.max(0, Math.min(100, dragState.value.initialX - deltaX)),
    y: Math.max(0, Math.min(100, dragState.value.initialY - deltaY))
  };
};

const stopDrag = () => {
  dragState.value.isDragging = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', stopDrag);
};

onMounted(async () => {
  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    
    // Ensure store is initialized
    if (!stakeholdersStore.initialized) {
      await stakeholdersStore.initialize();
    }
    
    const found = stakeholdersStore.getStakeholderBySlug(slug);
    if (found) {
      currentId.value = found.id;
      form.nama_perusahaan = found.nama_perusahaan;
      form.email = found.email;
      form.telepon = found.telepon;
      
      // Parse existing phone number — strip +62 prefix
      if (found.telepon) {
        const match = found.telepon.match(/^\+62\s*(.+)$/);
        if (match) {
          phoneNumber.value = match[1];
        } else {
          phoneNumber.value = found.telepon;
        }
      }
      
      form.sektor = found.sub_sektor?.nama_sub_sektor || found.sektor || '';
      form.website = found.website;
      form.alamat = found.alamat;
      form.photo = found.photo;
      // Load photo position if available
      photoPosition.value = {
        x: (found as any).photoPositionX ?? 50,
        y: (found as any).photoPositionY ?? 50
      };

      // Load sub sektor list and auto-select
      await loadAllSubSektors();
      if (found.sub_sektor?.id) {
        selectedSubSektorId.value = found.sub_sektor.id;
      } else if (found.sektor && subSektorList.value.length) {
        const matched = subSektorList.value.find(ss => getSubSektorName(ss) === found.sektor);
        if (matched) selectedSubSektorId.value = matched.id;
      }
    }
  }
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];

    // Validate file format
    if (!ALLOWED_FORMATS.includes(file.type)) {
      showErrorAlert.value = true;
      errorMessage.value = `Format file tidak didukung. Gunakan ${ALLOWED_EXTENSIONS}.`;
      setTimeout(() => {
        showErrorAlert.value = false;
      }, 4000);
      target.value = "";
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showErrorAlert.value = true;
      errorMessage.value = `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB.`;
      setTimeout(() => {
        showErrorAlert.value = false;
      }, 4000);
      target.value = "";
      return;
    }

    photoFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        form.photo = e.target.result as string;
        // Reset position when new image is uploaded
        photoPosition.value = { x: 50, y: 50 };
      }
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = () => {
  form.photo = "";
  photoFile.value = null;
  photoPosition.value = { x: 50, y: 50 };
};

const focusInput = (inputRef: any) => {
  const el = inputRef?.value || inputRef;
  if (el && typeof el.focus === 'function') {
    el.focus();
  }
};

const saveChanges = async () => {
  if (!currentId.value) return;
  
  isSaving.value = true;

  try {
    const payload: Partial<CreateStakeholderPayload> = {
      nama_perusahaan: form.nama_perusahaan!,
      id_sub_sektor: String(selectedSubSektorId.value),
      email: form.email!,
      alamat: form.alamat!,
      telepon: form.telepon!,
      website: form.website!,
      photo: photoFile.value,
    };

    // Include photo position in payload if needed by backend (optional, but keep for local state)
    (payload as any).photoPositionX = photoPosition.value.x;
    (payload as any).photoPositionY = photoPosition.value.y;

    const result = await stakeholdersStore.updateStakeholderById(currentId.value, payload);

    if (result.success) {
      showSuccessAlert.value = true;
      
      // Update local slug reference if name (and thus slug) changed
      const updatedSlug = result.data?.slug || currentSlug.value;
      currentSlug.value = updatedSlug;
      
      // Redirect after short delay
      setTimeout(() => {
        router.push(`/stakeholders/${updatedSlug}`);
      }, 1000);
    } else {
      throw new Error(result.error || "Gagal menyimpan perubahan");
    }
  } catch (error: any) {
    showErrorAlert.value = true;
    errorMessage.value = error.message || "Terjadi kesalahan. Silakan coba lagi.";
    setTimeout(() => {
      showErrorAlert.value = false;
    }, 3000);
  } finally {
    isSaving.value = false;
  }
};

//Reactive State
const dataToPass = computed(() => ({
  title: {
    label: `Profile ${form.nama_perusahaan || "Stakeholder"}`,
    path: `/stakeholders/${currentSlug.value}`,
  },
  currentpage: "Account Settings",
  activepage: "Account Settings",
}));

const isSaving = ref(false);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("Terjadi kesalahan. Silakan coba lagi.");
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Alerts - Toast Style -->
  <transition name="slide-toast">
    <div v-if="showSuccessAlert" class="settings-toast settings-toast--success">
      <div class="settings-toast-icon"><i class="ri-checkbox-circle-fill"></i></div>
      <div class="settings-toast-body"><strong>Berhasil!</strong> Perubahan berhasil disimpan.</div>
      <button class="settings-toast-close" @click="showSuccessAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>
  <transition name="slide-toast">
    <div v-if="showErrorAlert" class="settings-toast settings-toast--error">
      <div class="settings-toast-icon"><i class="ri-error-warning-fill"></i></div>
      <div class="settings-toast-body"><strong>Error!</strong> {{ errorMessage }}</div>
      <button class="settings-toast-close" @click="showErrorAlert = false"><i class="ri-close-line"></i></button>
    </div>
  </transition>

  <!-- Main Container -->
  <div class="row stakeholder-settings-page">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Page Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 users-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-building-2-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">Informasi Perusahaan</div>
              <div class="header-subtitle mt-1">Edit data detail stakeholder</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Photo Section -->
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="ri-image-2-line text-primary fs-18"></i>
              <div>
                <h6 class="fw-semibold mb-0">Foto Perusahaan</h6>
                <span class="fs-12 text-muted">Format: {{ ALLOWED_EXTENSIONS }} | Max: {{ MAX_FILE_SIZE_MB }}MB</span>
              </div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-primary btn-sm" @click="triggerFileInput">
                <i class="ri-upload-2-line me-1"></i>
                {{ form.photo ? 'Ganti Gambar' : 'Upload Gambar' }}
              </button>
              <button v-if="form.photo" class="btn btn-outline-danger btn-sm" @click="removeImage">
                <i class="ri-delete-bin-line me-1"></i>Hapus
              </button>
            </div>
          </div>
          <input ref="fileInput" type="file" :accept="ALLOWED_FORMATS.join(',')" class="d-none" @change="onFileChange" />

          <!-- Photo Container -->
          <div 
            ref="photoContainer" 
            class="photo-container photo-preview-compact position-relative overflow-hidden shadow-sm border mb-4"
            :class="{ 'dragging': dragState.isDragging, 'draggable': true }"
            :style="{ 
              cursor: dragState.isDragging ? 'grabbing' : 'grab',
              backgroundImage: form.photo ? `url(${form.photo})` : 'none',
              backgroundColor: form.photo ? 'transparent' : 'var(--stakeholder-photo-empty-bg, #e9ecef)',
              backgroundSize: 'cover',
              backgroundPosition: `${photoPosition.x}% ${photoPosition.y}%`
            }"
            @mousedown="startDrag($event)" 
            @touchstart="startDrag($event)"
          >
            <!-- Drag Indicator -->
            <div v-if="form.photo" class="stk-drag-indicator position-absolute d-flex align-items-center justify-content-center pointer-events-none" 
              style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
              <div class="stk-drag-hint-box bg-dark bg-opacity-50 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                <i class="ri-drag-move-2-fill fs-16"></i>
                <span class="fs-13">Seret untuk atur posisi</span>
              </div>
            </div>
            <!-- Empty State -->
            <div v-if="!form.photo" class="position-absolute d-flex flex-column align-items-center justify-content-center text-muted" 
              style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
              <i class="ri-image-add-line fs-1 mb-2 opacity-50"></i>
              <span class="fs-13">Belum ada foto</span>
            </div>
          </div>

          <!-- Form Fields -->
          <div class="row g-3">
            <!-- Nama Perusahaan -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(namaInput)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-blue" style="width:32px;height:32px"><i class="ri-building-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Nama Perusahaan</label>
                </div>
                <div class="form-group-split-input-card">
                  <input ref="namaInput" type="text" class="form-item-input" v-model="form.nama_perusahaan" placeholder="Masukkan nama perusahaan" />
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
            </div>

            <!-- Sub Sektor -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(sektorSelect)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-purple" style="width:32px;height:32px"><i class="ri-pie-chart-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Sub Sektor</label>
                </div>
                <div class="form-group-split-input-card">
                  <select ref="sektorSelect" class="form-item-input form-item-select" v-model="selectedSubSektorId" :disabled="loadingSubSektors">
                    <option value="" disabled>{{ loadingSubSektors ? 'Memuat...' : '-- Pilih Sub Sektor --' }}</option>
                    <option v-for="ss in subSektorList" :key="ss.id" :value="ss.id">{{ getSubSektorName(ss) }}</option>
                  </select>
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
              <small v-if="loadingSubSektors" class="text-muted ms-1">Memuat data sub sektor...</small>
            </div>

            <!-- Email -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(emailInput)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-indigo" style="width:32px;height:32px"><i class="ri-mail-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Email</label>
                </div>
                <div class="form-group-split-input-card">
                  <input ref="emailInput" type="email" class="form-item-input" v-model="form.email" placeholder="Masukkan email" />
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
            </div>

            <!-- Phone -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(phoneInput)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-violet" style="width:32px;height:32px"><i class="ri-phone-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Nomor Telepon</label>
                </div>
                <div class="form-group-split-input-card">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text fw-semibold bg-transparent border-0 px-0 pe-2">+62</span>
                    <input 
                      ref="phoneInput"
                      type="tel" 
                      class="form-control border-0 p-0 shadow-none bg-transparent form-item-input" 
                      v-model="phoneNumber"
                      @input="handlePhoneInput"
                      inputmode="numeric" 
                      placeholder="813 8282 8282"
                    />
                  </div>
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
            </div>

            <!-- Website -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <div class="form-group-split" @click="focusInput(websiteInput)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-cyan" style="width:32px;height:32px"><i class="ri-global-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Website</label>
                </div>
                <div class="form-group-split-input-card">
                  <input ref="websiteInput" type="url" class="form-item-input" v-model="form.website" placeholder="Masukkan website" />
                  <i class="ri-pencil-line form-item-edit-action"></i>
                </div>
              </div>
            </div>

            <!-- Empty column for alignment -->
            <div class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"></div>

            <!-- Alamat -->
            <div class="col-12">
              <div class="form-group-split" @click="focusInput(alamatInput)">
                <div class="form-group-split-label-card">
                  <div class="form-item-icon stat-icon-amber" style="width:32px;height:32px"><i class="ri-map-pin-line" style="font-size:0.95rem"></i></div>
                  <label class="form-item-label mb-0">Alamat</label>
                </div>
                <div class="form-group-split-input-card">
                  <textarea ref="alamatInput" class="form-item-input" v-model="form.alamat" rows="3" placeholder="Masukkan alamat lengkap" style="resize: vertical;"></textarea>
                  <i class="ri-pencil-line form-item-edit-action" style="top:24px; transform:none"></i>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2 mt-2">
                <button @click="handleCancel" class="btn-cancel-glass rounded-pill px-3 px-md-4 flex-fill flex-sm-grow-0">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button @click="saveChanges" :disabled="isSaving" class="btn-save-primary rounded-pill px-3 px-md-4 flex-fill flex-sm-grow-0 text-nowrap">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="ri-save-line me-1"></i>
                  <span class="d-none d-sm-inline">{{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}</span>
                  <span class="d-inline d-sm-none">{{ isSaving ? "Proses..." : "Simpan" }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- All styles live in src/assets/css/style2.css - STAKEHOLDER PROFILE SETTINGS section -->

