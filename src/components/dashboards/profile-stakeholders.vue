<script setup lang="ts">
// Import Vue FilePond
import vueFilePond from "vue-filepond";
import { useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder } from "../../types/stakeholders.types";
import { computed, ref, onMounted, onActivated, onUnmounted, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import gsap from "gsap";
import { picService } from "../../services/pic.service";
import type { Pic } from "../../types/pic.types";
import { useCsirtStore } from "../../stores/csirt";
import { useAuthStore } from "../../stores/auth";
import { useIkasStore } from "../../stores/ikas";
import { useKseStore } from "../../stores/kse";
import { useResikoStore } from "../../stores/resiko";
import { useKonversiStore } from "../../stores/konversi";
import { aktivitasService } from "../../services/aktivitas.service";
import type { Aktivitas, AktivitasPayload } from "../../types/aktivitas.types";
import { ikasService } from "../../services/ikas.service";
import type { IkasAuditLog } from "../../types/ikas.types";
import { getKonversiDisplay } from "../../services/konversi.service";
import LmsEditor from "../lms/LmsEditor.vue";

const authStore = useAuthStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();
const resikoStore = useResikoStore();
const csirtStore = useCsirtStore();
const konversiStore = useKonversiStore();
const isAdmin = computed(() => authStore.isAdmin);

// Use storeToRefs to get reactive refs — ensures computed() tracks store state changes
const { ikasDataMap, ikasVersion } = storeToRefs(ikasStore);
const { resikoVersion } = storeToRefs(resikoStore);

// Import FilePond styles
import "filepond/dist/filepond.min.css";

// Import image preview plugin styles
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css";

// Import image preview and file type validation plugins
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import SpkReusableAnlyticsCard from "../../shared/components/@spk/dashboards/spk-reusable-anlyticsStakeholder.vue";

const router = useRouter();
const stakeholdersStore = useStakeholdersStore();

// Create component
const FilePond = vueFilePond(
  FilePondPluginFileValidateType,
  FilePondPluginImagePreview
);

const friends = ref<Pic[]>([]);
const isLoadingPics = ref(false);
const aktivitasList = ref<Aktivitas[]>([]);
const ikasAuditLogs = ref<IkasAuditLog[]>([]);
const selectedActivityYear = ref(String(new Date().getFullYear()));
const jenisAktivitasOptions = ref<string[]>([]);
const isLoadingAktivitas = ref(false);
const isLoadingIkasAuditLogs = ref(false);
const isSavingAktivitas = ref(false);
const isActivityFormVisible = ref(false);
const isProfileDarkMode = ref(false);
const selectedIkasYear = ref("");
const isIkasYearMenuOpen = ref(false);
const ikasDomainRailRef = ref<HTMLElement | null>(null);
const editingAktivitasId = ref<number | null>(null);
const auditLogPage = ref(1);
const auditLogPageSize = ref(5);
const ikasAuditRecordMap = ref<Record<string, any>>({});
const aktivitasForm = ref<AktivitasPayload>({
  judul: "",
  deskripsi: "",
  jenis_aktivitas: [],
  perusahaan_id: "",
  tanggal_mulai: "",
  tanggal_selesai: "",
});
const PROFILE_LOAD_STAGGER_MS = 80;
const PROFILE_RELOAD_DEBOUNCE_MS = 450;
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
let profileLoadSeq = 0;
let lastProfileLoadSlug = "";
let lastProfileLoadAt = 0;
let jenisAktivitasLoaded = false;
let profileDependenciesPromise: Promise<void> | null = null;
let profileLoadInFlightSlug = "";
let profileThemeObserver: MutationObserver | null = null;

const syncProfileTheme = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  isProfileDarkMode.value =
    root.getAttribute("data-theme-mode") === "dark" ||
    body?.getAttribute("data-theme-mode") === "dark" ||
    root.classList.contains("dark") ||
    body?.classList.contains("dark");
};

const isLatestProfileLoad = (token: number, slug: string) => (
  token === profileLoadSeq && slug === stakeholderSlug.value
);

const initializeProfileDependencies = async () => {
  if (profileDependenciesPromise) return profileDependenciesPromise;

  profileDependenciesPromise = (async () => {
    if (!stakeholdersStore.initialized) {
      await stakeholdersStore.initialize();
    }

    await Promise.all([
      ikasStore.initialize(),
      Promise.resolve(kseStore.initialize()),
      Promise.resolve(resikoStore.initialize()),
      Promise.resolve(konversiStore.initialize()),
      csirtStore.initialized ? Promise.resolve() : csirtStore.initialize(),
      loadJenisAktivitas(),
    ]);
  })();

  try {
    await profileDependenciesPromise;
  } finally {
    profileDependenciesPromise = null;
  }
};

const parseActivityDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T").replace(/Z$/i, "");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatActivityDate = (value: string | null | undefined): string => {
  const date = parseActivityDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatAuditLogDate = (value: string | null | undefined): string => {
  const date = parseActivityDate(value);
  if (!date) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getHtmlDescription = (value: string | null | undefined, fallback = "Tidak ada deskripsi."): string => {
  return value && value.trim() ? value : fallback;
};

const toDateInputValue = (value: string | null | undefined): string => {
  const date = parseActivityDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sortedAktivitas = computed(() => {
  return [...aktivitasList.value].sort((a, b) => {
    const dateA = parseActivityDate(a.tanggal_mulai || a.created_at)?.getTime() || 0;
    const dateB = parseActivityDate(b.tanggal_mulai || b.created_at)?.getTime() || 0;
    return dateB - dateA;
  });
});

const currentActivityYear = computed(() => String(new Date().getFullYear()));

const aktivitasByYear = computed(() => {
  const grouped = new Map<string, Aktivitas[]>();

  sortedAktivitas.value.forEach((item) => {
    const date = parseActivityDate(item.tanggal_mulai || item.created_at);
    const year = date ? String(date.getFullYear()) : "Tanpa Tahun";
    grouped.set(year, [...(grouped.get(year) || []), item]);
  });

  return Array.from(grouped.entries()).map(([year, items]) => ({
    year,
    items,
  }));
});

const activityYearOptions = computed(() => {
  return aktivitasByYear.value.map((group) => group.year);
});

const filteredAktivitasByYear = computed(() => {
  return aktivitasByYear.value.filter((group) => group.year === selectedActivityYear.value);
});

const selectedActivityCount = computed(() => {
  return filteredAktivitasByYear.value.reduce((total, group) => total + group.items.length, 0);
});

const resetActivityYearToPresent = () => {
  selectedActivityYear.value = currentActivityYear.value;
};

const parseIkasDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value).replace(" ", "T").replace(/Z$/i, ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getIkasRecordYear = (record: any): string => {
  const explicit = String(
    record?.tahun_pengukuran ||
    record?.tahunPengukuran ||
    record?.tahun ||
    record?.year ||
    ""
  ).match(/\d{4}/)?.[0];
  if (explicit) return explicit;

  const date = parseIkasDate(
    record?.tanggal_pengukuran ||
    record?.tanggalPengukuran ||
    record?.tanggal_pengisian ||
    record?.tanggalPengisian ||
    record?.tanggal ||
    record?.updated_at ||
    record?.created_at
  );
  return date ? String(date.getFullYear()) : "";
};

const displayedIkasAuditLogs = computed(() => {
  return [...ikasAuditLogs.value].sort((a, b) => {
    const dateA = parseActivityDate(a.created_at || a.updated_at)?.getTime() || 0;
    const dateB = parseActivityDate(b.created_at || b.updated_at)?.getTime() || 0;
    return dateB - dateA;
  });
});

const auditLogTotalPages = computed(() => {
  return Math.max(1, Math.ceil(displayedIkasAuditLogs.value.length / auditLogPageSize.value));
});

const paginatedIkasAuditLogs = computed(() => {
  const page = Math.min(auditLogPage.value, auditLogTotalPages.value);
  const start = (page - 1) * auditLogPageSize.value;
  return displayedIkasAuditLogs.value.slice(start, start + auditLogPageSize.value);
});

const auditLogPageStart = computed(() => {
  if (!displayedIkasAuditLogs.value.length) return 0;
  return (Math.min(auditLogPage.value, auditLogTotalPages.value) - 1) * auditLogPageSize.value + 1;
});

const auditLogPageEnd = computed(() => {
  return Math.min(auditLogPageStart.value + auditLogPageSize.value - 1, displayedIkasAuditLogs.value.length);
});

const changeAuditLogPage = (page: number) => {
  auditLogPage.value = Math.min(Math.max(1, page), auditLogTotalPages.value);
};

const auditLogPageNumbers = computed(() => {
  const total = auditLogTotalPages.value;
  const current = Math.min(auditLogPage.value, total);
  const start = Math.max(1, current - 1);
  const end = Math.min(total, start + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
});

const getAuditLogTitle = (item: IkasAuditLog): string => {
  return item.title || item.judul || `IKAS ${getAuditLogActionLabel(item)}`;
};

const getAuditLogDescription = (item: IkasAuditLog): string => {
  const description = item.description || item.deskripsi || item.note || item.catatan;
  if (description) return description;
  return "Log perubahan IKAS berhasil dicatat.";
};

const getAuditLogActor = (item: IkasAuditLog): string => {
  if (typeof item.user === "string") return item.user;
  if (item.user?.name || item.user?.nama || item.user?.email) {
    return item.user.name || item.user.nama || item.user.email || "-";
  }
  return item.actor || item.created_by || "Sistem";
};

const getAuditLogActionLabel = (item: IkasAuditLog): string => {
  const action = String(item.action || item.aksi || item.event || item.status || "log").trim();
  const labels: Record<string, string> = {
    create: "Dibuat",
    created: "Dibuat",
    insert: "Dibuat",
    update: "Diupdate",
    updated: "Diupdate",
    put: "Diupdate",
    delete: "Dihapus",
    deleted: "Dihapus",
    validate: "Divalidasi",
    approved: "Disetujui",
    rejected: "Ditolak",
    "request-edit": "Request Edit",
    request_edit: "Request Edit",
  };
  return labels[action.toLowerCase()] || prettifyAuditKey(action);
};

const getAuditLogRespondent = (item: IkasAuditLog): string => {
  const direct = (item as any).responden || (item as any).respondent || (item as any).nama_responden;
  if (direct) return String(direct);

  const ikas = (item as any).ikas || (item as any).assessment || {};
  if (ikas?.responden || ikas?.respondent || ikas?.nama_responden) {
    return String(ikas.responden || ikas.respondent || ikas.nama_responden);
  }

  const record = ikasAuditRecordMap.value[getAuditLogIkasId(item)] || {};
  return String(record.responden || record.respondent || record.nama_responden || "Responden belum tersedia");
};

const prettifyAuditKey = (key: string): string => {
  const normalized = String(key || "")
    .replace(/^pertanyaan_/, "pertanyaan ")
    .replace(/^jawaban_/, "jawaban ")
    .replace(/_id$/i, "")
    .replace(/_/g, " ")
    .trim();

  const labels: Record<string, string> = {
    action: "Aksi",
    changes: "Perubahan",
    jawaban: "Jawaban",
    pertanyaan: "Pertanyaan",
    created_at: "Tanggal dibuat",
    updated_at: "Tanggal update",
    responden: "Responden",
    user: "User",
    status: "Status",
    pertanyaan_identifikasi_id: "Pertanyaan Identifikasi",
    pertanyaan_proteksi_id: "Pertanyaan Proteksi",
    pertanyaan_deteksi_id: "Pertanyaan Deteksi",
    pertanyaan_gulih_id: "Pertanyaan Gulih",
    jawaban_identifikasi: "Jawaban Identifikasi",
    jawaban_proteksi: "Jawaban Proteksi",
    jawaban_deteksi: "Jawaban Deteksi",
    jawaban_gulih: "Jawaban Gulih",
  };

  return labels[key] || normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatAuditValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const parsedDate = parseActivityDate(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && parsedDate) {
      return formatAuditLogDate(value);
    }
    return value;
  }
  return JSON.stringify(value);
};

const formatAuditChangeLine = (key: string, oldValue: unknown, newValue: unknown): string => {
  const lowerKey = key.toLowerCase();
  const label = prettifyAuditKey(key);
  const isQuestionPointer = lowerKey.startsWith("pertanyaan_") && lowerKey.endsWith("_id");
  const isSingleValue = oldValue === undefined && newValue !== undefined;

  if (isQuestionPointer) {
    return `${label}: index ${formatAuditValue(newValue ?? oldValue)}`;
  }

  if (isSingleValue) {
    return `${label}: ${formatAuditValue(newValue)}`;
  }

  return `${label}: ${formatAuditValue(oldValue)} -> ${formatAuditValue(newValue)}`;
};

const getAuditLogChangeLines = (item: IkasAuditLog): string[] => {
  const rawChanges = item.changes;
  if (!rawChanges) return [];

  let changes: any = rawChanges;
  if (typeof rawChanges === "string") {
    try {
      changes = JSON.parse(rawChanges);
    } catch {
      return [rawChanges];
    }
  }

  if (Array.isArray(changes)) {
    return changes.map((change, index) => {
      if (typeof change !== "object" || change === null) {
        return formatAuditValue(change);
      }
      const key = change.field || change.key || change.column || `Perubahan ${index + 1}`;
      const oldValue = change.old ?? change.before ?? change.from;
      const newValue = change.new ?? change.after ?? change.to ?? change.value;
      return formatAuditChangeLine(String(key), oldValue, newValue);
    });
  }

  if (typeof changes === "object") {
    return Object.entries(changes)
      .filter(([key]) => !["id", "ikas_id", "id_ikas", "user_id", "created_by"].includes(key))
      .map(([key, value]: [string, any]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const oldValue = value.old ?? value.before ?? value.from;
          const newValue = value.new ?? value.after ?? value.to ?? value.value;
          if (oldValue !== undefined || newValue !== undefined) {
            return formatAuditChangeLine(key, oldValue, newValue);
          }
        }
        return formatAuditChangeLine(key, undefined, value);
      });
  }

  return [formatAuditValue(changes)];
};

const normalizeIkasAuditLogs = (response: any): IkasAuditLog[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.logs)) return response.logs;
  if (Array.isArray(response?.data?.logs)) return response.data.logs;
  return [];
};

const getAuditLogTotalPages = (response: any): number => {
  const raw = response?.pagination?.total_pages || response?.data?.pagination?.total_pages || 1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const fetchAllIkasAuditLogs = async (ikasId: string): Promise<IkasAuditLog[]> => {
  const limit = 100;
  const firstResponse = await ikasService.getIkasAuditLogs(ikasId, { page: 1, limit });
  const totalPages = getAuditLogTotalPages(firstResponse);
  const restResponses = totalPages > 1
    ? await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        ikasService.getIkasAuditLogs(ikasId, { page: index + 2, limit }).catch(() => null)
      )
    )
    : [];

  return [firstResponse, ...restResponses].flatMap((response) => normalizeIkasAuditLogs(response));
};

const getAuditLogIkasId = (item: IkasAuditLog): string => {
  return String(item.ikas_id || item.id_ikas || "");
};

const getAuditLogPerusahaanId = (item: IkasAuditLog): string => {
  return String(item.perusahaan_id || item.id_perusahaan || "");
};

