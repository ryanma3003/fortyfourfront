<script setup lang="ts">
import { ref, onMounted, reactive, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import CountryCodeDropdown from "../shared/CountryCodeDropdown.vue";
import { useRouter, useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder, CreateStakeholderPayload } from "../../types/stakeholders.types";

// Phone input state
const selectedCountryCode = ref("+62");
const phoneNumber = ref("");

// Format phone number
const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (selectedCountryCode.value === "+62") {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
  } else {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
  }
};

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const numbers = input.value.replace(/\D/g, "").slice(0, 11);
  phoneNumber.value = formatPhoneNumber(numbers);
  form.telepon = selectedCountryCode.value + " " + phoneNumber.value;
};

const handleCountryCodeChange = () => {
  if (phoneNumber.value) {
    form.telepon = selectedCountryCode.value + " " + phoneNumber.value;
  }
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
      
      // Parse existing phone number
      if (found.telepon) {
        const match = found.telepon.match(/^(\+\d+)\s*(.+)$/);
        if (match) {
          selectedCountryCode.value = match[1];
          phoneNumber.value = match[2];
        } else {
          phoneNumber.value = found.telepon;
        }
      }
      
      form.sektor = found.sektor;
      form.website = found.website;
      form.alamat = found.alamat;
      form.photo = found.photo;
      // Load saved photo position if available
      photoPosition.value = {
        x: (found as any).photoPositionX ?? 50,
        y: (found as any).photoPositionY ?? 50
      };
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
  photoPosition.value = { x: 50, y: 50 };
};

