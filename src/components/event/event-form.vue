<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useEventStore } from "../../stores/event";
import LmsEditor from "../lms/LmsEditor.vue";
import { useRouter, useRoute } from "vue-router";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const eventStore = useEventStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const pageTitle = computed(() => (isEdit.value ? "Edit Event" : "Tambah Event"));

    const dataToPass = computed(() => ({
      title: { label: "Event & Berita", path: "/event" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    // Form state
    const formEvent = ref({
      judul: "",
      kategori: "Berita",
      status: "upcoming" as "upcoming" | "ongoing" | "past",
      tanggal_mulai: "",
      tanggal_selesai: "",
      lokasi: "",
      deskripsi: "",
      konten: "",
      thumbnail: "",
    });

    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);
    const isLoading = ref(isEdit.value);

    // Toast
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");
    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    onMounted(async () => {
      if (isEdit.value) {
        try {
          await eventStore.fetchEvents();
          const ev = eventStore.getEventById(route.params.id as string);
          if (ev) {
            formEvent.value = {
              judul: ev.judul || "",
              kategori: ev.kategori || "Berita",
              status: ev.status || "upcoming",
              tanggal_mulai: ev.tanggal_mulai || "",
              tanggal_selesai: ev.tanggal_selesai || "",
              lokasi: ev.lokasi || "",
              deskripsi: ev.deskripsi || "",
              konten: ev.konten || "",
              thumbnail: ev.thumbnail || "",
            };
          } else {
            showNotification("Event tidak ditemukan", "error");
            router.push("/event");
          }
        } catch (e) {
           showNotification("Gagal memuat event", "error");
        } finally {
          isLoading.value = false;
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!formEvent.value.judul.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (!formEvent.value.kategori) formErrors.value.kategori = "Kategori wajib diisi";
      if (!formEvent.value.deskripsi.trim()) formErrors.value.deskripsi = "Deskripsi wajib diisi";
      if (!formEvent.value.konten.trim() || formEvent.value.konten === "<p><br></p>") {
        formErrors.value.konten = "Konten detail wajib diisi";
      }
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validate()) return;

      isSaving.value = true;
      try {
        if (isEdit.value) {
          await eventStore.updateEvent(route.params.id as string, formEvent.value);
          showNotification("Event berhasil diperbarui!", "success");
        } else {
          await eventStore.createEvent(formEvent.value);
          showNotification("Event berhasil ditambahkan!", "success");
        }
        setTimeout(() => router.push("/event"), 600);
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push("/event");

    return {
      dataToPass, isEdit, pageTitle, isLoading,
      formEvent, formErrors,
      handleSubmit, goBack,
      showToast, toastMessage, toastType, isSaving,
    };
  },
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <transition name="toast-slide">
    <div v-if="showToast" class="toast-wrapper position-fixed">
      <div class="toast-modern" :class="toastType === 'success' ? 'toast-success' : 'toast-error'" role="alert">
        <div class="toast-icon-wrap">
          <i :class="toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'"></i>
        </div>
        <div class="toast-content">
          <span class="toast-title">{{ toastType === 'success' ? 'Berhasil' : 'Gagal' }}</span>
          <span class="toast-msg">{{ toastMessage }}</span>
        </div>
      </div>
    </div>
  </transition>

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Header -->
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <button class="kse-back-btn" @click="goBack" title="Kembali">
              <i class="ri-arrow-left-line"></i>
            </button>
            <div class="header-icon-box">
              <i class="ri-calendar-event-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui informasi acara/berita' : 'Buat acara/berita baru' }}</div>
            </div>
          </div>
        </div>

        <div class="card-body p-4">
          <div v-if="isLoading" class="text-center py-5">
            <span class="spinner-border spinner-border-sm text-primary"></span>
            <span class="ms-2">Memuat data...</span>
          </div>
          <form v-else @submit.prevent="handleSubmit">
            <div class="row g-4">
              
              <!-- Judul -->
              <div class="col-md-8">
                <label class="form-label fw-semibold">Judul / Nama Acara <span class="text-danger">*</span></label>
                <input
                  v-model="formEvent.judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <!-- Kategori -->
              <div class="col-md-4">
                <label class="form-label fw-semibold">Kategori <span class="text-danger">*</span></label>
                <select v-model="formEvent.kategori" class="form-select kse-modal-input" :class="{ 'is-invalid': formErrors.kategori }">
                  <option value="Berita">Berita</option>
                  <option value="Event">Event</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Acara">Acara Lainnya</option>
                </select>
                <div v-if="formErrors.kategori" class="invalid-feedback">{{ formErrors.kategori }}</div>
              </div>

              <!-- Status -->
              <div class="col-md-4">
                <label class="form-label fw-semibold">Status Acara <span class="text-danger">*</span></label>
                <select v-model="formEvent.status" class="form-select kse-modal-input">
                  <option value="upcoming">Upcoming (Akan Datang)</option>
                  <option value="ongoing">Sedang Berjalan</option>
                  <option value="past">Past (Selesai)</option>
                </select>
              </div>

              <!-- Tanggal Mulai -->
              <div class="col-md-4">
                <label class="form-label fw-semibold">Tanggal Mulai</label>
                <input
                  v-model="formEvent.tanggal_mulai"
                  type="date"
                  class="form-control kse-modal-input"
                />
              </div>

              <!-- Tanggal Selesai -->
              <div class="col-md-4">
                <label class="form-label fw-semibold">Tanggal Selesai</label>
                <input
                  v-model="formEvent.tanggal_selesai"
                  type="date"
                  class="form-control kse-modal-input"
                />
              </div>

              <!-- Lokasi -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">Lokasi Acara</label>
                <input
                  v-model="formEvent.lokasi"
                  type="text"
                  class="form-control kse-modal-input"
                  placeholder="Contoh: Zoom, Jakarta, dsb..."
                />
              </div>

              <!-- URL Thumbnail -->
              <div class="col-md-12">
                <label class="form-label fw-semibold">URL Cover / Thumbnail (Opsional)</label>
                <div class="d-flex flex-column gap-3">
                  <input
                    v-model="formEvent.thumbnail"
                    type="text"
                    class="form-control kse-modal-input"
                    placeholder="Masukkan URL Gambar (Misal: https://example.com/foto.jpg)"
                  />
                  <div v-if="formEvent.thumbnail" class="thumbnail-preview-box rounded-4 border p-2 bg-light d-flex align-items-center justify-content-center overflow-hidden position-relative" style="height: 160px; width: 250px;">
                    <img :src="formEvent.thumbnail" class="w-100 h-100 object-fit-cover rounded-3" alt="Preview" @error="formEvent.thumbnail = ''" />
                    <button @click="formEvent.thumbnail = ''" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle" style="width: 28px; height: 28px; padding: 0;">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Deskripsi Singkat -->
              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi Singkat <span class="text-danger">*</span></label>
                <textarea
                  v-model="formEvent.deskripsi"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.deskripsi }"
                  rows="3"
                  placeholder="Deskripsi singkat yang akan muncul di halaman list..."
                ></textarea>
                <div v-if="formErrors.deskripsi" class="invalid-feedback">{{ formErrors.deskripsi }}</div>
              </div>

              <!-- Konten / Editor -->
              <div class="col-12">
                <label class="form-label fw-semibold">Isi Berita / Detail Event <span class="text-danger">*</span></label>
                <div :class="{'border border-danger rounded': formErrors.konten}">
                  <LmsEditor
                    v-model="formEvent.konten"
                    variant="full"
                    :min-height="400"
                    :has-error="!!formErrors.konten"
                    placeholder="Tulis lengkap deskripsi, jadwal acara, berita, dll..."
                  />
                </div>
                <div v-if="formErrors.konten" class="text-danger fs-12 mt-1">{{ formErrors.konten }}</div>
              </div>

              <!-- Actions -->
              <div class="col-12">
                <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                  <button type="button" class="btn btn-light px-4" @click="goBack">
                    <i class="ri-close-line me-1"></i>Batal
                  </button>
                  <button type="submit" class="btn btn-primary px-4 d-flex align-items-center gap-2" :disabled="isSaving">
                    <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
                    <i v-else :class="isEdit ? 'ri-save-line' : 'ri-add-circle-line'"></i>
                    <span>{{ isEdit ? 'Simpan Perubahan' : 'Simpan' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