const dedupeIkasAuditLogs = (logs: IkasAuditLog[]): IkasAuditLog[] => {
  const seen = new Set<string>();
  return logs.filter((item, index) => {
    const key = String(item.id || `${getAuditLogIkasId(item)}-${item.action || item.aksi || item.event || "log"}-${item.created_at || item.updated_at || index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const recordBelongsToStakeholder = (record: any, stakeholder: Stakeholder): boolean => {
  const company = record?.perusahaan || {};
  return (
    String(record?.id_perusahaan || company?.id || "") === String(stakeholder.id) ||
    String(record?.perusahaan_id || "") === String(stakeholder.id) ||
    String(record?.slug || "") === String(stakeholder.slug || "") ||
    String(company?.slug || "") === String(stakeholder.slug || "")
  );
};

const resolveCurrentIkasRecords = async (
  stakeholder = currentStakeholder.value,
  slug = stakeholderSlug.value
): Promise<any[]> => {
  if (!stakeholder?.id || !slug) return [];
  const response = await ikasService.getIkasByPerusahaan(String(stakeholder.id));
  const freshRecords = ikasStore.normalizeIkasRecords(response)
    .filter((record) => recordBelongsToStakeholder(record, stakeholder));
  const cachedRecords = ikasStore.ikasRawRecords
    .filter((record) => recordBelongsToStakeholder(record, stakeholder));
  const recordsById = new Map<string, any>();

  [...freshRecords, ...cachedRecords].forEach((record) => {
    const id = String(record?.id || "");
    if (id) recordsById.set(id, record);
  });

  const records = Array.from(recordsById.values())
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());

  ikasAuditRecordMap.value = records.reduce((result, record) => {
    if (record?.id) result[String(record.id)] = record;
    return result;
  }, {} as Record<string, any>);
  records.forEach((record) => ikasStore.upsertSummaryRecord(record));
  return records;
};

const resetAktivitasForm = () => {
  aktivitasForm.value = {
    judul: "",
    deskripsi: "",
    jenis_aktivitas: [],
    perusahaan_id: String(currentStakeholder.value?.id || ""),
    tanggal_mulai: "",
    tanggal_selesai: "",
  };
  editingAktivitasId.value = null;
};

const loadJenisAktivitas = async () => {
  if (jenisAktivitasLoaded) return;
  try {
    const response = await aktivitasService.getJenis();
    jenisAktivitasOptions.value = Array.isArray(response?.data) ? response.data : [];
    jenisAktivitasLoaded = true;
  } catch {
    jenisAktivitasOptions.value = [];
  }
};

const loadAktivitas = async (
  stakeholder = currentStakeholder.value,
  token = profileLoadSeq,
  manageLoading = true
) => {
  if (!stakeholder) return;
  const requestSlug = stakeholderSlug.value;
  if (manageLoading) isLoadingAktivitas.value = true;
  try {
    const response = await aktivitasService.getByPerusahaan(stakeholder.id);
    if (isLatestProfileLoad(token, requestSlug)) {
      aktivitasList.value = Array.isArray(response?.data) ? response.data : [];
    }
  } catch {
    if (isLatestProfileLoad(token, requestSlug)) aktivitasList.value = [];
  } finally {
    if (manageLoading && isLatestProfileLoad(token, requestSlug)) {
      isLoadingAktivitas.value = false;
    }
  }
};

const loadIkasAuditLogs = async (
  stakeholder = currentStakeholder.value,
  token = profileLoadSeq,
  manageLoading = true
) => {
  const requestSlug = stakeholderSlug.value;
  if (!stakeholder) {
    ikasAuditLogs.value = [];
    return;
  }
  if (manageLoading) isLoadingIkasAuditLogs.value = true;
  try {
    auditLogPage.value = 1;
    const ikasRecords = await resolveCurrentIkasRecords(stakeholder, requestSlug);
    const ikasIds = ikasRecords.map((record) => String(record?.id || "")).filter(Boolean);

    if (!ikasIds.length) {
      if (isLatestProfileLoad(token, requestSlug)) ikasAuditLogs.value = [];
      return;
    }

    const perRecordLogs = (await Promise.all(
      ikasIds.map((ikasId) => fetchAllIkasAuditLogs(ikasId).catch(() => []))
    )).flat();
    const logs = dedupeIkasAuditLogs(
      perRecordLogs.filter((log) => {
        const logIkasId = getAuditLogIkasId(log);
        const logPerusahaanId = getAuditLogPerusahaanId(log);
        return (
          !logIkasId ||
          ikasIds.includes(logIkasId) ||
          (!!logPerusahaanId && String(logPerusahaanId) === String(stakeholder.id))
        );
      })
    );

    if (isLatestProfileLoad(token, requestSlug)) {
      ikasAuditLogs.value = logs;
    }
  } catch {
    if (isLatestProfileLoad(token, requestSlug)) ikasAuditLogs.value = [];
  } finally {
    if (manageLoading && isLatestProfileLoad(token, requestSlug)) {
      isLoadingIkasAuditLogs.value = false;
    }
  }
};

const openCreateAktivitas = () => {
  resetAktivitasForm();
  isActivityFormVisible.value = true;
};

const openEditAktivitas = (item: Aktivitas) => {
  aktivitasForm.value = {
    judul: item.judul || "",
    deskripsi: item.deskripsi || "",
    jenis_aktivitas: Array.isArray(item.jenis_aktivitas) ? [...item.jenis_aktivitas] : [],
    perusahaan_id: String(item.perusahaan_id || currentStakeholder.value?.id || ""),
    tanggal_mulai: toDateInputValue(item.tanggal_mulai),
    tanggal_selesai: toDateInputValue(item.tanggal_selesai),
  };
  editingAktivitasId.value = item.id;
  isActivityFormVisible.value = true;
};

const closeAktivitasForm = () => {
  isActivityFormVisible.value = false;
  resetAktivitasForm();
};

const saveAktivitas = async () => {
  const stakeholder = currentStakeholder.value;
  if (!stakeholder) return;

  const payload: AktivitasPayload = {
    ...aktivitasForm.value,
    perusahaan_id: String(stakeholder.id),
  };

  if (!payload.judul.trim()) {
    alert("Judul aktivitas wajib diisi.");
    return;
  }

  if (!payload.tanggal_mulai || !payload.tanggal_selesai) {
    alert("Tanggal mulai dan selesai wajib diisi.");
    return;
  }

  isSavingAktivitas.value = true;
  try {
    if (editingAktivitasId.value) {
      await aktivitasService.update(editingAktivitasId.value, payload);
    } else {
      await aktivitasService.create(payload);
    }
    closeAktivitasForm();
    await loadAktivitas(currentStakeholder.value);
  } catch {
    alert("Gagal menyimpan aktivitas.");
  } finally {
    isSavingAktivitas.value = false;
  }
};

const deleteAktivitas = async (item: Aktivitas) => {
  if (!confirm(`Yakin ingin menghapus aktivitas "${item.judul}"?`)) return;
  try {
    await aktivitasService.delete(item.id);
    await loadAktivitas(currentStakeholder.value);
  } catch {
    alert("Gagal menghapus aktivitas.");
  }
};

const loadPics = async (
  stakeholder = currentStakeholder.value,
  token = profileLoadSeq,
  manageLoading = true
) => {
  if (!stakeholder) return;
  const requestSlug = stakeholderSlug.value;
  if (manageLoading) isLoadingPics.value = true;
  try {
    const pics = await picService.getByPerusahaan(stakeholder.id);
    if (isLatestProfileLoad(token, requestSlug)) friends.value = pics;
  } catch {
    if (isLatestProfileLoad(token, requestSlug)) friends.value = [];
  } finally {
    if (manageLoading && isLatestProfileLoad(token, requestSlug)) {
      isLoadingPics.value = false;
    }
  }
};

const loadProfileData = async (options: { force?: boolean; resetUi?: boolean } = {}) => {
  const slug = stakeholderSlug.value;
  if (!slug) return;

  const now = Date.now();
  if (
    !options.force &&
    (
      slug === profileLoadInFlightSlug ||
      (slug === lastProfileLoadSlug && now - lastProfileLoadAt < PROFILE_RELOAD_DEBOUNCE_MS)
    )
  ) {
    return;
  }

  lastProfileLoadSlug = slug;
  lastProfileLoadAt = now;
  profileLoadInFlightSlug = slug;
  const token = ++profileLoadSeq;

  isLoadingPics.value = true;
  isLoadingAktivitas.value = true;
  isLoadingIkasAuditLogs.value = true;

  if (options.resetUi) {
    resetActivityYearToPresent();
    closeAktivitasForm();
  }

  try {
    await initializeProfileDependencies();
    if (!isLatestProfileLoad(token, slug)) return;

    const stakeholder = currentStakeholder.value;
    if (!stakeholder) {
      friends.value = [];
      aktivitasList.value = [];
      ikasAuditLogs.value = [];
      isLoadingPics.value = false;
      isLoadingAktivitas.value = false;
      isLoadingIkasAuditLogs.value = false;
      return;
    }

    const picsPromise = loadPics(stakeholder, token);
    await delay(PROFILE_LOAD_STAGGER_MS);
    const aktivitasPromise = loadAktivitas(stakeholder, token);
    await delay(PROFILE_LOAD_STAGGER_MS);
    const auditPromise = loadIkasAuditLogs(stakeholder, token);
    const konversiPromise = konversiStore.fetchForPerusahaanId(stakeholder.id, options.force);

    await Promise.allSettled([picsPromise, aktivitasPromise, auditPromise, konversiPromise]);
  } catch {
    if (isLatestProfileLoad(token, slug)) {
      friends.value = [];
      aktivitasList.value = [];
      ikasAuditLogs.value = [];
      isLoadingPics.value = false;
      isLoadingAktivitas.value = false;
      isLoadingIkasAuditLogs.value = false;
    }
  } finally {
    if (isLatestProfileLoad(token, slug)) {
      profileLoadInFlightSlug = "";
    }
  }
};

const editPIC = (pic: Pic) => {
  router.push({
    path: "/pic-add",
    query: {
      picId: pic.id,
      slug: currentStakeholder.value?.slug,
      id_perusahaan: currentStakeholder.value?.id,
    },
  });
};

const deletePIC = async (pic: Pic) => {
  if (!confirm("Yakin ingin menghapus PIC ini?")) return;
  try {
    await picService.delete(pic.id);
    await loadPics();
  } catch {
    alert("Gagal menghapus PIC.");
  }
};

const route = useRoute();
let myFiles = [];

const stakeholderSlug = computed(() => route.params.slug as string);

// Cari stakeholder berdasarkan slug
const currentStakeholder = computed<Stakeholder | undefined>(() => {
  return stakeholdersStore.getStakeholderBySlug(stakeholderSlug.value);
});

onMounted(async () => {
    syncProfileTheme();
    profileThemeObserver = new MutationObserver(syncProfileTheme);
    profileThemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
        profileThemeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
    }
    await loadProfileData({ force: true });
});

// Refresh profile data when navigating back to this page (keep-alive)
onActivated(async () => {
    await loadProfileData();
});

// Refresh profile data when switching between stakeholder profiles
watch(stakeholderSlug, async (newSlug, oldSlug) => {
    if (newSlug && newSlug !== oldSlug) {
        selectedIkasYear.value = "";
        await loadProfileData({ force: true, resetUi: true });
    }
});

onUnmounted(() => {
    profileThemeObserver?.disconnect?.();
});

const currentKonversiRecord = computed(() => (
  currentStakeholder.value ? konversiStore.getByPerusahaanId(currentStakeholder.value.id) : null
));

const conversionSvgIcons: Record<string, string> = {
  poin_ikas: `<svg xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><g><rect fill="none" height="24" width="24"></rect></g><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"></path></g></svg>`,
  poin_kse: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-3h2v3zm0-5h-2v-2h2v2zm4 5h-2V7h2v10z"></path></svg>`,
  poin_survey: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z"></path></svg>`,
  post_survey: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 8H7V9h10v2zm0-3H7V6h10v2z"></path></svg>`,
  poin_csirt: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>`,
  total_poin: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"></path></svg>`,
};

const conversionCardColors: Record<string, string> = {
  poin_ikas: "primary",
  poin_kse: "warning",
  poin_survey: "danger",
  post_survey: "secondary",
  poin_csirt: "success",
  total_poin: "primary",
};

const conversionDetailType: Record<string, "ikas" | "kse" | "csirt" | "resiko" | null> = {
  poin_ikas: "ikas",
  poin_kse: "kse",
  poin_survey: "resiko",
  post_survey: "resiko",
  poin_csirt: "csirt",
  total_poin: null,
};

const getConversionCardTitle = (key: string, fallback: string) => {
  const titles: Record<string, string> = {
    poin_survey: "Survey Risiko",
    post_survey: "Post Survey",
  };
  return titles[key] || fallback;
};

const getConversionCardValue = (key: string, fallbackPoint: number) => {
  const slug = stakeholderSlug.value;
  if (key === "poin_ikas") {
    const ikasSummary = ikasStore.getIkasSummary(slug);
    const ikasData = ikasSummary ? null : ikasStore.getIkasData(slug);
    const ikasScore = ikasSummary
      ? Number(ikasSummary.score || 0)
      : Number(ikasData.total_rata_rata || 0);
    return ikasScore > 0 ? ikasScore.toFixed(2) : "Belum Diisi";
  }
  if (key === "poin_kse") return seCount.value > 0 ? "Terdaftar" : "Belum Terdaftar";
  if (key === "poin_csirt") return getCsirtStatus();
  if (key === "poin_survey" || key === "post_survey") {
    return resikoStore.progressMap[slug]?.status === 'COMPLETED'
      ? "Sudah Diisi"
      : (resikoStore.answersMap[slug] && Object.keys(resikoStore.answersMap[slug]).length > 0 ? "Dalam Proses" : "Belum Diisi");
  }
  return fallbackPoint;
};

// Dynamic penilaian from /api/konversi response
const penilaian = computed(() => {
  const slug = stakeholderSlug.value;
  if (!slug) return [];

  // Read version signals so Vue tracks them as computed dependencies.
  // This forces re-evaluation whenever store data is loaded/saved.
  void ikasVersion.value;
  void resikoVersion.value;
  const display = getKonversiDisplay(currentKonversiRecord.value);
  const pointCards = display.pointMetrics.map((point) => ({
    svgIcon: conversionSvgIcons[point.key] || conversionSvgIcons.total_poin,
    svgColor: conversionCardColors[point.key] || "primary",
    title: getConversionCardTitle(point.key, point.label),
    value: getConversionCardValue(point.key, point.value),
    subLabel: `Poin: ${point.value} poin`,
    detailType: conversionDetailType[point.key] ?? null,
  }));

  return pointCards;
});

const relatedCsirtId = computed(() => {
  if (!currentStakeholder.value) return null;
  const csirt = csirtStore.csirts.find(
    (c) => String(c.id_perusahaan) === String(currentStakeholder.value?.id)
      || c.perusahaan?.id === String(currentStakeholder.value?.id)
  );
  return csirt ? (csirt.id as any) : null;
});

// Get CSIRT object (not just ID) for status checking
const relatedCsirt = computed(() => {
  if (!currentStakeholder.value) return null;
  const csirt = csirtStore.csirts.find(
    (c) => String(c.id_perusahaan) === String(currentStakeholder.value?.id)
      || c.perusahaan?.id === String(currentStakeholder.value?.id)
  );
  return csirt || null;
});

// Determine CSIRT status based on 3 conditions
const getCsirtStatus = (): string => {
  // No CSIRT record at all
  if (!relatedCsirt.value) {
    return "Belum Terdaftar";
  }

  // CSIRT exists — check SDM CSIRT personnel and SE
  const hasSdm = sdmCount.value > 0;
  const hasSe = seCount.value > 0;

  // CSIRT + SDM + SE all present → fully registered / complete
  if (hasSdm && hasSe) {
    return "Terdaftar";
  }

  // CSIRT exists but SDM or SE (or both) are missing
  return "Sedang Setup";
};

// SE count and SDM count for CSIRT status check
const seCount = ref(0);
const sdmCount = ref(0);

const loadCsirtCounts = async (csirtId: string | number | null) => {
  if (!csirtId) { seCount.value = 0; sdmCount.value = 0; return; }
  try {
    // Use csirtStore refresh to load SDM/SE (same approach as csirt.vue)
    const companyId = currentStakeholder.value?.id;
    await csirtStore.refresh({
      fetchGlobal: false,
      targetCsirtId: csirtId,
      targetCompanyId: companyId,
    });

    // Count from store's seList/sdmList using same multi-field matching as csirt.vue
    const sid = String(csirtId);
    const currentPerusahaanId = String(companyId || '');

    seCount.value = csirtStore.seList.filter((item: any) =>
      String(item.id_csirt) === sid ||
      String(item.csirt_id) === sid ||
      String(item.csirt?.id) === sid ||
      (item.id_perusahaan && String(item.id_perusahaan) === currentPerusahaanId)
    ).length;

    sdmCount.value = csirtStore.sdmList.filter((item: any) =>
      String(item.id_csirt) === sid ||
      String(item.csirt?.id) === sid
    ).length;
  } catch {
    seCount.value = 0;
    sdmCount.value = 0;
  }
};

watch(relatedCsirtId, (id) => { loadCsirtCounts(id); }, { immediate: true });



const dataToPass = computed(() => ({
  currentpage: "Profile Stakeholders",
  title: { label: "Stakeholders", path: "/stakeholders" },
  activepage: "Profile Stakeholder",
}));

// Computed for dynamic banner style with photo position
const bannerStyle = computed(() => {
  if (!currentStakeholder.value) return {};
  const stakeholder = currentStakeholder.value as any;
  if (!stakeholder.photo) return {};
  return {
    backgroundImage: `url(${stakeholder.photo})`,
    backgroundSize: 'cover',
    backgroundPosition: `${stakeholder.photoPositionX ?? 50}% ${stakeholder.photoPositionY ?? 50}%`,
    backgroundRepeat: 'no-repeat'
  };
});

const picAvatarColors = [
  'avatar-blue','avatar-indigo','avatar-violet','avatar-teal',
  'avatar-cyan','avatar-green','avatar-amber','avatar-orange','avatar-red','avatar-purple'
];
const getPicAvatarClass = (name: string) => {
  const idx = (name?.charCodeAt(0) ?? 0) % picAvatarColors.length;
  return picAvatarColors[idx];
};

// Company description (generated from available data)
const companyDescription = computed(() => {
  if (!currentStakeholder.value) return '';
  const s = currentStakeholder.value;
  return `${s.nama_perusahaan} merupakan stakeholder yang bergerak di sektor ${s.sub_sektor?.nama_sub_sektor || s.sektor || '-'}. Berkantor pusat di ${s.alamat}.`;
});

// Detail items for Tentang Perusahaan (complete info)
const companyDetails = computed(() => {
  if (!currentStakeholder.value) return [];
  return [
    { icon: 'ri-pie-chart-2-line', label: 'Sub Sektor', value: currentStakeholder.value.sub_sektor?.nama_sub_sektor || currentStakeholder.value.sektor || '-', colorClass: 'stat-icon-blue' },
    { icon: 'ri-map-pin-line', label: 'Lokasi', value: currentStakeholder.value.alamat, colorClass: 'stat-icon-amber', wrap: true },
    { icon: 'ri-mail-line', label: 'Email', value: currentStakeholder.value.email, colorClass: 'stat-icon-teal' },
    { icon: 'ri-phone-line', label: 'Telepon', value: currentStakeholder.value.telepon, colorClass: 'stat-icon-violet' },
    { icon: 'ri-global-line', label: 'Website', value: currentStakeholder.value.website, colorClass: 'stat-icon-blue', isLink: true, href: currentStakeholder.value.website },
    { icon: 'ri-shield-check-line', label: 'Status CSIRT', value: getCsirtStatus(), colorClass: getCsirtStatus() === 'Aktif' ? 'stat-icon-teal' : 'stat-icon-violet' },
  ];
});

const riskStatus = computed(() => {
  const slug = stakeholderSlug.value;
  if (resikoStore.progressMap[slug]?.status === 'COMPLETED') return 'Sudah Diisi';
  return resikoStore.answersMap[slug] && Object.keys(resikoStore.answersMap[slug]).length > 0
    ? 'Dalam Proses'
    : 'Belum Diisi';
});

const ikasProfileStatus = computed(() => {
  const slug = stakeholderSlug.value;
  const status = ikasDataMap.value?.[slug]?.total_kategori;
  return status && status !== 'INPUT BELUM LENGKAP' ? status : 'Belum Diisi';
});

const profileCompletion = computed(() => {
  const display = getKonversiDisplay(currentKonversiRecord.value);

  return {
    completed: display.completed,
    total: display.total,
    percent: display.percent,
    isComplete: display.isComplete,
    totalPoint: display.totalPoin,
  };
});

const currentStakeholderIkasRecords = computed(() => {
  const stakeholder = currentStakeholder.value;
  if (!stakeholder) return [];

  const recordsById = new Map<string, any>();
  ikasStore.ikasRawRecords
    .filter((record) => recordBelongsToStakeholder(record, stakeholder))
    .forEach((record, index) => {
      const id = String(record?.id || `${getIkasRecordYear(record)}-${index}`);
      recordsById.set(id, record);
    });

  return Array.from(recordsById.values()).sort((a, b) => {
    const yearDiff = Number(getIkasRecordYear(b) || 0) - Number(getIkasRecordYear(a) || 0);
    if (yearDiff) return yearDiff;
    return (parseIkasDate(b?.updated_at || b?.created_at)?.getTime() || 0) - (parseIkasDate(a?.updated_at || a?.created_at)?.getTime() || 0);
  });
});

const ikasYearOptions = computed(() => {
  const years = currentStakeholderIkasRecords.value
    .map(getIkasRecordYear)
    .filter(Boolean);
  return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
});

watch(ikasYearOptions, (years) => {
  if (!years.length) {
    selectedIkasYear.value = "";
    return;
  }
  if (!selectedIkasYear.value || !years.includes(selectedIkasYear.value)) {
    selectedIkasYear.value = years[0];
  }
}, { immediate: true });

watch(selectedIkasYear, async (year) => {
  const stakeholder = currentStakeholder.value;
  if (!stakeholder || !year) return;
  isIkasYearMenuOpen.value = false;
  await ikasStore.fetchFromBackend(stakeholder.slug, String(stakeholder.id), year);
  await animateIkasDomainPanel();
});

const formatIkasScore = (value: unknown): string => {
  if (value === 'NA') return 'NA';
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '0.00';
};

const getDomainScorePercent = (value: unknown): number => {
  if (value === 'NA') return 0;
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, (number / 5) * 100)) : 0;
};

const selectedIkasDomainData = computed(() => ikasStore.getIkasData(stakeholderSlug.value));

const ikasDomainRows = computed(() => {
  const data = selectedIkasDomainData.value;
  return [
    {
      key: 'identifikasi',
      label: 'Identifikasi',
      icon: 'ri-search-eye-line',
      score: data.identifikasi.nilai_identifikasi,
      category: data.identifikasi.kategori_identifikasi,
      progress: ikasStore.getDomainProgress(stakeholderSlug.value, 'identifikasi'),
      colorClass: 'domain-blue',
    },
    {
      key: 'proteksi',
      label: 'Proteksi',
      icon: 'ri-shield-keyhole-line',
      score: data.proteksi.nilai_proteksi,
      category: data.proteksi.kategori_proteksi,
      progress: ikasStore.getDomainProgress(stakeholderSlug.value, 'proteksi'),
      colorClass: 'domain-teal',
    },
    {
      key: 'deteksi',
      label: 'Deteksi',
      icon: 'ri-radar-line',
      score: data.deteksi.nilai_deteksi,
      category: data.deteksi.kategori_deteksi,
      progress: ikasStore.getDomainProgress(stakeholderSlug.value, 'deteksi'),
      colorClass: 'domain-amber',
    },
    {
      key: 'tanggulih',
      label: 'Penanggulangan & Pemulihan',
      icon: 'ri-restart-line',
      score: data.tanggulih.nilai_tanggulih,
      category: data.tanggulih.kategori_tanggulih,
      progress: ikasStore.getDomainProgress(stakeholderSlug.value, 'tanggulih'),
      colorClass: 'domain-red',
    },
  ];
});

const weakestIkasDomain = computed(() => {
  const scored = ikasDomainRows.value
    .filter((item) => item.score !== 'NA')
    .map((item) => ({ ...item, numericScore: Number(item.score || 0) }))
    .filter((item) => Number.isFinite(item.numericScore) && item.numericScore > 0)
    .sort((a, b) => a.numericScore - b.numericScore);

  return scored[0] || null;
});

const animateIkasDomainPanel = async () => {
  await nextTick();
  const root = ikasDomainRailRef.value;
  if (!root) return;

  const items = root.querySelectorAll<HTMLElement>(".ikas-domain-animate");
  const fills = root.querySelectorAll<HTMLElement>(".ikas-domain-fill");
  gsap.killTweensOf(items);
  gsap.killTweensOf(fills);

  gsap.fromTo(
    items,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.045, ease: "power2.out" }
  );

  gsap.fromTo(
    fills,
    { scaleX: 0, transformOrigin: "left center" },
    { scaleX: 1, duration: 0.46, stagger: 0.04, ease: "power2.out", delay: 0.08 }
  );
};