const saveChanges = async () => {
  if (!currentId.value) return;
  
  isSaving.value = true;

  try {
    const payload: Partial<CreateStakeholderPayload> = {
      nama_perusahaan: form.nama_perusahaan!,
      sektor: form.sektor!,
      email: form.email!,
      alamat: form.alamat!,
      telepon: form.telepon!,
      website: form.website!,
      photo: form.photo,
    };

    // Include photo position in payload if needed by backend (optional, but keep for local state)
    (payload as any).photoPositionX = photoPosition.value.x;
    (payload as any).photoPositionY = photoPosition.value.y;

    const result = await stakeholdersStore.updateStakeholderById(currentId.value, payload);

    if (result.success) {
      showSuccessAlert.value = true;
      // Redirect after short delay
      setTimeout(() => {
        router.push(`/profile-stakeholders/${currentSlug.value}`);
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
    path: `/profile-stakeholders/${currentSlug.value}`,
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

  <!-- Alerts -->
  <div v-if="showSuccessAlert" class="alert alert-success alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-checkbox-circle-line fs-18 me-2"></i>
    <div>Perubahan berhasil disimpan!</div>
    <button type="button" class="btn-close" @click="showSuccessAlert = false"></button>
  </div>

  <div v-if="showErrorAlert" class="alert alert-danger alert-dismissible fade show mb-3 d-flex align-items-center" role="alert">
    <i class="ri-error-warning-line fs-18 me-2"></i>
    <div>{{ errorMessage }}</div>
    <button type="button" class="btn-close" @click="showErrorAlert = false"></button>
  </div>

  <!-- Main Container -->
  <div class="row justify-content-center">
    <div class="col-xl-10">
      <!-- Account Information Card -->
      <div class="card custom-card gradient-header-card">
        <div class="card-header d-flex align-items-center gradient-header-blue">
          <i class="ri-building-2-line text-white me-2 fs-18"></i>
          <div class="card-title text-white mb-0">Informasi Perusahaan</div>
        </div>
        <div class="card-body p-4">
          <div class="row gy-4">
            <!-- Profile Picture Section - Stacked Layout for accurate preview -->
            <div class="col-xl-12">
              <div class="d-flex flex-column gap-3">
                <!-- Photo Info & Actions (Above) -->
                <div class="photo-info-header d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <h6 class="fw-semibold mb-1 d-flex align-items-center gap-2">
                      <i class="ri-image-2-line text-primary"></i>
                      Foto Perusahaan
                    </h6>
                    <span class="fs-12 text-muted">
                      <i class="ri-information-line me-1"></i>
                      Format: {{ ALLOWED_EXTENSIONS }} | Max: {{ MAX_FILE_SIZE_MB }}MB
                    </span>
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
                
                <!-- Photo Container (Full Width - Matches Profile Page) -->
                <div 
                  ref="photoContainer" 
                  class="photo-container photo-preview-compact position-relative overflow-hidden shadow-sm border"
                  :class="{ 'dragging': dragState.isDragging, 'draggable': true }"
                  :style="{ 
                    cursor: dragState.isDragging ? 'grabbing' : 'grab',
                    backgroundImage: form.photo ? `url(${form.photo})` : 'none',
                    backgroundColor: form.photo ? 'transparent' : '#e9ecef',
                    backgroundSize: 'cover',
                    backgroundPosition: `${photoPosition.x}% ${photoPosition.y}%`
                  }"
                  @mousedown="startDrag($event)" 
                  @touchstart="startDrag($event)"
                >
                  <!-- Drag Indicator -->
                  <div v-if="form.photo" class="drag-indicator position-absolute d-flex align-items-center justify-content-center pointer-events-none" 
                    style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
                    <div class="drag-hint-box bg-dark bg-opacity-50 text-white px-3 py-2 rounded-pill d-flex align-items-center gap-2">
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
              </div>
            </div>

            <!-- Nama Perusahaan -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-building-line me-1 text-primary"></i>Nama
                Perusahaan
              </label>
              <input type="text" class="form-control" v-model="form.nama_perusahaan" placeholder="Masukkan nama perusahaan" />
            </div>

            <!-- Sektor -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-pie-chart-line me-1 text-primary"></i>Sektor
              </label>
              <select class="form-select" v-model="form.sektor">
                <option value="" disabled>-- Pilih Sektor --</option>
                <option value="Hasil hutan & perkebunan">Hasil hutan & perkebunan</option>
                <option value="Pangan & perikanan">Pangan & perikanan</option>
                <option value="Minuman, tembakau & bahan penyegar">Minuman, tembakau & bahan penyegar</option>
                <option value="Kemurgi, oleokimia & pakan">Kemurgi, oleokimia & pakan</option>
                <option value="Kimia hulu">Kimia hulu</option>
                <option value="Kimia hilir & farmasi">Kimia hilir & farmasi</option>
                <option value="Semen, keramik & nonlogam">Semen, keramik & nonlogam</option>
                <option value="Tekstil, kulit & alas kaki">Tekstil, kulit & alas kaki</option>
                <option value="Logam">Logam</option>
                <option value="Permesinan & alat pertanian">Permesinan & alat pertanian</option>
                <option value="Transportasi, maritim & pertahanan">Transportasi, maritim & pertahanan</option>
                <option value="Elektronika & telematika">Elektronika & telematika</option>
              </select>
            </div>

            <!-- Email -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-mail-line me-1 text-primary"></i>Email
              </label>
              <input type="email" class="form-control" v-model="form.email" placeholder="Masukkan email" />
            </div>

            <!-- Phone -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-phone-line me-1 text-primary"></i>Nomor Telepon
              </label>
              <div class="input-group">
                <CountryCodeDropdown 
                  v-model="selectedCountryCode" 
                  @update:modelValue="handleCountryCodeChange"
                />
                <input 
                  type="tel" 
                  class="form-control" 
                  v-model="phoneNumber"
                  @input="handlePhoneInput"
                  inputmode="numeric" 
                  placeholder="813 8282 8282"
                />
              </div>
              <div class="form-text text-muted mt-1">
                <i class="ri-information-line"></i> Format: {{ selectedCountryCode }} 813 8282 8282
              </div>
            </div>

            <!-- Website -->
            <div class="col-xl-6 col-lg-6 col-md-6">
              <label class="form-label fw-medium">
                <i class="ri-global-line me-1 text-primary"></i>Website
              </label>
              <input type="url" class="form-control" v-model="form.website" placeholder="Masukkan website" />
            </div>

            <!-- Empty column for alignment -->
            <div class="col-xl-6 col-lg-6 col-md-6 d-none d-md-block"></div>

            <!-- Alamat -->
            <div class="col-12">
              <label class="form-label fw-medium">
                <i class="ri-map-pin-line me-1 text-primary"></i>Alamat
              </label>
              <textarea class="form-control" v-model="form.alamat" rows="3" placeholder="Masukkan alamat lengkap"></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="col-12">
              <div class="d-flex justify-content-end gap-2">
                <button @click="handleCancel" class="btn btn-outline-danger">
                  <i class="ri-arrow-left-line me-1"></i>Batal
                </button>
                <button @click="saveChanges" :disabled="isSaving" class="btn btn-secondary">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="ri-save-line me-1"></i>
                  {{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-header-card {
  border: none !important;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
  overflow: hidden !important;
}

.gradient-header-card .card-header {
  border: none !important;
  border-bottom: none !important;
  border-block-end: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.gradient-header-card .card-body {
  border: 1px solid var(--default-border);
  border-top: none !important;
  border-radius: 0 !important;
}

/* Draggable Photo Styles */
.photo-container.draggable {
  user-select: none;
  -webkit-user-select: none;
  transition: box-shadow 0.3s ease;
}

.photo-container.draggable:hover {
  cursor: grab;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
}

.photo-container.dragging {
  cursor: grabbing !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25) !important;
}

.pointer-events-none {
  pointer-events: none;
}

.drag-indicator {
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.photo-container:hover .drag-indicator {
  opacity: 1;
}

.photo-container.dragging .drag-indicator {
  opacity: 0;
}

.drag-hint-box {
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Photo Preview - Matches profile-stakeholders.vue banner dimensions exactly */
.photo-preview-compact {
  width: 100%;
  height: 400px;
  border-color: #dee2e6 !important;
  border-radius: 0.5rem;
}

.photo-info-side {
  padding-top: 0.25rem;
}

/* Responsive - Tablet (768px - 991px) */
@media (max-width: 991px) {
  .photo-preview-compact {
    height: 220px;
  }
}

/* Responsive - Mobile (576px - 767px) */
@media (max-width: 767px) {
  .photo-preview-compact {
    width: 100%;
    height: 180px;
  }
}

/* Responsive - Small Mobile (< 576px) */
@media (max-width: 575px) {
  .photo-preview-compact {
    height: 150px;
  }
}
</style>
