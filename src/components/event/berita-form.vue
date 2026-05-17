<script lang="ts">
import { ref, computed, onMounted } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import LmsEditor from "../lms/LmsEditor.vue";
import { useBeritaStore } from "../../stores/berita";
import { useAuthStore } from "../../stores/auth";
import { useUsersStore } from "../../stores/users";
import { useRouter, useRoute } from "vue-router";
import type { CreateBeritaPayload } from "../../types/berita.types";
import { isRichTextEmpty, sanitizeRichText } from "../../utils/richText";

export default {
  components: { Pageheader, LmsEditor },
  setup() {
    const beritaStore = useBeritaStore();
    const authStore = useAuthStore();
    const usersStore = useUsersStore();
    const router = useRouter();
    const route = useRoute();

    const isEdit = computed(() => !!route.params.id);
    const routeBeritaId = computed(() => {
      const raw = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;
      const id = String(raw || "").trim();
      return id && id !== "NaN" && id !== "undefined" && id !== "null" ? id : "";
    });
    const pageTitle = computed(() => (isEdit.value ? "Edit Berita" : "Tambah Berita"));

    const dataToPass = computed(() => ({
      title: { label: "Event & Berita", path: "/event/berita" },
      currentpage: pageTitle.value,
      activepage: pageTitle.value,
    }));

    const formBerita = ref({
      judul: "",
      deskripsi: "",
      tags: [] as string[],
      tagDraft: "",
      author_id: authStore.currentUser?.id || "",
    });

    const formErrors = ref<Record<string, string>>({});
    const isSaving = ref(false);
    const isLoading = ref(isEdit.value);
    const showToast = ref(false);
    const toastMessage = ref("");
    const toastType = ref<"success" | "error">("success");

    const showNotification = (msg: string, type: "success" | "error") => {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => (showToast.value = false), 3000);
    };

    const authorDisplayName = computed(() => {
      const authorId = formBerita.value.author_id;
      const matchedUser = authorId ? usersStore.getUserById(authorId) : undefined;

      return (
        matchedUser?.display_name ||
        matchedUser?.name ||
        matchedUser?.username ||
        authStore.currentUser?.display_name ||
        authStore.currentUser?.name ||
        authStore.currentUser?.username ||
        "Admin"
      );
    });

    const normalizeTags = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((tag) => {
            if (typeof tag === "object" && tag !== null) {
              const item = tag as Record<string, unknown>;
              return item.name || item.nama || item.tag || item.label || item.value || "";
            }
            return tag;
          })
          .map((tag) => String(tag).trim())
          .filter(Boolean);
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return normalizeTags(parsed);
        } catch {
          // keep parsing as a plain separated string
        }
        return value.split(/[,;\n]/).map((tag) => tag.trim()).filter(Boolean);
      }
      return [];
    };

    const parsedTags = computed(() => {
      return [...new Set(normalizeTags(formBerita.value.tags))];
    });

    const addTags = (value: unknown) => {
      const nextTags = normalizeTags(value);
      if (!nextTags.length) return;

      const existing = new Set(parsedTags.value.map((tag) => tag.toLowerCase()));
      const merged = [...formBerita.value.tags];

      nextTags.forEach((tag) => {
        const normalizedKey = tag.toLowerCase();
        if (!existing.has(normalizedKey)) {
          existing.add(normalizedKey);
          merged.push(tag);
        }
      });

      formBerita.value.tags = merged;
      formBerita.value.tagDraft = "";
      delete formErrors.value.tags;
    };

    const addTagFromDraft = () => {
      addTags(formBerita.value.tagDraft);
    };

    const removeTag = (tagToRemove: string) => {
      formBerita.value.tags = parsedTags.value.filter((tag) => tag !== tagToRemove);
    };

    const handleTagKeydown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addTagFromDraft();
      }
      if (event.key === "Backspace" && !formBerita.value.tagDraft && parsedTags.value.length) {
        formBerita.value.tags = parsedTags.value.slice(0, -1);
      }
    };

    const handleTagPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text") || "";
      if (!/[,;\n]/.test(text)) return;
      event.preventDefault();
      addTags(text);
    };

    onMounted(async () => {
      await usersStore.initialize().catch(() => undefined);

      if (!formBerita.value.author_id && authStore.currentUser?.id) {
        formBerita.value.author_id = authStore.currentUser.id;
      }

      if (isEdit.value) {
        if (!routeBeritaId.value) {
          showNotification("ID berita tidak valid", "error");
          isLoading.value = false;
          router.push("/event/berita");
          return;
        }

        try {
          const item = await beritaStore.fetchBeritaById(routeBeritaId.value);
          if (item) {
            const cleanDescription = sanitizeRichText(item.deskripsi) || item.deskripsi || "";
            formBerita.value = {
              judul: item.judul || "",
              deskripsi: cleanDescription,
              tags: normalizeTags((item as any).tags),
              tagDraft: "",
              author_id: item.author_id || authStore.currentUser?.id || "",
            };
          } else {
            showNotification("Berita tidak ditemukan", "error");
            router.push("/event/berita");
          }
        } catch {
          showNotification("Gagal memuat berita", "error");
          router.push("/event/berita");
        } finally {
          isLoading.value = false;
        }
      }
    });

    const validate = (): boolean => {
      formErrors.value = {};
      if (!formBerita.value.judul.trim()) formErrors.value.judul = "Judul wajib diisi";
      if (isRichTextEmpty(formBerita.value.deskripsi)) formErrors.value.deskripsi = "Deskripsi wajib diisi";
      if (!parsedTags.value.length) formErrors.value.tags = "Minimal satu tag wajib diisi";
      return Object.keys(formErrors.value).length === 0;
    };

    const handleSubmit = async () => {
      addTagFromDraft();
      if (!validate()) return;

      isSaving.value = true;

      const payload: CreateBeritaPayload = {
        judul: formBerita.value.judul.trim(),
        deskripsi: formBerita.value.deskripsi.trim(),
        tags: parsedTags.value,
      };

      try {
        const result = isEdit.value
          ? await beritaStore.updateBerita(routeBeritaId.value, payload)
          : await beritaStore.createBerita(payload);

        if (result.success) {
          showNotification(isEdit.value ? "Berita berhasil diperbarui!" : "Berita berhasil ditambahkan!", "success");
          setTimeout(() => router.push("/event/berita"), 600);
        } else {
          showNotification(result.error || "Gagal menyimpan", "error");
        }
      } catch (e: any) {
        showNotification(e.message || "Gagal menyimpan", "error");
      } finally {
        isSaving.value = false;
      }
    };

    const goBack = () => router.push("/event/berita");

    return {
      dataToPass, isEdit, pageTitle, isLoading, formBerita, formErrors, authorDisplayName, parsedTags,
      addTagFromDraft, removeTag, handleTagKeydown, handleTagPaste,
      handleSubmit, goBack, showToast, toastMessage, toastType, isSaving
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
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3 header-inner">
            <button class="kse-back-btn" @click="goBack" title="Kembali">
              <i class="ri-arrow-left-line"></i>
            </button>
            <div class="header-icon-box">
              <i class="ri-newspaper-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">{{ pageTitle }}</div>
              <div class="header-subtitle mt-1">{{ isEdit ? 'Perbarui informasi berita' : 'Buat berita baru' }}</div>
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
              <div class="col-md-12">
                <label class="form-label fw-semibold">Judul Berita <span class="text-danger">*</span></label>
                <input
                  v-model="formBerita.judul"
                  type="text"
                  class="form-control kse-modal-input"
                  :class="{ 'is-invalid': formErrors.judul }"
                  placeholder="Masukkan judul berita..."
                />
                <div v-if="formErrors.judul" class="invalid-feedback">{{ formErrors.judul }}</div>
              </div>

              <div class="col-md-12">
                <label class="form-label fw-semibold">Pembuat Berita</label>
                <div class="form-control kse-modal-input bg-light d-flex align-items-center gap-2">
                  <i class="ri-user-line text-primary"></i>
                  <span class="fw-medium">{{ authorDisplayName }}</span>
                </div>
              </div>

              <div class="col-md-12">
                <label class="form-label fw-semibold">Tag Berita <span class="text-danger">*</span></label>
                <div class="berita-tag-input" :class="{ 'is-invalid': formErrors.tags }">
                  <span v-for="tag in parsedTags" :key="tag" class="berita-tag-chip">
                    <i class="ri-price-tag-3-line"></i>
                    {{ tag }}
                    <button type="button" class="berita-tag-remove" :title="`Hapus ${tag}`" @click="removeTag(tag)">
                      <i class="ri-close-line"></i>
                    </button>
                  </span>
                  <input
                    v-model="formBerita.tagDraft"
                    type="text"
                    class="berita-tag-field"
                    placeholder="Ketik tag lalu Enter"
                    @keydown="handleTagKeydown"
                    @blur="addTagFromDraft"
                    @paste="handleTagPaste"
                  />
                </div>
                <div v-if="formErrors.tags" class="text-danger fs-12 mt-1">{{ formErrors.tags }}</div>
                <div class="fs-11 text-muted mt-1">Gunakan Enter atau koma untuk menambahkan lebih dari satu tag.</div>
              </div>

              <div class="col-12">
                <label class="form-label fw-semibold">Deskripsi <span class="text-danger">*</span></label>
                <LmsEditor
                  v-model="formBerita.deskripsi"
                  variant="full"
                  :min-height="320"
                  :has-error="!!formErrors.deskripsi"
                  placeholder="Tulis isi berita di sini..."
                />
                <div v-if="formErrors.deskripsi" class="text-danger fs-12 mt-1">{{ formErrors.deskripsi }}</div>
              </div>

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

<style src="../../assets/css/event-berita.css"></style>