watch(() => ikasStore.apiLoading, async (loading) => {
  if (!loading) await animateIkasDomainPanel();
});

</script>

<style scoped>
/* ─────────────────────────────────────────────
   KEYFRAMES
   ───────────────────────────────────────────── */
@keyframes sp-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ─────────────────────────────────────────────
   PROFILE HERO BANNER
   ───────────────────────────────────────────── */
.profile-hero {
  position: relative;
  height: 380px;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
.profile-hero::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(
    to top,
    rgba(2,10,40,0.92) 0%,
    rgba(2,10,40,0.55) 35%,
    rgba(2,10,40,0.15) 60%,
    transparent 100%
  );
  pointer-events: none;
}
/* Shimmer accent bar at bottom of hero */
.profile-hero::before {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  z-index: 3;
  background: linear-gradient(90deg, transparent, #60a5fa, #a78bfa, #34d399, transparent);
  background-size: 200% 100%;
  animation: sp-shimmer 4s linear infinite;
}
.profile-hero-nophoto {
  background: linear-gradient(135deg, #020a28 0%, #0c2461 30%, #1e3a8a 60%, #2563eb 100%);
}
.profile-hero-nophoto::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 80%, rgba(37,99,235,0.35) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.25) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(14,165,233,0.15) 0%, transparent 60%);
  z-index: 0;
}
/* Floating geometric shapes for no-photo hero */
.profile-hero-nophoto::after {
  background: linear-gradient(
    to top,
    rgba(2,10,40,0.6) 0%,
    transparent 50%
  );
}

/* Hero overlay content */
.profile-hero-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 2;
  padding: 2rem 2.25rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
.profile-hero-name {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
  line-height: 1.15;
  margin: 0 0 0.6rem 0;
  letter-spacing: -0.02em;
}
.profile-hero-sektor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.22);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: 50px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.profile-hero-sektor i {
  font-size: 13px;
  opacity: 0.85;
}

/* Edit button on hero */
.btn-edit-profile {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.25);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.25s ease;
  text-decoration: none;
  white-space: nowrap;
}
.btn-edit-profile:hover {
  background: rgba(255,255,255,0.28);
  border-color: rgba(255,255,255,0.45);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}

/* ─────────────────────────────────────────────
   QUICK CONTACT BAR
   ───────────────────────────────────────────── */
.contact-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2rem;
  padding: 16px 24px;
}
.contact-bar-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px 8px 10px;
  border-radius: 60px;
  background: linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(124,58,237,0.04) 100%);
  border: 1px solid rgba(37,99,235,0.10);
  text-decoration: none;
  color: #1e3a5f;
  font-size: 13.5px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  position: relative;
  overflow: hidden;
}
.contact-bar-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  background: linear-gradient(135deg, rgba(37,99,235,0.08), rgba(124,58,237,0.06));
  transition: opacity 0.3s ease;
}
.contact-bar-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37,99,235,0.12), 0 2px 8px rgba(124,58,237,0.08);
  border-color: rgba(37,99,235,0.22);
  color: #1e3a5f;
}
.contact-bar-item:hover::after { opacity: 1; }
.contact-bar-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.contact-bar-icon i {
  font-size: 14px;
  color: #fff;
}
.contact-bar-icon.cbi-teal   { background: linear-gradient(135deg, #0d9488, #2dd4bf); box-shadow: 0 3px 10px rgba(13,148,136,0.3); }
.contact-bar-icon.cbi-violet { background: linear-gradient(135deg, #6d28d9, #a78bfa); box-shadow: 0 3px 10px rgba(109,40,217,0.3); }
.contact-bar-text {
  position: relative;
  z-index: 1;
  letter-spacing: -0.01em;
}
.contact-bar-sep {
  width: 1px;
  height: 28px;
  background: linear-gradient(180deg, transparent, #cbd5e1, transparent);
  flex-shrink: 0;
}

/* ─────────────────────────────────────────────
   SECTION DIVIDER
   ───────────────────────────────────────────── */
.sp-section-title {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
  margin-top: 0.25rem;
}
.sp-section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #dbeafe 0%, transparent 100%);
}
.sp-section-title i {
  color: #2563eb;
  font-size: 14px;
}

/* ─────────────────────────────────────────────
   INFO GRID (Tentang Perusahaan)
   ───────────────────────────────────────────── */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.info-grid-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background: linear-gradient(145deg, #fff 0%, #f8fbff 100%);
  border: 1px solid #e8eef6;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(37,99,235,0.04);
  transition: all 0.25s ease;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.info-grid-item::before {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.info-grid-item:hover {
  box-shadow: 0 8px 28px rgba(37,99,235,0.12);
  transform: translateY(-3px);
  border-color: #c7d9f5;
}
.info-grid-item:hover::before {
  opacity: 1;
}
.info-grid-item:nth-child(1)::before { background: linear-gradient(180deg, #2563eb, #60a5fa); }
.info-grid-item:nth-child(2)::before { background: linear-gradient(180deg, #0d9488, #5eead4); }
.info-grid-item:nth-child(3)::before { background: linear-gradient(180deg, #7c3aed, #c084fc); }
.info-grid-item:nth-child(4)::before { background: linear-gradient(180deg, #d97706, #fbbf24); }
.info-grid-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.info-grid-icon i {
  font-size: 1.15rem;
  color: #fff;
}
.info-grid-label {
  font-size: 10.5px;
  color: #7a9ab8;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 3px;
}
.info-grid-value {
  font-size: 13.5px;
  font-weight: 700;
  color: #1e3a5f;
  word-break: break-word;
  white-space: normal;
  line-height: 1.45;
}

/* ─────────────────────────────────────────────
   PIC TABLE CARD
   ───────────────────────────────────────────── */
/* Activity timeline */
.activity-timeline-card {
  border: 1px solid #e7edf5;
}
.profile-side-card {
  height: 100%;
}
.activity-form-panel {
  padding: 1.25rem;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  border-bottom: 1px solid #e7edf5;
}
.activity-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(15,23,42,0.58);
  backdrop-filter: blur(6px);
}
.activity-modal {
  width: min(860px, 100%);
  max-height: calc(100vh - 2.5rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(226,232,240,0.9);
  box-shadow: 0 28px 80px rgba(15,23,42,0.28);
}
.activity-modal-header,
.activity-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #fff;
}
.activity-modal-header {
  border-bottom: 1px solid #e7edf5;
}
.activity-modal-footer {
  border-top: 1px solid #e7edf5;
  justify-content: flex-end;
}
.activity-modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}
.activity-kind-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.activity-kind-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0.45rem 0.8rem;
  border: 1px solid #dbe7f5;
  border-radius: 999px;
  background: #fff;
  color: #1e3a5f;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.activity-kind-check:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}
.activity-kind-check input {
  accent-color: #2563eb;
}
.activity-year-filter {
  position: sticky;
  top: -1.35rem;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  margin: -0.1rem 0 1rem;
  padding: 0.75rem 0 0.85rem;
  background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.96) 72%, rgba(255,255,255,0));
}
.activity-year-filter-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0;
  white-space: nowrap;
}
.activity-year-filter-label i {
  color: #2563eb;
}
.activity-year-filter-chips {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-width: 0;
}
.activity-year-filter-chip,
.activity-year-filter-reset {
  min-height: 32px;
  border-radius: 999px;
  border: 1px solid #dbe7f5;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}
.activity-year-filter-chip {
  padding: 0.45rem 0.85rem;
}
.activity-year-filter-reset {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  color: #1d4ed8;
  background: #eff6ff;
  border-color: #bfdbfe;
}
.activity-year-filter-chip:hover,
.activity-year-filter-reset:hover:not(:disabled) {
  border-color: #93c5fd;
  box-shadow: 0 8px 18px rgba(37,99,235,0.08);
}
.activity-year-filter-chip.active {
  color: #fff;
  border-color: #2563eb;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  box-shadow: 0 10px 22px rgba(37,99,235,0.18);
}
.activity-year-filter-reset:disabled {
  cursor: default;
  opacity: 0.55;
  box-shadow: none;
}
.activity-timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-left: 2.65rem;
}
.activity-timeline::before {
  content: '';
  position: absolute;
  top: 0.75rem;
  bottom: 0.75rem;
  left: 1.1rem;
  width: 2px;
  background: linear-gradient(180deg, #2563eb 0%, #14b8a6 52%, #f59e0b 100%);
  border-radius: 999px;
  opacity: 0.35;
}
.activity-timeline-item {
  position: relative;
}
.activity-year-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.activity-year-group + .activity-year-group {
  margin-top: 0.35rem;
}
.activity-year-chip {
  position: relative;
  left: -0.4rem;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 30px;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.02em;
  box-shadow: 0 6px 18px rgba(37,99,235,0.08);
  z-index: 2;
}
.activity-year-chip i {
  font-size: 13px;
}
.activity-timeline-marker {
  position: absolute;
  left: -2.65rem;
  top: 1rem;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #bfdbfe;
  box-shadow: 0 8px 24px rgba(37,99,235,0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.activity-timeline-marker span {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
}
.activity-timeline-content {
  padding: 1rem 1.15rem;
  border: 1px solid #e5edf7;
  border-radius: 12px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 6px 18px rgba(15,23,42,0.04);
}
.activity-timeline-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.activity-date {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #2563eb;
  font-size: 11.5px;
  font-weight: 800;
  margin-bottom: 0.35rem;
}
.activity-title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 0;
  line-height: 1.35;
  word-break: break-word;
}
.activity-description {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
  margin: 0.65rem 0 0;
  word-break: break-word;
}
.activity-description :deep(p) {
  margin-bottom: 0.55rem;
}
.activity-description :deep(ul),
.activity-description :deep(ol) {
  padding-left: 1.15rem;
  margin-bottom: 0.55rem;
}
.activity-description :deep(img) {
  max-width: 100%;
  height: auto;
}
.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
}
.activity-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  color: #0e7490;
  font-size: 11px;
  font-weight: 800;
}
.activity-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.profile-audit-log-card {
  border: 1px solid #e7edf5;
}
.profile-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.skeleton-block {
  display: block;
  overflow: hidden;
  position: relative;
  border-radius: 999px;
  background: #e8eef7;
}
.skeleton-block::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
  animation: profile-skeleton-shimmer 1.15s infinite;
}
.skeleton-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.55rem;
}
.skeleton-line {
  width: 72%;
  height: 12px;
}
.skeleton-line-lg {
  width: 92%;
}
.skeleton-line-md {
  width: 58%;
}
.skeleton-line-sm {
  width: 36%;
}
.skeleton-dot,
.skeleton-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 11px;
}
.skeleton-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
}
.skeleton-pill {
  width: 28px;
  height: 22px;
  flex-shrink: 0;
}
.skeleton-actions {
  width: 72px;
  height: 32px;
}
.activity-skeleton-item,
.audit-skeleton-item {
  display: flex;
  gap: 0.8rem;
  min-height: 96px;
  padding: 0.9rem;
  border: 1px solid #e5edf7;
  border-radius: 12px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
}
.pic-skeleton-card {
  pointer-events: none;
}
@keyframes profile-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
.ikas-audit-log-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.ikas-audit-log-item {
  display: flex;
  gap: 0.8rem;
  min-height: 112px;
  padding: 0.9rem;
  border: 1px solid #e5edf7;
  border-radius: 12px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 6px 18px rgba(15,23,42,0.035);
}
.ikas-audit-log-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #f59e0b);
  box-shadow: 0 8px 18px rgba(37,99,235,0.14);
}
.ikas-audit-log-content {
  min-width: 0;
  flex: 1;
}
.ikas-audit-log-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.ikas-audit-log-top h6 {
  margin: 0;
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 850;
  line-height: 1.35;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
.ikas-audit-log-status {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 10.5px;
  font-weight: 850;
  white-space: nowrap;
}
.ikas-audit-log-content p {
  margin: 0;
  color: #64748b;
  font-size: 12.5px;
  line-height: 1.6;
  word-break: break-word;
}
.ikas-audit-log-changes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.7rem;
}
.ikas-audit-log-changes span {
  display: inline-flex;
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.35;
  word-break: break-word;
}
.ikas-audit-log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.65rem;
  color: #8b9ab0;
  font-size: 11px;
  font-weight: 750;
}
.ikas-audit-log-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}
.ikas-audit-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px solid #edf2f7;
}
.ikas-audit-pagination-info {
  color: #64748b;
  font-size: 11.5px;
  font-weight: 800;
}
.ikas-audit-pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.ikas-audit-pagination-controls .btn {
  min-width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 850;
  padding: 0.25rem 0.55rem;
}

.pic-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  border-radius: 50px;
  background: rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.9);
  font-size: 11px;
  font-weight: 800;
  padding: 0 7px;
  line-height: 1;
}

/* ─────────────────────────────────────────────
   HERO CARD SHELL
   ───────────────────────────────────────────── */
.hero-card-shell {
  border: none;
  border-radius: 18px;
  overflow: hidden;
  box-shadow:
    0 16px 56px rgba(0,0,0,0.10),
    0 6px 20px rgba(37,99,235,0.08);
  transition: box-shadow 0.35s ease;
}
.hero-card-shell:hover {
  box-shadow:
    0 20px 64px rgba(0,0,0,0.14),
    0 8px 28px rgba(37,99,235,0.12);
}

/* ─────────────────────────────────────────────
   DARK MODE
   ───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   PIC TABLE UTILITIES
   ───────────────────────────────────────────── */
.header-icon-ring {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.hover-up { transition: transform 0.2s ease; }
.hover-up:hover { transform: translateY(-2px); }

.hover-lift { transition: all 0.2s ease; }
.hover-lift:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }

.btn-primary-light { background: rgba(37,99,235,0.1); color: #2563eb; border: none; }
.btn-primary-light:hover { background: #2563eb; color: #fff; }

.btn-danger-light { background: rgba(220,38,38,0.1); color: #dc2626; border: none; }
.btn-danger-light:hover { background: #dc2626; color: #fff; }

.card-body1 {
  padding: 0;
  margin: 10px;
}

/* ─────────────────────────────────────────────
   RESPONSIVE
   ───────────────────────────────────────────── */
@media (max-width: 1199px) {
  .info-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 991px) {
  .profile-hero { height: 280px; }
  .profile-hero-name { font-size: 1.5rem; }
  .profile-hero-overlay { padding: 1.5rem; }
}
@media (max-width: 767px) {
  .profile-hero { height: 260px; }
  .profile-hero-name { font-size: 1.25rem; }
  .info-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 575px) {
  .profile-hero { height: 260px; }
  .profile-hero-name { font-size: 1.2rem; word-break: break-word; }
  .profile-hero-sektor { white-space: normal; line-height: 1.4; padding: 6px 14px; }
  .info-grid { grid-template-columns: 1fr !important; }
  .activity-year-filter { position: static; flex-direction: column; align-items: stretch; }
  .activity-year-filter-chips { justify-content: flex-start; }
  .activity-year-filter-reset { width: 100%; justify-content: center; }
  .activity-timeline { padding-left: 2.35rem; }
  .activity-timeline-marker { left: -2.45rem; }
  .activity-timeline-top { flex-direction: column; }
  .activity-actions { align-self: flex-start; }
  .activity-kind-check { width: 100%; justify-content: flex-start; }
  .activity-modal-backdrop { padding: 0.75rem; align-items: flex-end; }
  .activity-modal { max-height: calc(100vh - 1.5rem); }
  .activity-modal-header,
  .activity-modal-body,
  .activity-modal-footer { padding: 1rem; }
  .activity-modal-footer { flex-direction: column-reverse; align-items: stretch; }
  .profile-hero-overlay { padding: 1rem 1.25rem; flex-direction: column; align-items: stretch; gap: 0.75rem; justify-content: flex-end; }
  .contact-bar { flex-direction: column; gap: 0.75rem; padding: 14px 16px; }
  .contact-bar-sep { display: none; }
  .contact-bar-item { width: 100%; justify-content: center; }
  .contact-bar-text { word-break: break-word; white-space: normal; text-align: center; }
  .header-card-title { word-break: break-word; white-space: normal; line-height: 1.3; }
  .header-subtitle { word-break: break-word; white-space: normal; }
  .btn-edit-profile { justify-content: center; padding: 0.6rem 1rem; width: 100%; }
}

/* Modern stakeholder profile refresh */
:global(body) {
  background: #f4f7fb;
}

.gradient-header-card {
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  border-radius: 18px !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at 16% 0%, rgba(37, 99, 235, 0.08), transparent 34%),
    radial-gradient(circle at 82% 8%, rgba(20, 184, 166, 0.08), transparent 32%) !important;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08) !important;
  overflow: hidden;
}

.stakeholder-header {
  position: relative;
  min-height: 86px;
  padding: 1.1rem 1.35rem !important;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 56%, #0f766e 100%) !important;
  border: 0 !important;
}

.stakeholder-header::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.12), transparent 38%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 18px);
  opacity: 0.45;
  pointer-events: none;
}

.stakeholder-header > * {
  position: relative;
  z-index: 1;
}

.header-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.header-icon-box i {
  font-size: 1.3rem;
}

.header-card-title {
  font-size: 1rem;
  letter-spacing: 0;
}

.header-subtitle {
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  font-weight: 500;
}

.header-edit-profile {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0.55rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 12.5px;
  font-weight: 850;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(12px);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.header-edit-profile:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.36);
  transform: translateY(-1px);
}

.gradient-header-card > .card-body {
  padding: 1.35rem !important;
}

.hero-card-shell {
  border: 1px solid rgba(148, 163, 184, 0.18) !important;
  border-radius: 18px !important;
  background: #ffffff !important;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08) !important;
}

.profile-hero {
  height: 320px;
  border-radius: 18px 18px 0 0;
}

.profile-hero::after {
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.42) 42%, rgba(15, 23, 42, 0.16) 100%),
    linear-gradient(to top, rgba(15, 23, 42, 0.82), transparent 58%);
}

.profile-hero::before {
  height: 4px;
  background: linear-gradient(90deg, #14b8a6, #3b82f6, #f59e0b);
  animation: none;
}

.profile-hero-nophoto {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.9)),
    linear-gradient(45deg, rgba(20, 184, 166, 0.2), transparent 50%) !important;
}

.profile-hero-overlay {
  padding: 2rem;
  align-items: flex-end;
}

.profile-hero-name {
  max-width: 760px;
  margin-bottom: 0.75rem;
  font-size: clamp(1.7rem, 2.2vw, 2.45rem);
  font-weight: 800;
  letter-spacing: 0;
}

.profile-hero-sektor {
  max-width: 100%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.2);
  letter-spacing: 0;
  text-transform: none;
}

.btn-edit-profile {
  min-height: 42px;
  border-radius: 12px;
  padding: 0.65rem 1rem;
  background: rgba(255, 255, 255, 0.17);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.22);
}

.contact-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  padding: 1rem;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.contact-bar-sep {
  display: none;
}

.contact-bar-item {
  width: 100%;
  min-height: 56px;
  border-radius: 14px;
  padding: 0.65rem 0.8rem;
  background: #fff;
  border-color: rgba(148, 163, 184, 0.2);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.contact-bar-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.contact-bar-text {
  overflow: hidden;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-warning {
  border: 1px solid rgba(245, 158, 11, 0.24) !important;
  border-radius: 14px !important;
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 247, 237, 0.94)) !important;
  color: #92400e !important;
  box-shadow: 0 10px 28px rgba(245, 158, 11, 0.08);
}

.profile-side-card,
.custom-card:not(.gradient-header-card):not(.hero-card-shell) {
  border: 1px solid rgba(148, 163, 184, 0.2) !important;
  border-radius: 16px !important;
  background: #ffffff !important;
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06) !important;
}

.profile-activity-column,
.profile-side-stack {
  align-self: flex-start;
}

.profile-activity-column {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.profile-side-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.profile-side-stack > .custom-card,
.profile-activity-column > .custom-card {
  margin-bottom: 0 !important;
}

.profile-side-stack .profile-side-card {
  height: auto;
}

.profile-activity-column .activity-timeline-card {
  min-height: 0;
  height: auto;
}

.activity-timeline-card > .card-body {
  padding: 1.35rem 1.45rem 1.45rem !important;
}

.profile-activity-column .activity-timeline-card > .card-body {
  max-height: 760px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.profile-activity-column .activity-timeline-card > .card-body::-webkit-scrollbar {
  width: 8px;
}

.profile-activity-column .activity-timeline-card > .card-body::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 999px;
}

.profile-activity-column .activity-timeline-card > .card-body::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}

.profile-side-card > .card-header,
.custom-card:not(.gradient-header-card):not(.hero-card-shell) > .card-header {
  padding: 1rem 1.1rem !important;
  background: linear-gradient(180deg, #ffffff, #f8fafc) !important;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
}

.profile-section-header {
  background: linear-gradient(180deg, #ffffff, #f8fafc) !important;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
}

.header-icon-ring {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.pic-count-badge {
  min-width: 26px;
  height: 26px;
  color: #1d4ed8 !important;
  background: #eff6ff !important;
  border: 1px solid #bfdbfe;
}

.profile-side-card .btn-primary,
.alert-warning .btn-primary {
  border: 0;
  border-radius: 12px !important;
  background: linear-gradient(135deg, #1d4ed8, #2563eb) !important;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22) !important;
}

.activity-timeline-card {
  border-color: rgba(148, 163, 184, 0.2);
}

.activity-timeline-content {
  border-radius: 14px;
  background: #ffffff;
  border-color: rgba(148, 163, 184, 0.2);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  padding: 1.05rem 1.1rem !important;
}

.activity-timeline-content:hover {
  border-color: rgba(59, 130, 246, 0.32);
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.activity-timeline::before {
  background: linear-gradient(180deg, #3b82f6 0%, #14b8a6 55%, #f59e0b 100%);
  opacity: 0.5;
}

.activity-year-chip {
  border-radius: 10px;
  background: #eff6ff;
  box-shadow: none;
}

.activity-timeline-marker {
  border-color: #dbeafe;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
}

.activity-title,
.company-name {
  letter-spacing: 0;
}

.activity-timeline {
  gap: 0.9rem;
}

.activity-year-group {
  gap: 0.85rem;
}

.activity-timeline-item + .activity-timeline-item {
  margin-top: 0.15rem;
}

.activity-description {
  margin-top: 0.55rem;
}

.pic-loading-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.pic-card-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.95rem;
}

.pic-contact-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 76px;
  padding: 0.8rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 14px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.pic-contact-card:hover {
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.pic-contact-main {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.pic-index {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 800;
}

.pic-contact-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.pic-contact-copy .company-name,
.pic-contact-copy .text-muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pic-contact-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.42rem;
}

.pic-meta-pill {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  min-height: 28px;
  padding: 0.32rem 0.55rem;
  border: 1px solid #e7eef8;
  border-radius: 10px;
  color: #0f172a;
  background: #fff;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.pic-meta-pill i {
  color: #1d4ed8;
  flex-shrink: 0;
  font-size: 13px;
}

.pic-meta-pill span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pic-card-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.card-body1 {
  margin: 0;
}

.stakeholder-table-wrap {
  margin: 0.85rem;
  border: 1px solid rgba(226, 232, 240, 0.9) !important;
  border-radius: 14px !important;
  overflow: hidden;
}

.stakeholder-table {
  border-collapse: separate;
  border-spacing: 0;
}

.stakeholder-table thead,
.stakeholder-thead {
  background: #f8fafc !important;
}

.stakeholder-table th {
  padding: 0.85rem 1rem !important;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0 !important;
}

.stakeholder-table td {
  padding: 0.82rem 0.9rem !important;
  border-bottom: 1px solid #edf2f7 !important;
  color: #334155;
}

.profile-side-stack .stakeholder-table th {
  padding: 0.76rem 0.85rem !important;
}

.profile-side-stack .stakeholder-table td {
  padding: 0.78rem 0.85rem !important;
}

.stakeholder-row {
  transition: background 0.2s ease, transform 0.2s ease;
}

.stakeholder-row:hover {
  background: #f8fbff;
}

.row-number {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.company-avatar {
  width: 38px;
  height: 38px;
  border: 2px solid #fff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.company-name {
  color: #0f172a !important;
  font-size: 13px;
}

.profile-about-rail {
  overflow: hidden;
}

.profile-about-rail .card-header {
  padding: 0.95rem 1rem !important;
}

.profile-about-rail .card-body {
  padding: 1rem !important;
}

.profile-about-rail .card-title {
  font-size: 0.95rem;
}

.profile-about-rail .card-body > p {
  margin-bottom: 0.9rem !important;
  color: #64748b !important;
  font-size: 12.5px !important;
}

.profile-about-rail .info-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.72rem;
}

.profile-about-rail .info-grid-item {
  min-height: 74px;
  padding: 0.85rem;
}

.profile-about-rail .info-grid-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.profile-about-rail .info-grid-label {
  font-size: 10px;
}

.profile-about-rail .info-grid-value {
  font-size: 12.4px;
  line-height: 1.35;
}

.profile-ikas-domain-rail {
  overflow: visible;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%) !important;
}

.profile-ikas-domain-rail .card-header {
  padding: 0.95rem 1rem !important;
  background: #fff !important;
  overflow: visible;
  position: relative;
  z-index: 5;
}

.profile-ikas-domain-rail .card-body {
  display: grid;
  gap: 0.85rem;
  padding: 1rem !important;
  border-radius: 0 0 20px 20px;
}

.ikas-domain-year-menu {
  position: relative;
  z-index: 20;
  flex: 0 0 auto;
}

.ikas-domain-year-button {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  min-width: 86px;
  min-height: 34px;
  padding: 0.42rem 0.62rem 0.42rem 0.72rem;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: #0f172a;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.ikas-domain-year-button:hover:not(:disabled),
.ikas-domain-year-button:focus-visible {
  border-color: rgba(37, 99, 235, 0.5);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12), 0 10px 22px rgba(15, 23, 42, 0.08);
  outline: none;
}

.ikas-domain-year-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ikas-domain-year-button i {
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  transition: transform 0.18s ease, color 0.18s ease;
}

.ikas-domain-year-button i.open {
  transform: rotate(180deg);
}

.ikas-domain-year-list {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  min-width: 112px;
  overflow: hidden;
  padding: 0.28rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.ikas-domain-year-list button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  padding: 0.42rem 0.58rem;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.ikas-domain-year-list button:hover {
  background: #eef4ff;
  color: #1d4ed8;
}

.ikas-domain-year-list button.active {
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
}

.ikas-domain-loading {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 120px;
  justify-content: center;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ikas-domain-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  padding: 0.9rem;
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.07), rgba(20, 184, 166, 0.05));
}

.ikas-domain-summary span {
  color: #64748b;
  font-size: 10.5px;
  font-weight: 850;
  text-transform: uppercase;
}

.ikas-domain-summary strong {
  display: block;
  color: #0f172a;
  font-size: 1.45rem;
  font-weight: 950;
  line-height: 1.1;
}

.ikas-domain-summary > span {
  max-width: 52%;
  padding: 0.32rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #1d4ed8;
  text-align: right;
  text-transform: none;
}

.ikas-domain-list {
  display: grid;
  gap: 0.62rem;
}

.ikas-domain-row {
  display: flex;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.78rem;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 16px;
  background: #ffffff;
}

.ikas-domain-row > div {
  flex: 1;
  min-width: 0;
}

.ikas-domain-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 12px;
  color: #ffffff;
}

.domain-blue .ikas-domain-icon { background: linear-gradient(135deg, #2563eb, #60a5fa); }
.domain-teal .ikas-domain-icon { background: linear-gradient(135deg, #0f766e, #2dd4bf); }
.domain-amber .ikas-domain-icon { background: linear-gradient(135deg, #d97706, #fbbf24); }
.domain-red .ikas-domain-icon { background: linear-gradient(135deg, #dc2626, #fb7185); }

.ikas-domain-row-head,
.ikas-domain-row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.ikas-domain-row-head span {
  color: #0f172a;
  font-size: 12.4px;
  font-weight: 900;
}

.ikas-domain-row-head strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 950;
}

.ikas-domain-track {
  height: 7px;
  overflow: hidden;
  margin: 0.48rem 0;
  border-radius: 999px;
  background: #e2e8f0;
}

.ikas-domain-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #14b8a6);
}

.ikas-domain-row-meta span {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 10.5px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ikas-domain-priority {
  display: flex;
  gap: 0.7rem;
  padding: 0.85rem;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 16px;
  background: #fffbeb;
}

.ikas-domain-priority-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 12px;
  background: #f59e0b;
  color: #ffffff;
}

.ikas-domain-priority div {
  min-width: 0;
}

.ikas-domain-priority span,
.ikas-domain-priority small {
  display: block;
  color: #92400e;
  font-size: 10.5px;
  font-weight: 800;
}

.ikas-domain-priority strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  font-size: 12.8px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-grid {
  gap: 0.85rem;
}

.info-grid-item {
  border-radius: 14px;
  background: #fff;
  border-color: rgba(148, 163, 184, 0.2);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.info-grid-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.info-grid-icon {
  border-radius: 13px;
}

.info-grid-label {
  color: #64748b;
  letter-spacing: 0;
}

.info-grid-value {
  color: #0f172a;
}

.activity-modal {
  border-radius: 18px;
  box-shadow: 0 30px 90px rgba(15, 23, 42, 0.32);
}

.activity-kind-check {
  border-radius: 12px;
}

/* 2026 profile refresh */
.profile-hero-shell {
  position: relative;
  min-height: 245px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: #0f172a;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
}

.profile-hero-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.66) 42%, rgba(15, 23, 42, 0.18) 100%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.04) 0%, rgba(2, 6, 23, 0.58) 100%);
  pointer-events: none;
}

.profile-hero-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.1), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 36%);
  opacity: 0.58;
  pointer-events: none;
}

.profile-hero-media {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transform: scale(1.01);
}

.profile-hero-media.profile-hero-nophoto {
  background:
    linear-gradient(135deg, #111827 0%, #1d4ed8 48%, #0f766e 100%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.11) 0 1px, transparent 1px 20px) !important;
}

.profile-hero-media.profile-hero-nophoto::before {
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 36%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 18px);
}

.profile-hero-media.profile-hero-nophoto::after {
  background: linear-gradient(90deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.28));
}

.profile-hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 245px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.15rem 1.45rem 1.25rem;
}

.profile-hero-copy {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 720px;
  padding-bottom: 0.1rem;
}

.profile-hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 28px;
  padding: 0.35rem 0.7rem;
  margin-bottom: 0.68rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.11);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11.5px;
  font-weight: 800;
  backdrop-filter: blur(12px);
}

.profile-hero-shell .profile-hero-name {
  max-width: 820px;
  margin: 0 0 0.65rem;
  color: #fff;
  font-size: 2rem;
  font-weight: 850;
  line-height: 1.12;
  letter-spacing: 0;
  text-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
}

.profile-hero-shell .profile-hero-sektor {
  position: relative;
  max-width: min(100%, 680px);
  width: fit-content;
  overflow: hidden;
  border-radius: 14px;
  padding: 0.58rem 0.82rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08)),
    linear-gradient(90deg, rgba(20, 184, 166, 0.18), rgba(59, 130, 246, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.23);
  color: rgba(255, 255, 255, 0.94);
  text-transform: none;
  letter-spacing: 0;
  white-space: normal;
  line-height: 1.35;
  box-shadow:
    0 14px 30px rgba(2, 6, 23, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  font-size: 12px;
  font-weight: 850;
  backdrop-filter: blur(14px);
}

.profile-hero-shell .profile-hero-sektor::before {
  content: "";
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 999px;
  background: #5eead4;
  box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.16);
}

.profile-hero-completion {
  width: min(178px, 36%);
  flex: 0 0 auto;
  padding: 0.9rem 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.08)),
    rgba(15, 23, 42, 0.2);
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.22);
  color: #fff;
  backdrop-filter: blur(16px);
}

.profile-hero-completion-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.55rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 10.5px;
  font-weight: 850;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.profile-hero-completion-top span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.profile-hero-completion strong {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 1.65rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
}

.profile-hero-completion p {
  margin: 0 0 0.65rem;
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  font-weight: 750;
}

.profile-hero-completion-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.profile-hero-completion-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #5eead4);
  transition: width 0.5s ease;
}

.profile-hero-completion.is-complete {
  border-color: rgba(94, 234, 212, 0.36);
  background:
    linear-gradient(180deg, rgba(20, 184, 166, 0.24), rgba(255, 255, 255, 0.09)),
    rgba(15, 23, 42, 0.18);
}

.profile-dashboard-grid {
  --bs-gutter-x: 1.35rem;
  --bs-gutter-y: 0.45rem;
  row-gap: 0;
}

.profile-analytics-section {
  margin-top: 0.25rem;
}

.profile-dashboard-grid :deep(.spk-card-col) {
  margin-bottom: 0.45rem !important;
  padding-left: calc(var(--bs-gutter-x) * 0.5) !important;
  padding-right: calc(var(--bs-gutter-x) * 0.5) !important;
}

.profile-dashboard-grid :deep(.as-card) {
  min-height: 148px;
  border-radius: 16px;
}

.profile-action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 0.3rem;
}

.profile-action-card {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 82px;
  min-width: 0;
  width: 100%;
  padding: 0.9rem;
  text-align: left;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 18px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.profile-action-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
  transform: translateY(-2px);
}

.profile-action-card > span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.profile-action-card strong,
.profile-action-card small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-action-card strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.profile-action-card small {
  margin-top: 0.15rem;
  color: #64748b;
  font-size: 11.5px;
}

.profile-action-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  font-size: 1.12rem;
}

.action-blue { background: linear-gradient(135deg, #1d4ed8, #60a5fa); }
.action-teal { background: linear-gradient(135deg, #0f766e, #2dd4bf); }
.action-amber { background: linear-gradient(135deg, #d97706, #fbbf24); }

.action-arrow {
  color: #94a3b8;
  font-size: 1rem;
}

.profile-side-card,
.profile-about-rail,
.profile-ikas-domain-rail,
.activity-timeline-card {
  border-radius: 20px !important;
}

.profile-side-card > .card-header,
.profile-about-rail > .card-header,
.profile-ikas-domain-rail > .card-header,
.activity-timeline-card > .card-header {
  border-radius: 20px 20px 0 0 !important;
}

.activity-timeline-card > .card-body {
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.035), transparent 38%),
    #fff;
}

.activity-timeline-content,
.pic-contact-card,
.info-grid-item {
  border-radius: 16px !important;
}

.pic-contact-card {
  background: #fff;
}

.profile-about-rail {
  background:
    linear-gradient(180deg, #ffffff 0%, #fbfdff 100%) !important;
}

.profile-about-rail .card-header {
  background: #fff !important;
}

/* Dark mode: keep this below the light profile refresh styles. */
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page,
:global(html.dark) .profile-stakeholder-page {
  background: #0f172a !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-shell,
:global(html.dark) .profile-stakeholder-shell {
  background: #0f172a !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .gradient-header-card,
:global(html.dark) .profile-stakeholder-page .gradient-header-card,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-side-card,
:global(html.dark) .profile-stakeholder-page .profile-side-card,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-audit-log-card,
:global(html.dark) .profile-stakeholder-page .profile-audit-log-card,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-about-rail,
:global(html.dark) .profile-stakeholder-page .profile-about-rail,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-ikas-domain-rail,
:global(html.dark) .profile-stakeholder-page .profile-ikas-domain-rail,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-timeline-card,
:global(html.dark) .profile-stakeholder-page .activity-timeline-card,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-action-card,
:global(html.dark) .profile-stakeholder-page .profile-action-card {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .card-header:not(.stakeholder-header),
:global(html.dark) .profile-stakeholder-page .card-header:not(.stakeholder-header),
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-section-header,
:global(html.dark) .profile-stakeholder-page .profile-section-header,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .card-body,
:global(html.dark) .profile-stakeholder-page .card-body,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .card-body1,
:global(html.dark) .profile-stakeholder-page .card-body1,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .bg-white,
:global(html.dark) .profile-stakeholder-page .bg-white {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-timeline-card > .card-body,
:global(html.dark) .profile-stakeholder-page .activity-timeline-card > .card-body,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .pic-card-list,
:global(html.dark) .profile-stakeholder-page .pic-card-list {
  background: #111827 !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-year-filter,
:global(html.dark) .profile-stakeholder-page .activity-year-filter {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(17, 24, 39, 0.88) 72%, rgba(17, 24, 39, 0)) !important;
}

:global(html[data-theme-mode="dark"]) .contact-bar-item,
:global(html.dark) .contact-bar-item,
:global(html[data-theme-mode="dark"]) .info-grid-item,
:global(html.dark) .info-grid-item,
:global(html[data-theme-mode="dark"]) .activity-form-panel,
:global(html.dark) .activity-form-panel,
:global(html[data-theme-mode="dark"]) .activity-timeline-content,
:global(html.dark) .activity-timeline-content,
:global(html[data-theme-mode="dark"]) .pic-contact-card,
:global(html.dark) .pic-contact-card,
:global(html[data-theme-mode="dark"]) .ikas-audit-log-item,
:global(html.dark) .ikas-audit-log-item,
:global(html[data-theme-mode="dark"]) .ikas-domain-row,
:global(html.dark) .ikas-domain-row {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #c7d9f5 !important;
}

:global(html[data-theme-mode="dark"]) .contact-bar-item:hover,
:global(html.dark) .contact-bar-item:hover,
:global(html[data-theme-mode="dark"]) .info-grid-item:hover,
:global(html.dark) .info-grid-item:hover,
:global(html[data-theme-mode="dark"]) .activity-timeline-content:hover,
:global(html.dark) .activity-timeline-content:hover,
:global(html[data-theme-mode="dark"]) .pic-contact-card:hover,
:global(html.dark) .pic-contact-card:hover {
  border-color: rgba(37, 99, 235, 0.3) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .text-dark,
:global(html.dark) .profile-stakeholder-page .text-dark,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .company-name,
:global(html.dark) .profile-stakeholder-page .company-name,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-title,
:global(html.dark) .profile-stakeholder-page .activity-title,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .info-grid-value,
:global(html.dark) .profile-stakeholder-page .info-grid-value,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-log-top h6,
:global(html.dark) .profile-stakeholder-page .ikas-audit-log-top h6,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-action-card strong,
:global(html.dark) .profile-stakeholder-page .profile-action-card strong,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-row-head span,
:global(html.dark) .profile-stakeholder-page .ikas-domain-row-head span,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-row-head strong,
:global(html.dark) .profile-stakeholder-page .ikas-domain-row-head strong,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-summary strong,
:global(html.dark) .profile-stakeholder-page .ikas-domain-summary strong,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-priority strong,
:global(html.dark) .profile-stakeholder-page .ikas-domain-priority strong {
  color: #dde8f5 !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .text-muted,
:global(html.dark) .profile-stakeholder-page .text-muted,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .info-grid-label,
:global(html.dark) .profile-stakeholder-page .info-grid-label,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-description,
:global(html.dark) .profile-stakeholder-page .activity-description,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-date,
:global(html.dark) .profile-stakeholder-page .activity-date,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-log-meta,
:global(html.dark) .profile-stakeholder-page .ikas-audit-log-meta,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-log-content p,
:global(html.dark) .profile-stakeholder-page .ikas-audit-log-content p,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-pagination-info,
:global(html.dark) .profile-stakeholder-page .ikas-audit-pagination-info,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-action-card small,
:global(html.dark) .profile-stakeholder-page .profile-action-card small,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-row-meta span,
:global(html.dark) .profile-stakeholder-page .ikas-domain-row-meta span,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-summary span,
:global(html.dark) .profile-stakeholder-page .ikas-domain-summary span {
  color: #94a3b8 !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-log-changes span,
:global(html.dark) .profile-stakeholder-page .ikas-audit-log-changes span,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-audit-pagination,
:global(html.dark) .profile-stakeholder-page .ikas-audit-pagination {
  background: rgba(15, 23, 42, 0.55) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
}

:global(html[data-theme-mode="dark"]) .contact-bar-sep,
:global(html.dark) .contact-bar-sep {
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.12), transparent) !important;
}

:global(html[data-theme-mode="dark"]) .sp-section-title,
:global(html.dark) .sp-section-title {
  color: #4a6580 !important;
}

:global(html[data-theme-mode="dark"]) .sp-section-title::after,
:global(html.dark) .sp-section-title::after {
  background: linear-gradient(to right, rgba(37, 99, 235, 0.15), transparent) !important;
}

:global(html[data-theme-mode="dark"]) .hero-card-shell,
:global(html.dark) .hero-card-shell {
  box-shadow: 0 16px 56px rgba(0, 0, 0, 0.3), 0 6px 20px rgba(0, 0, 0, 0.2) !important;
}

:global(html[data-theme-mode="dark"]) .activity-year-chip,
:global(html.dark) .activity-year-chip,
:global(html[data-theme-mode="dark"]) .activity-tags span,
:global(html.dark) .activity-tags span,
:global(html[data-theme-mode="dark"]) .pic-count-badge,
:global(html.dark) .pic-count-badge,
:global(html[data-theme-mode="dark"]) .pic-index,
:global(html.dark) .pic-index {
  background: rgba(37, 99, 235, 0.14) !important;
  border-color: rgba(147, 197, 253, 0.2) !important;
  color: #93c5fd !important;
}

:global(html[data-theme-mode="dark"]) .pic-meta-pill,
:global(html.dark) .pic-meta-pill,
:global(html[data-theme-mode="dark"]) .activity-year-filter-chip,
:global(html.dark) .activity-year-filter-chip,
:global(html[data-theme-mode="dark"]) .activity-year-filter-reset,
:global(html.dark) .activity-year-filter-reset {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme-mode="dark"]) .activity-year-filter-chip.active,
:global(html.dark) .activity-year-filter-chip.active {
  background: linear-gradient(180deg, #2563eb, #1d4ed8) !important;
  border-color: #2563eb !important;
  color: #fff !important;
}

:global(html[data-theme-mode="dark"]) .activity-modal,
:global(html.dark) .activity-modal,
:global(html[data-theme-mode="dark"]) .activity-modal-header,
:global(html.dark) .activity-modal-header,
:global(html[data-theme-mode="dark"]) .activity-modal-body,
:global(html.dark) .activity-modal-body,
:global(html[data-theme-mode="dark"]) .activity-modal-footer,
:global(html.dark) .activity-modal-footer {
  background: #162131 !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme-mode="dark"]) .activity-modal h6,
:global(html.dark) .activity-modal h6 {
  color: #dde8f5 !important;
}

:global(html[data-theme-mode="dark"]) .activity-kind-check,
:global(html.dark) .activity-kind-check,
:global(html[data-theme-mode="dark"]) .activity-modal .form-control,
:global(html.dark) .activity-modal .form-control,
:global(html[data-theme-mode="dark"]) .activity-modal .form-select,
:global(html.dark) .activity-modal .form-select {
  background: #1a2535 !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #dde8f5 !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-ikas-domain-rail .card-header,
:global(html.dark) .profile-stakeholder-page .profile-ikas-domain-rail .card-header,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .profile-ikas-domain-rail .card-body {
  background: #0f172a !important;
}

:global(html.dark) .profile-stakeholder-page .profile-ikas-domain-rail .card-body {
  background: #0f172a !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-button,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-button {
  background: linear-gradient(180deg, #1e2d40 0%, #172235 100%) !important;
  border-color: rgba(147, 197, 253, 0.26) !important;
  color: #e5eefb !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-button:hover:not(:disabled),
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-button:hover:not(:disabled),
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-button:focus-visible,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-button:focus-visible {
  border-color: rgba(96, 165, 250, 0.62) !important;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16), 0 12px 26px rgba(0, 0, 0, 0.3) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-button i,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-button i {
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-list,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-list {
  background: #111827 !important;
  border-color: rgba(147, 197, 253, 0.22) !important;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.42) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-list button,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-list button {
  color: #dbeafe !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-list button:hover,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-list button:hover {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #ffffff !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-year-list button.active,
:global(html.dark) .profile-stakeholder-page .ikas-domain-year-list button.active {
  background: linear-gradient(135deg, #2563eb, #0f766e) !important;
  color: #ffffff !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-summary,
:global(html.dark) .profile-stakeholder-page .ikas-domain-summary {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.12)) !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-summary > span,
:global(html.dark) .profile-stakeholder-page .ikas-domain-summary > span {
  background: rgba(191, 219, 254, 0.12) !important;
  color: #bfdbfe !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-track,
:global(html.dark) .profile-stakeholder-page .ikas-domain-track {
  background: rgba(148, 163, 184, 0.18) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-priority,
:global(html.dark) .profile-stakeholder-page .ikas-domain-priority {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(146, 64, 14, 0.12)) !important;
  border-color: rgba(251, 191, 36, 0.24) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-priority span,
:global(html.dark) .profile-stakeholder-page .ikas-domain-priority span,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .ikas-domain-priority small,
:global(html.dark) .profile-stakeholder-page .ikas-domain-priority small {
  color: #fcd58b !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .skeleton-block,
:global(html.dark) .profile-stakeholder-page .skeleton-block {
  background: linear-gradient(90deg, #1e293b 0%, #263449 50%, #1e293b 100%) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .skeleton-block::after,
:global(html.dark) .profile-stakeholder-page .skeleton-block::after {
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.18), transparent) !important;
}

:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .activity-skeleton-item,
:global(html.dark) .profile-stakeholder-page .activity-skeleton-item,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .audit-skeleton-item,
:global(html.dark) .profile-stakeholder-page .audit-skeleton-item,
:global(html[data-theme-mode="dark"]) .profile-stakeholder-page .pic-skeleton-card,
:global(html.dark) .profile-stakeholder-page .pic-skeleton-card {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

/* Local dark fallback, same idea as Dashboard.vue's .is-dark wrapper. */
.profile-stakeholder-page.is-dark,
.profile-stakeholder-page.is-dark .profile-stakeholder-shell {
  background: #0f172a !important;
  color: #e2e8f0 !important;
}

.profile-stakeholder-page.is-dark .gradient-header-card,
.profile-stakeholder-page.is-dark .profile-side-card,
.profile-stakeholder-page.is-dark .profile-audit-log-card,
.profile-stakeholder-page.is-dark .profile-about-rail,
.profile-stakeholder-page.is-dark .profile-ikas-domain-rail,
.profile-stakeholder-page.is-dark .activity-timeline-card,
.profile-stakeholder-page.is-dark .profile-action-card {
  background: #111827 !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32) !important;
}

.profile-stakeholder-page.is-dark .card-header:not(.stakeholder-header),
.profile-stakeholder-page.is-dark .profile-section-header,
.profile-stakeholder-page.is-dark .card-body,
.profile-stakeholder-page.is-dark .card-body1,
.profile-stakeholder-page.is-dark .bg-white {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

.profile-stakeholder-page.is-dark .activity-timeline-card > .card-body,
.profile-stakeholder-page.is-dark .pic-card-list {
  background: #111827 !important;
}

.profile-stakeholder-page.is-dark .activity-year-filter {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(17, 24, 39, 0.88) 72%, rgba(17, 24, 39, 0)) !important;
}

.profile-stakeholder-page.is-dark .contact-bar-item,
.profile-stakeholder-page.is-dark .info-grid-item,
.profile-stakeholder-page.is-dark .activity-form-panel,
.profile-stakeholder-page.is-dark .activity-timeline-content,
.profile-stakeholder-page.is-dark .pic-contact-card,
.profile-stakeholder-page.is-dark .ikas-audit-log-item,
.profile-stakeholder-page.is-dark .ikas-domain-row {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #c7d9f5 !important;
}

.profile-stakeholder-page.is-dark .text-dark,
.profile-stakeholder-page.is-dark .company-name,
.profile-stakeholder-page.is-dark .activity-title,
.profile-stakeholder-page.is-dark .info-grid-value,
.profile-stakeholder-page.is-dark .ikas-audit-log-top h6,
.profile-stakeholder-page.is-dark .profile-action-card strong,
.profile-stakeholder-page.is-dark .ikas-domain-row-head span,
.profile-stakeholder-page.is-dark .ikas-domain-row-head strong,
.profile-stakeholder-page.is-dark .ikas-domain-summary strong,
.profile-stakeholder-page.is-dark .ikas-domain-priority strong {
  color: #dde8f5 !important;
}

.profile-stakeholder-page.is-dark .text-muted,
.profile-stakeholder-page.is-dark .info-grid-label,
.profile-stakeholder-page.is-dark .activity-description,
.profile-stakeholder-page.is-dark .activity-date,
.profile-stakeholder-page.is-dark .ikas-audit-log-meta,
.profile-stakeholder-page.is-dark .ikas-audit-log-content p,
.profile-stakeholder-page.is-dark .ikas-audit-pagination-info,
.profile-stakeholder-page.is-dark .profile-action-card small,
.profile-stakeholder-page.is-dark .ikas-domain-row-meta span,
.profile-stakeholder-page.is-dark .ikas-domain-summary span {
  color: #94a3b8 !important;
}

.profile-stakeholder-page.is-dark .ikas-audit-log-changes span,
.profile-stakeholder-page.is-dark .ikas-audit-pagination {
  background: rgba(15, 23, 42, 0.55) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
}

.profile-stakeholder-page.is-dark .activity-year-chip,
.profile-stakeholder-page.is-dark .activity-tags span,
.profile-stakeholder-page.is-dark .pic-count-badge,
.profile-stakeholder-page.is-dark .pic-index {
  background: rgba(37, 99, 235, 0.14) !important;
  border-color: rgba(147, 197, 253, 0.2) !important;
  color: #93c5fd !important;
}

.profile-stakeholder-page.is-dark .pic-meta-pill,
.profile-stakeholder-page.is-dark .activity-year-filter-chip,
.profile-stakeholder-page.is-dark .activity-year-filter-reset {
  background: #0f172a !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: #e2e8f0 !important;
}

.profile-stakeholder-page.is-dark .activity-year-filter-chip.active {
  background: linear-gradient(180deg, #2563eb, #1d4ed8) !important;
  border-color: #2563eb !important;
  color: #fff !important;
}

.profile-stakeholder-page.is-dark .profile-ikas-domain-rail .card-header,
.profile-stakeholder-page.is-dark .profile-ikas-domain-rail .card-body {
  background: #0f172a !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-button {
  background: linear-gradient(180deg, #1e2d40 0%, #172235 100%) !important;
  border-color: rgba(147, 197, 253, 0.26) !important;
  color: #e5eefb !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-button:hover:not(:disabled),
.profile-stakeholder-page.is-dark .ikas-domain-year-button:focus-visible {
  border-color: rgba(96, 165, 250, 0.62) !important;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16), 0 12px 26px rgba(0, 0, 0, 0.3) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-button i {
  color: #bfdbfe !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-list {
  background: #111827 !important;
  border-color: rgba(147, 197, 253, 0.22) !important;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.42) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-list button {
  color: #dbeafe !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-list button:hover {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #ffffff !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-year-list button.active {
  background: linear-gradient(135deg, #2563eb, #0f766e) !important;
  color: #ffffff !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-summary {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.12)) !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-summary > span {
  background: rgba(191, 219, 254, 0.12) !important;
  color: #bfdbfe !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-track {
  background: rgba(148, 163, 184, 0.18) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-priority {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(146, 64, 14, 0.12)) !important;
  border-color: rgba(251, 191, 36, 0.24) !important;
}

.profile-stakeholder-page.is-dark .ikas-domain-priority span,
.profile-stakeholder-page.is-dark .ikas-domain-priority small {
  color: #fcd58b !important;
}

.profile-stakeholder-page.is-dark .skeleton-block {
  background: linear-gradient(90deg, #1e293b 0%, #263449 50%, #1e293b 100%) !important;
}

.profile-stakeholder-page.is-dark .skeleton-block::after {
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.18), transparent) !important;
}

.profile-stakeholder-page.is-dark .activity-skeleton-item,
.profile-stakeholder-page.is-dark .audit-skeleton-item,
.profile-stakeholder-page.is-dark .pic-skeleton-card {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

@media (max-width: 767px) {
  .gradient-header-card > .card-body {
    padding: 1rem !important;
  }

  .stakeholder-header {
    min-height: auto;
  }

  .profile-hero-shell,
  .profile-hero-content {
    min-height: auto;
  }

  .profile-hero-shell {
    min-height: 220px;
    border-radius: 16px;
  }

  .profile-hero-content {
    min-height: 220px;
    align-items: flex-end;
    justify-content: flex-end;
    flex-direction: column;
    padding: 1rem;
  }

  .profile-hero-copy,
  .profile-hero-completion {
    width: 100%;
    max-width: none;
  }

  .profile-hero-completion {
    padding: 0.8rem 0.85rem;
  }

  .profile-hero-shell .profile-hero-name {
    font-size: 1.45rem;
    line-height: 1.15;
  }

  .profile-hero-shell .profile-hero-sektor {
    border-radius: 12px;
    font-size: 11.5px;
  }

  .profile-action-grid {
    grid-template-columns: 1fr;
  }

  .profile-hero {
    height: 290px;
  }

  .profile-hero-overlay {
    padding: 1.1rem;
  }

  .contact-bar {
    grid-template-columns: 1fr;
  }

  .stakeholder-table-wrap {
    margin: 0.75rem;
  }

  .profile-activity-column .activity-timeline-card {
    min-height: auto;
  }

  .profile-side-stack {
    gap: 1rem;
  }

  .profile-about-rail .info-grid {
    grid-template-columns: 1fr;
  }

  .pic-contact-card {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .pic-card-actions {
    justify-content: flex-start;
  }
}

</style>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Main container -->
  <div class="row profile-stakeholder-page" :class="{ 'is-dark': isProfileDarkMode }">
    <div class="col-xl-12">
      <div class="card custom-card gradient-header-card">
        <!-- Page Header -->
        <div class="card-header d-flex align-items-center justify-content-between gap-3 stakeholder-header">
          <div class="d-flex align-items-center gap-3">
            <div class="header-icon-box">
              <i class="ri-building-2-line"></i>
            </div>
            <div>
              <div class="card-title mb-0 text-white fw-bold header-card-title">
                {{ currentStakeholder?.nama_perusahaan || 'Profile Stakeholder' }}
              </div>
              <div class="header-subtitle mt-1">Detail informasi &amp; penilaian stakeholder</div>
            </div>
          </div>
          <router-link
            v-if="isAdmin && currentStakeholder"
            :to="`/stakeholders-profile-settings?slug=${currentStakeholder.slug}`"
            class="header-edit-profile"
          >
            <i class="ri-edit-line"></i>
            <span>Edit Profil</span>
          </router-link>
        </div>

        <div class="card-body p-4 profile-stakeholder-shell">
          <!-- Empty state -->
          <div v-if="!currentStakeholder" class="text-center py-5">
            <div class="empty-state">
              <div class="empty-icon-ring mb-3">
                <div class="empty-icon-inner"><i class="ri-building-2-line"></i></div>
              </div>
              <h6 class="fw-semibold mb-1 empty-state-title">Stakeholder Tidak Ditemukan</h6>
              <p class="text-muted fs-13 mb-0">Data stakeholder tidak ditemukan atau slug tidak valid.</p>
            </div>
          </div>

          <!-- Content -->
          <template v-else>
            <div class="row">

              <!-- ═══════════  HERO CARD  ═══════════ -->
              <div class="col-12 mb-4">
                <section class="profile-hero-shell">
                  <div
                    class="profile-hero-media"
                    :class="{ 'profile-hero-nophoto': !currentStakeholder?.photo }"
                    :style="bannerStyle"
                  ></div>

                  <div class="profile-hero-content">
                    <div class="profile-hero-copy">
                      <span class="profile-hero-kicker">
                        <i class="ri-building-4-line"></i>
                        Profil Stakeholder
                      </span>
                      <h2 class="profile-hero-name">{{ currentStakeholder.nama_perusahaan }}</h2>
                      <div class="profile-hero-sektor">
                        <i class="ri-pie-chart-2-line"></i>
                        <span>{{ currentStakeholder.sub_sektor?.nama_sub_sektor || currentStakeholder.sektor || '-' }}</span>
                      </div>
                    </div>

                    <div
                      class="profile-hero-completion"
                      :class="{ 'is-complete': profileCompletion.isComplete }"
                    >
                      <div class="profile-hero-completion-top">
                        <span><i class="ri-database-2-line"></i> Data</span>
                        <i :class="profileCompletion.isComplete ? 'ri-checkbox-circle-fill' : 'ri-loader-4-line'"></i>
                      </div>
                      <strong>{{ profileCompletion.percent }}%</strong>
                      <p>Total {{ profileCompletion.totalPoint }} poin - {{ profileCompletion.completed }}/{{ profileCompletion.total }} poin terisi</p>
                      <div class="profile-hero-completion-track">
                        <span :style="`width:${profileCompletion.percent}%`"></span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <!-- ═══════════  ANALYTICS CARDS  ═══════════ -->
              <div class="col-12 profile-analytics-section">
                <div class="tab-content">
                  <div class="tab-pane show active p-0 border-0">
                    <div class="row profile-dashboard-grid">
                      <SpkReusableAnlyticsCard
                        :analyticData="penilaian"
                        :csirtId="relatedCsirtId ?? undefined"
                        :stakeholderSlug="currentStakeholder.slug"
                      />

                      <div
                        v-if="isAdmin && ((!ikasDataMap[stakeholderSlug]?.total_kategori || ikasDataMap[stakeholderSlug]?.total_kategori === 'INPUT BELUM LENGKAP') || !relatedCsirtId || resikoStore.progressMap[stakeholderSlug]?.status !== 'COMPLETED')"
                        class="col-12 mb-2"
                      >
                        <div class="profile-action-grid">
                          <button
                            v-if="!ikasDataMap[stakeholderSlug]?.total_kategori || ikasDataMap[stakeholderSlug]?.total_kategori === 'INPUT BELUM LENGKAP'"
                            type="button"
                            class="profile-action-card"
                            @click="router.push({ path: '/ikas', query: { slug: currentStakeholder.slug } })"
                          >
                            <span class="profile-action-icon action-blue"><i class="ri-bar-chart-box-line"></i></span>
                            <span>
                              <strong>Lengkapi IKAS</strong>
                              <small>Status: {{ ikasProfileStatus }}</small>
                            </span>
                            <i class="ri-arrow-right-up-line action-arrow"></i>
                          </button>

                          <button
                            v-if="!relatedCsirtId"
                            type="button"
                            class="profile-action-card"
                            @click="router.push({ path: '/csirt', query: { stakeholder: currentStakeholder.slug } })"
                          >
                            <span class="profile-action-icon action-teal"><i class="ri-shield-keyhole-line"></i></span>
                            <span>
                              <strong>Daftarkan CSIRT</strong>
                              <small>Belum ada tim respons insiden.</small>
                            </span>
                            <i class="ri-arrow-right-up-line action-arrow"></i>
                          </button>

                          <button
                            v-if="resikoStore.progressMap[stakeholderSlug]?.status !== 'COMPLETED'"
                            type="button"
                            class="profile-action-card"
                            @click="router.push({ path: '/survey-resiko', query: { slug: currentStakeholder.slug } })"
                          >
                            <span class="profile-action-icon action-amber"><i class="ri-error-warning-line"></i></span>
                            <span>
                              <strong>Survey Risiko</strong>
                              <small>Status: {{ riskStatus }}</small>
                            </span>
                            <i class="ri-arrow-right-up-line action-arrow"></i>
                          </button>

                        </div>
                      </div>

                      <div class="col-xl-7 col-12 mb-3 profile-activity-column">
                        <div class="card custom-card activity-timeline-card profile-side-card overflow-hidden">
                          <div class="card-header profile-section-header d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 border-bottom">
                            <div class="d-flex align-items-center gap-2">
                              <div class="header-icon-ring bg-primary-transparent me-1 flex-shrink-0">
                                <i class="ri-timeline-view text-primary fs-16"></i>
                              </div>
                              <div>
                                <h6 class="card-title mb-0 fw-bold header-card-title text-dark">Aktivitas Perusahaan</h6>
                                <p class="text-muted fs-11 mb-0">Timeline kegiatan dan catatan aktivitas stakeholder</p>
                              </div>
                              <span class="pic-count-badge bg-primary-transparent text-primary ms-2 flex-shrink-0">{{ selectedActivityCount }}</span>
                            </div>
                            <button
                              v-if="isAdmin"
                              type="button"
                              class="btn btn-sm btn-primary d-flex align-items-center justify-content-center gap-2 px-3 py-2 rounded-pill shadow-sm hover-up w-100 w-sm-auto flex-shrink-0"
                              @click="openCreateAktivitas"
                            >
                              <i class="ri-add-line fs-14"></i><span class="fw-bold">Tambah Aktivitas</span>
                            </button>
                          </div>

                          <div class="card-body">
                            <div v-if="activityYearOptions.length" class="activity-year-filter">
                              <div class="activity-year-filter-label">
                                <i class="ri-calendar-2-line"></i>
                                <span>Tahun Aktivitas</span>
                              </div>
                              <div class="activity-year-filter-chips">
                                <button
                                  v-for="year in activityYearOptions"
                                  :key="year"
                                  type="button"
                                  class="activity-year-filter-chip"
                                  :class="{ active: selectedActivityYear === year }"
                                  @click="selectedActivityYear = year"
                                >
                                  {{ year }}
                                </button>
                                <button
                                  type="button"
                                  class="activity-year-filter-reset"
                                  :disabled="selectedActivityYear === currentActivityYear"
                                  @click="resetActivityYearToPresent"
                                >
                                  <i class="ri-refresh-line"></i>
                                  <span>Reset ke {{ currentActivityYear }}</span>
                                </button>
                              </div>
                            </div>

                            <div v-if="isLoadingAktivitas" class="profile-skeleton-list">
                              <div v-for="item in 3" :key="`activity-skeleton-${item}`" class="activity-skeleton-item">
                                <span class="skeleton-block skeleton-dot"></span>
                                <div class="skeleton-copy">
                                  <span class="skeleton-block skeleton-line skeleton-line-sm"></span>
                                  <span class="skeleton-block skeleton-line"></span>
                                  <span class="skeleton-block skeleton-line skeleton-line-md"></span>
                                </div>
                              </div>
                            </div>

                            <div v-else-if="!sortedAktivitas.length" class="empty-state py-4 text-center">
                              <div class="empty-icon-ring mb-3">
                                <div class="empty-icon-inner"><i class="ri-timeline-view"></i></div>
                              </div>
                              <h6 class="fw-bold mb-1 text-dark">Aktivitas Kosong</h6>
                              <p class="text-muted fs-12 mb-0 px-4 mx-auto" style="max-width: 340px;">Belum ada aktivitas yang tercatat untuk stakeholder ini.</p>
                            </div>

                            <div v-else-if="!filteredAktivitasByYear.length" class="empty-state py-4 text-center">
                              <div class="empty-icon-ring mb-3">
                                <div class="empty-icon-inner"><i class="ri-calendar-schedule-line"></i></div>
                              </div>
                              <h6 class="fw-bold mb-1 text-dark">Tidak ada aktivitas di {{ selectedActivityYear }}</h6>
                              <p class="text-muted fs-12 mb-0 px-4 mx-auto" style="max-width: 340px;">Pilih tahun lain atau reset ke tahun berjalan.</p>
                            </div>

                            <div v-else class="activity-timeline">
                              <div v-for="group in filteredAktivitasByYear" :key="group.year" class="activity-year-group">
                                <div class="activity-year-chip">
                                  <i class="ri-calendar-event-line"></i>
                                  <span>{{ group.year }}</span>
                                </div>

                                <div v-for="(item, index) in group.items" :key="item.id" class="activity-timeline-item">
                                  <div class="activity-timeline-marker">
                                    <span>{{ String(index + 1).padStart(2, '0') }}</span>
                                  </div>
                                  <div class="activity-timeline-content">
                                    <div class="activity-timeline-top">
                                      <div>
                                        <div class="activity-date">
                                          <i class="ri-calendar-event-line"></i>
                                          {{ formatActivityDate(item.tanggal_mulai) }} - {{ formatActivityDate(item.tanggal_selesai) }}
                                        </div>
                                        <h6 class="activity-title">{{ item.judul }}</h6>
                                      </div>
                                      <div v-if="isAdmin" class="activity-actions">
                                        <button type="button" class="btn btn-sm btn-icon btn-warning rounded-3 hover-lift" title="Edit Aktivitas" @click="openEditAktivitas(item)">
                                          <i class="ri-pencil-fill"></i>
                                        </button>
                                        <button type="button" class="btn btn-sm btn-icon btn-danger rounded-3 hover-lift" title="Hapus Aktivitas" @click="deleteAktivitas(item)">
                                          <i class="ri-delete-bin-5-line"></i>
                                        </button>
                                      </div>
                                    </div>
                                    <div class="activity-description" v-html="getHtmlDescription(item.deskripsi)"></div>
                                    <div v-if="item.jenis_aktivitas?.length" class="activity-tags">
                                      <span v-for="jenis in item.jenis_aktivitas" :key="`${item.id}-${jenis}`">{{ jenis }}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="card custom-card profile-audit-log-card overflow-hidden shadow-sm">
                          <div class="card-header profile-section-header d-flex align-items-center justify-content-between gap-3 py-3 border-bottom border-light">
                            <div class="d-flex align-items-center gap-2 min-w-0">
                              <div class="header-icon-ring bg-primary-transparent me-1 flex-shrink-0">
                                <i class="ri-history-line text-primary fs-16"></i>
                              </div>
                              <div class="min-w-0">
                                <h6 class="card-title mb-0 fw-bold header-card-title text-dark">Audit Log IKAS</h6>
                                <p class="text-muted fs-11 mb-0">Riwayat perubahan assessment IKAS</p>
                              </div>
                            </div>
                            <span class="pic-count-badge bg-primary-transparent text-primary flex-shrink-0">{{ displayedIkasAuditLogs.length }}</span>
                          </div>

                          <div class="card-body">
                            <div v-if="isLoadingIkasAuditLogs" class="profile-skeleton-list">
                              <div v-for="item in 5" :key="`audit-skeleton-${item}`" class="audit-skeleton-item">
                                <span class="skeleton-block skeleton-icon"></span>
                                <div class="skeleton-copy">
                                  <span class="skeleton-block skeleton-line"></span>
                                  <span class="skeleton-block skeleton-line skeleton-line-lg"></span>
                                  <span class="skeleton-block skeleton-line skeleton-line-sm"></span>
                                </div>
                              </div>
                            </div>

                            <div v-else-if="!displayedIkasAuditLogs.length" class="empty-state py-4 text-center">
                              <div class="empty-icon-ring mb-3">
                                <div class="empty-icon-inner"><i class="ri-history-line"></i></div>
                              </div>
                              <h6 class="fw-bold mb-1 text-dark">Audit Log IKAS Kosong</h6>
                              <p class="text-muted fs-12 mb-0 px-4 mx-auto" style="max-width: 340px;">Belum ada riwayat perubahan IKAS untuk stakeholder ini.</p>
                            </div>

                            <div v-else>
                              <div class="ikas-audit-log-list">
                              <div
                                v-for="log in paginatedIkasAuditLogs"
                                :key="log.id || `${getAuditLogIkasId(log)}-${log.created_at || log.updated_at}`"
                                class="ikas-audit-log-item"
                              >
                                <div class="ikas-audit-log-icon">
                                  <i class="ri-file-history-line"></i>
                                </div>
                                <div class="ikas-audit-log-content">
                                  <div class="ikas-audit-log-top">
                                    <h6>{{ getAuditLogTitle(log) }}</h6>
                                    <span class="ikas-audit-log-status">{{ getAuditLogActionLabel(log) }}</span>
                                  </div>
                                  <p>{{ getAuditLogDescription(log) }}</p>
                                  <div v-if="getAuditLogChangeLines(log).length" class="ikas-audit-log-changes">
                                    <span
                                      v-for="line in getAuditLogChangeLines(log)"
                                      :key="`${log.id || getAuditLogIkasId(log)}-${line}`"
                                    >
                                      {{ line }}
                                    </span>
                                  </div>
                                  <div class="ikas-audit-log-meta">
                                    <span><i class="ri-file-user-line"></i>{{ getAuditLogRespondent(log) }}</span>
                                    <span><i class="ri-user-line"></i>{{ getAuditLogActor(log) }}</span>
                                    <span><i class="ri-time-line"></i>{{ formatAuditLogDate(log.created_at || log.updated_at) }}</span>
                                  </div>
                                </div>
                              </div>
                              </div>

                              <div v-if="auditLogTotalPages > 1" class="ikas-audit-pagination">
                                <div class="ikas-audit-pagination-info">
                                  {{ auditLogPageStart }}-{{ auditLogPageEnd }} dari {{ displayedIkasAuditLogs.length }} log
                                </div>
                                <div class="ikas-audit-pagination-controls">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-icon btn-light"
                                    :disabled="auditLogPage <= 1"
                                    @click="changeAuditLogPage(auditLogPage - 1)"
                                  >
                                    <i class="ri-arrow-left-s-line"></i>
                                  </button>
                                  <button
                                    v-for="page in auditLogPageNumbers"
                                    :key="`audit-page-${page}`"
                                    type="button"
                                    class="btn btn-sm"
                                    :class="page === auditLogPage ? 'btn-primary' : 'btn-light'"
                                    @click="changeAuditLogPage(page)"
                                  >
                                    {{ page }}
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-icon btn-light"
                                    :disabled="auditLogPage >= auditLogTotalPages"
                                    @click="changeAuditLogPage(auditLogPage + 1)"
                                  >
                                    <i class="ri-arrow-right-s-line"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
     
                      <div class="col-xl-5 col-12 mb-4 profile-side-stack">
                        <div class="card custom-card profile-side-card overflow-hidden shadow-sm">
                          <div class="card-header profile-section-header d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 py-3 border-bottom border-light">
                            <div class="d-flex align-items-center gap-2">
                              <div class="header-icon-ring bg-primary-transparent me-1 flex-shrink-0">
                                <i class="ri-contacts-line text-primary fs-16"></i>
                              </div>
                              <div>
                                <h6 class="card-title mb-0 fw-bold header-card-title text-dark">PIC Perusahaan</h6>
                                <p class="text-muted fs-11 mb-0">Kelola kontak Person in Charge (PIC) perusahaan ini</p>
                              </div>
                              <span class="pic-count-badge bg-primary-transparent text-primary ms-2 flex-shrink-0">{{ friends.length }}</span>
                            </div>
                            <button v-if="isAdmin" @click="router.push({ path: '/pic-add', query: { slug: currentStakeholder.slug, id_perusahaan: currentStakeholder.id } })" class="btn btn-sm btn-primary d-flex align-items-center justify-content-center gap-2 px-3 py-2 rounded-pill shadow-sm hover-up w-100 w-sm-auto flex-shrink-0">
                              <i class="ri-add-line fs-14"></i><span class="fw-bold">Tambah PIC</span>
                            </button>
                          </div>
                          
                          <div class="card-body1 p-0">
                            <div v-if="isLoadingPics" class="pic-card-list">
                              <div v-for="item in 3" :key="`pic-skeleton-${item}`" class="pic-contact-card pic-skeleton-card">
                                <div class="pic-contact-main">
                                  <span class="skeleton-block skeleton-pill"></span>
                                  <span class="skeleton-block skeleton-avatar"></span>
                                  <div class="skeleton-copy">
                                    <span class="skeleton-block skeleton-line"></span>
                                    <span class="skeleton-block skeleton-line skeleton-line-sm"></span>
                                  </div>
                                </div>
                                <div class="skeleton-copy">
                                  <span class="skeleton-block skeleton-line"></span>
                                  <span class="skeleton-block skeleton-line skeleton-line-md"></span>
                                </div>
                                <span class="skeleton-block skeleton-actions"></span>
                              </div>
                            </div>

                            <div v-else-if="!friends.length" class="empty-state py-4 text-center">
                              <div class="empty-icon-ring mb-3">
                                <div class="empty-icon-inner"><i class="ri-contacts-book-2-line"></i></div>
                              </div>
                              <h6 class="fw-bold mb-1 text-dark">Daftar PIC Kosong</h6>
                              <p class="text-muted fs-12 mb-0 px-4 mx-auto" style="max-width: 320px;">Belum ada data PIC yang terdaftar untuk stakeholder ini.</p>
                            </div>

                            <div v-else class="pic-card-list">
                              <div v-for="(pic, index) in friends" :key="pic.id" class="pic-contact-card">
                                <div class="pic-contact-main">
                                  <span class="pic-index">{{ index + 1 }}</span>
                                  <div class="company-avatar" :class="getPicAvatarClass(pic.nama || '')">
                                    <span class="company-avatar-letter text-uppercase">{{ pic.nama?.charAt(0) }}</span>
                                  </div>
                                  <div class="pic-contact-copy">
                                    <span class="company-name text-dark fw-bold">{{ pic.nama }}</span>
                                    <span class="text-muted fs-11">Person in Charge</span>
                                  </div>
                                </div>

                                <div class="pic-contact-meta">
                                  <a :href="'mailto:' + pic.email" class="pic-meta-pill" :title="pic.email">
                                    <i class="ri-mail-line"></i>
                                    <span>{{ pic.email }}</span>
                                  </a>
                                  <a :href="'tel:' + pic.telepon" class="pic-meta-pill" :title="pic.telepon">
                                    <i class="ri-phone-line"></i>
                                    <span>{{ pic.telepon }}</span>
                                  </a>
                                </div>

                                <div v-if="isAdmin" class="pic-card-actions">
                                  <button @click="editPIC(pic)" class="btn btn-sm btn-icon btn-warning rounded-3 hover-lift" title="Edit Data">
                                    <i class="ri-pencil-fill"></i>
                                  </button>
                                  <button @click="deletePIC(pic)" class="btn btn-sm btn-icon btn-danger rounded-3 hover-lift" title="Hapus Data">
                                    <i class="ri-delete-bin-5-line"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                      <!-- ═══════════  TENTANG PERUSAHAAN  ═══════════ -->
                        <div class="card custom-card profile-about-rail">
                          <div class="card-header profile-section-header d-flex align-items-center gap-3 border-bottom">
                            <div>
                              <div class="card-title mb-0 fw-semibold text-dark">Tentang Perusahaan</div>
                              <div class="text-muted fs-13 mt-1">{{ currentStakeholder.sub_sektor?.nama_sub_sektor || currentStakeholder.sektor }}</div>
                            </div>
                          </div>
                          <div class="card-body">
                            <!-- Company description -->
                            <p class="text-muted fs-13 mb-3" style="line-height:1.7">{{ companyDescription }}</p>

                            <!-- Detail items -->
                            <div class="info-grid">
                              <div
                                v-for="(item, idx) in companyDetails"
                                :key="idx"
                                class="info-grid-item"
                              >
                                <div class="info-grid-icon" :class="item.colorClass">
                                  <i :class="item.icon"></i>
                                </div>
                                <div style="min-width:0;flex:1">
                                  <div class="info-grid-label">{{ item.label }}</div>
                                  <a
                                    v-if="item.isLink"
                                    :href="item.href"
                                    target="_blank"
                                    class="info-grid-value text-primary fw-semibold d-block text-decoration-none"
                                  >{{ item.value }}</a>
                                  <div
                                    v-else
                                    class="info-grid-value"
                                    :class="{ 'wrap-text': item.wrap }"
                                  >{{ item.value }}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div ref="ikasDomainRailRef" class="card custom-card profile-ikas-domain-rail">
                          <div class="card-header profile-section-header d-flex align-items-center justify-content-between gap-3 border-bottom">
                            <div>
                              <div class="card-title mb-0 fw-semibold text-dark">IKAS per Domain</div>
                              <div class="text-muted fs-13 mt-1">Skor domain berdasarkan tahun pengukuran</div>
                            </div>
                            <div class="ikas-domain-year-menu">
                              <button
                                type="button"
                                class="ikas-domain-year-button"
                                :disabled="!ikasYearOptions.length || ikasStore.apiLoading"
                                @click="isIkasYearMenuOpen = !isIkasYearMenuOpen"
                              >
                                <span>{{ selectedIkasYear || 'Tahun' }}</span>
                                <i class="ri-arrow-down-s-line" :class="{ open: isIkasYearMenuOpen }"></i>
                              </button>
                              <div v-if="isIkasYearMenuOpen && ikasYearOptions.length" class="ikas-domain-year-list">
                                <button
                                  v-for="year in ikasYearOptions"
                                  :key="year"
                                  type="button"
                                  :class="{ active: selectedIkasYear === year }"
                                  @click="selectedIkasYear = year"
                                >
                                  {{ year }}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div class="card-body">
                            <div v-if="ikasStore.apiLoading" class="ikas-domain-loading">
                              <span class="spinner-border spinner-border-sm"></span>
                              <span>Memuat data IKAS {{ selectedIkasYear }}...</span>
                            </div>

                            <div v-else-if="!ikasYearOptions.length" class="empty-state py-4 text-center">
                              <div class="empty-icon-ring mb-3">
                                <div class="empty-icon-inner"><i class="ri-bar-chart-box-line"></i></div>
                              </div>
                              <h6 class="fw-bold mb-1 text-dark">Data IKAS Belum Ada</h6>
                              <p class="text-muted fs-12 mb-0 px-4 mx-auto" style="max-width: 320px;">Belum ada hasil IKAS yang bisa ditampilkan per domain.</p>
                            </div>

                            <template v-else>
                              <div class="ikas-domain-summary ikas-domain-animate">
                                <div>
                                  <span>Nilai IKAS {{ selectedIkasYear }}</span>
                                  <strong>{{ formatIkasScore(selectedIkasDomainData.total_rata_rata) }}</strong>
                                </div>
                                <span>{{ selectedIkasDomainData.total_kategori || 'Belum Diisi' }}</span>
                              </div>

                              <div class="ikas-domain-list">
                                <div
                                  v-for="domain in ikasDomainRows"
                                  :key="domain.key"
                                  class="ikas-domain-row ikas-domain-animate"
                                  :class="domain.colorClass"
                                >
                                  <span class="ikas-domain-icon"><i :class="domain.icon"></i></span>
                                  <div>
                                    <div class="ikas-domain-row-head">
                                      <span>{{ domain.label }}</span>
                                      <strong>{{ formatIkasScore(domain.score) }}</strong>
                                    </div>
                                    <div class="ikas-domain-track">
                                      <span class="ikas-domain-fill" :style="`width:${getDomainScorePercent(domain.score)}%`"></span>
                                    </div>
                                    <div class="ikas-domain-row-meta">
                                      <span>{{ domain.category }}</span>
                                      <span>{{ domain.progress.completed }}/{{ domain.progress.total }} subdomain</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div class="ikas-domain-priority ikas-domain-animate">
                                <span class="ikas-domain-priority-icon"><i class="ri-focus-3-line"></i></span>
                                <div>
                                  <span>Prioritas domain</span>
                                  <strong>{{ weakestIkasDomain ? weakestIkasDomain.label : 'Belum tersedia' }}</strong>
                                  <small>{{ weakestIkasDomain ? `${formatIkasScore(weakestIkasDomain.score)} - ${weakestIkasDomain.category}` : 'Isi IKAS terlebih dahulu untuk melihat prioritas.' }}</small>
                                </div>
                              </div>
                            </template>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="isActivityFormVisible"
    class="activity-modal-backdrop"
    role="dialog"
    aria-modal="true"
    @click.self="closeAktivitasForm"
  >
    <div class="activity-modal">
      <div class="activity-modal-header">
        <div class="d-flex align-items-center gap-2">
          <div class="header-icon-ring bg-primary-transparent me-1 flex-shrink-0">
            <i class="ri-timeline-view text-primary fs-16"></i>
          </div>
          <div>
            <h6 class="mb-0 fw-bold text-dark">
              {{ editingAktivitasId ? 'Edit Aktivitas' : 'Tambah Aktivitas' }}
            </h6>
            <p class="text-muted fs-11 mb-0">{{ currentStakeholder?.nama_perusahaan }}</p>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-icon btn-light rounded-3" :disabled="isSavingAktivitas" @click="closeAktivitasForm">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="activity-modal-body">
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label fs-12 fw-bold text-muted text-uppercase">Judul</label>
            <input v-model="aktivitasForm.judul" type="text" class="form-control" placeholder="Masukkan judul aktivitas" />
          </div>
          <div class="col-md-6">
            <label class="form-label fs-12 fw-bold text-muted text-uppercase">Tanggal Mulai</label>
            <input v-model="aktivitasForm.tanggal_mulai" type="date" class="form-control" />
          </div>
          <div class="col-md-6">
            <label class="form-label fs-12 fw-bold text-muted text-uppercase">Tanggal Selesai</label>
            <input v-model="aktivitasForm.tanggal_selesai" type="date" class="form-control" />
          </div>
          <div class="col-12">
            <label class="form-label fs-12 fw-bold text-muted text-uppercase">Jenis Aktivitas</label>
            <div v-if="jenisAktivitasOptions.length" class="activity-kind-options">
              <label v-for="jenis in jenisAktivitasOptions" :key="jenis" class="activity-kind-check">
                <input v-model="aktivitasForm.jenis_aktivitas" type="checkbox" :value="jenis" />
                <span>{{ jenis }}</span>
              </label>
            </div>
            <div v-else class="text-muted fs-12">Jenis aktivitas belum tersedia dari server.</div>
          </div>
          <div class="col-12">
            <label class="form-label fs-12 fw-bold text-muted text-uppercase">Deskripsi</label>
            <LmsEditor
              v-model="aktivitasForm.deskripsi"
              variant="compact"
              :min-height="240"
              placeholder="Tulis ringkasan aktivitas di sini... Gunakan heading, list, link, gambar, tabel, dan format teks lainnya."
            />
          </div>
        </div>
      </div>

      <div class="activity-modal-footer">
        <button type="button" class="btn btn-light" :disabled="isSavingAktivitas" @click="closeAktivitasForm">Batal</button>
        <button type="button" class="btn btn-primary" :disabled="isSavingAktivitas" @click="saveAktivitas">
          <span v-if="isSavingAktivitas" class="spinner-border spinner-border-sm me-2"></span>
          {{ editingAktivitasId ? 'Update Aktivitas' : 'Simpan Aktivitas' }}
        </button>
      </div>
    </div>
  </div>

</template>

