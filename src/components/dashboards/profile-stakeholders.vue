<script setup lang="ts">
// Import Vue FilePond
import vueFilePond from "vue-filepond";
import { useRoute } from "vue-router";
import { useStakeholdersStore } from "../../stores/stakeholders";
import type { Stakeholder } from "../../types/stakeholders.types";
import { computed, ref, onMounted, onActivated, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { picService } from "../../services/pic.service";
import type { Pic } from "../../types/pic.types";
import { useCsirtStore } from "../../stores/csirt";
import { useAuthStore } from "../../stores/auth";
import { useIkasStore } from "../../stores/ikas";
import { useKseStore } from "../../stores/kse";

const authStore = useAuthStore();
const ikasStore = useIkasStore();
const kseStore = useKseStore();
const csirtStore = useCsirtStore();
const isAdmin = computed(() => authStore.isAdmin);

// Use storeToRefs to get reactive refs — ensures computed() tracks store state changes
const { ikasDataMap, ikasVersion } = storeToRefs(ikasStore);
const { kseDataMap, kseVersion } = storeToRefs(kseStore);

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

const loadPics = async () => {
  const stakeholder = currentStakeholder.value;
  if (!stakeholder) return;
  isLoadingPics.value = true;
  try {
    friends.value = await picService.getByPerusahaan(stakeholder.id);
  } catch {
    friends.value = [];
  } finally {
    isLoadingPics.value = false;
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
    if (!stakeholdersStore.initialized) {
        await stakeholdersStore.initialize();
    }
    ikasStore.initialize();
    kseStore.initialize();
    if (!csirtStore.initialized) {
        await csirtStore.initialize();
    }
    await loadPics();
});

// Reload pics when navigating back to this page (keep-alive)
onActivated(async () => {
    await loadPics();
});

// Reload pics when switching between stakeholder profiles
watch(stakeholderSlug, async (newSlug, oldSlug) => {
    if (newSlug && newSlug !== oldSlug) {
        await loadPics();
    }
});

// Dynamic penilaian from IKAS and KSE stores
const penilaian = computed(() => {
  const slug = stakeholderSlug.value;
  if (!slug) return [];

  // Read version signals so Vue tracks them as computed dependencies.
  // This forces re-evaluation whenever store data is loaded/saved.
  void ikasVersion.value;
  void kseVersion.value;
  const ikasData = ikasDataMap.value[slug] ?? ikasStore.getIkasData(slug);

  // KSE entries are stored under compound keys like `${slug}_kse_${timestamp}`
  // (created by KategorisasiSE-list.vue), NOT under the plain stakeholder slug.
  // Check if any such entry exists with submitted or filled data.
  const kseEntryKeys = Object.keys(kseDataMap.value).filter(k => k.startsWith(slug + '_kse_'));
  const hasKseData = kseEntryKeys.some(k => {
    const d = kseDataMap.value[k];
    return d && (d.isSubmitted || d.totalBobot > 0 || d.lastUpdated !== '');
  });
  // Also check the legacy plain-slug key just in case
  const kseData = kseDataMap.value[slug] ?? kseStore.getKseData(slug);

  return [
    {
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><g><rect fill="none" height="24" width="24"></rect></g><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"></path></g></svg>`,
      svgColor: "primary",
      title: "IKAS",
      value: ikasData.total_kategori && ikasData.total_kategori !== "INPUT BELUM LENGKAP" ? ikasData.total_kategori : "Belum Diisi"
    },
    {
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-3h2v3zm0-5h-2v-2h2v2zm4 5h-2V7h2v10z"></path></svg>`,
      svgColor: "secondary",
      title: "KSE",
      value: (hasKseData || kseData.isSubmitted || kseData.totalBobot > 0 || kseData.lastUpdated !== '' || (kseData.kategoriSE && kseData.kategoriSE !== 'Belum Dikategorikan')) ? "Sudah Terdaftar" : "Belum Diisi"
    },
    {
      svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"></path><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>`,
      svgColor: "success",
      title: "CSIRT",
      value: relatedCsirtId.value ? "Terdaftar" : "Belum Terdaftar"
    }
  ];
});

const relatedCsirtId = computed(() => {
  if (!currentStakeholder.value) return null;
  const csirt = csirtStore.csirts.find(
    (c) => String(c.id_perusahaan) === String(currentStakeholder.value?.id)
      || c.perusahaan?.id === String(currentStakeholder.value?.id)
  );
  return csirt ? (csirt.id as any) : null;
});



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
    { icon: 'ri-shield-check-line', label: 'Status CSIRT', value: relatedCsirtId.value ? 'Terdaftar' : 'Belum Terdaftar', colorClass: relatedCsirtId.value ? 'stat-icon-teal' : 'stat-icon-violet' },
  ];
});
</script>

<style src="../../assets/css/style2.css"></style>
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
  grid-template-columns: repeat(2, 1fr);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info-grid-value.wrap-text {
  white-space: normal;
  line-height: 1.45;
}

/* ─────────────────────────────────────────────
   PIC TABLE CARD
   ───────────────────────────────────────────── */
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
html[data-theme-mode="dark"] .contact-bar-item,
html.dark .contact-bar-item {
  background: linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(124,58,237,0.06) 100%);
  border-color: rgba(255,255,255,0.08);
  color: #c7d9f5;
}
html[data-theme-mode="dark"] .contact-bar-item:hover,
html.dark .contact-bar-item:hover {
  border-color: rgba(37,99,235,0.3);
  box-shadow: 0 6px 20px rgba(37,99,235,0.15), 0 2px 8px rgba(0,0,0,0.3);
  color: #dbeafe;
}
html[data-theme-mode="dark"] .contact-bar-sep,
html.dark .contact-bar-sep {
  background: linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent);
}

html[data-theme-mode="dark"] .info-grid-item,
html.dark .info-grid-item {
  background: linear-gradient(145deg, #1a2535 0%, #1e2d40 100%);
  border-color: rgba(255,255,255,0.08);
}
html[data-theme-mode="dark"] .info-grid-item:hover,
html.dark .info-grid-item:hover {
  border-color: rgba(37,99,235,0.25);
  box-shadow: 0 8px 28px rgba(0,0,0,0.3);
}
html[data-theme-mode="dark"] .info-grid-value,
html.dark .info-grid-value { color: #dde8f5; }
html[data-theme-mode="dark"] .info-grid-label,
html.dark .info-grid-label { color: #4a6580; }

html[data-theme-mode="dark"] .sp-section-title,
html.dark .sp-section-title { color: #4a6580; }
html[data-theme-mode="dark"] .sp-section-title::after,
html.dark .sp-section-title::after { background: linear-gradient(to right, rgba(37,99,235,0.15), transparent); }

html[data-theme-mode="dark"] .hero-card-shell,
html.dark .hero-card-shell {
  box-shadow: 0 16px 56px rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.2);
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
  .profile-hero { height: 220px; }
  .profile-hero-name { font-size: 1.25rem; }
  .info-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 575px) {
  .profile-hero { height: 180px; }
  .profile-hero-name { font-size: 1.1rem; }
  .info-grid { grid-template-columns: 1fr; }
  .profile-hero-overlay { padding: 1rem 1.25rem; }
  .contact-bar { flex-direction: column; gap: 0.75rem; padding: 14px 16px; }
  .contact-bar-sep { display: none; }
  .contact-bar-item { width: 100%; justify-content: center; }
}
</style>

<template>
  <Pageheader :propData="dataToPass" />

  <!-- Main container -->
  <div class="row">
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
        </div>

        <div class="card-body p-4">
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
              <div class="col-12 mb-6">
                <div class="card custom-card hero-card-shell">
                  <!-- Banner -->
                    <div
                      class="profile-hero"
                      :class="{ 'profile-hero-nophoto': !currentStakeholder?.photo }"
                      :style="bannerStyle"
                    >
                    <div class="profile-hero-overlay">
                      <div>
                        <p class="profile-hero-name">{{ currentStakeholder.nama_perusahaan }}</p>
                        <span class="profile-hero-sektor">
                          <i class="ri-pie-chart-2-line"></i>
                          {{ currentStakeholder.sub_sektor?.nama_sub_sektor || currentStakeholder.sektor }}
                        </span>
                      </div>
                      <router-link
                        v-if="isAdmin"
                        :to="`/stakeholders-profile-settings?slug=${currentStakeholder.slug}`"
                        class="btn-edit-profile"
                      >
                        <i class="ri-edit-line"></i>
                        <span class="d-none d-sm-inline">Edit Profil</span>
                      </router-link>
                    </div>
                  </div>

                  <!-- Contact bar -->
                  <div style="border-top:1px solid #eef3fb">
                    <div class="contact-bar">
                      <a :href="'tel:' + currentStakeholder.telepon" class="contact-bar-item">
                        <span class="contact-bar-icon cbi-teal"><i class="ri-phone-line"></i></span>
                        <span class="contact-bar-text">{{ currentStakeholder.telepon }}</span>
                      </a>
                      <div class="contact-bar-sep"></div>
                      <a :href="'mailto:' + currentStakeholder.email" class="contact-bar-item">
                        <span class="contact-bar-icon cbi-violet"><i class="ri-mail-line"></i></span>
                        <span class="contact-bar-text">{{ currentStakeholder.email }}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ═══════════  ANALYTICS CARDS  ═══════════ -->
              <div class="col-12">
                <div class="tab-content">
                  <div class="tab-pane show active p-0 border-0">
                    <div class="row">

                     
                      <SpkReusableAnlyticsCard
                        :analyticData="penilaian"
                        :csirtId="relatedCsirtId ?? undefined"
                        :stakeholderSlug="currentStakeholder.slug"
                      />

                      <!-- Daftarkan CSIRT button (admin only, when not yet registered) -->
                      <div v-if="isAdmin && !relatedCsirtId" class="col-12 mb-3">
                        <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 px-3">
                          <div class="d-flex align-items-center gap-2">
                            <i class="ri-shield-check-line fs-16"></i>
                            <span class="fs-13">CSIRT belum terdaftar untuk perusahaan ini.</span>
                          </div>
                          <button @click="router.push({ path: '/csirt', query: { stakeholder: currentStakeholder.slug } })" class="btn btn-sm btn-primary d-flex align-items-center gap-1">
                            <i class="ri-add-circle-line fs-14"></i>
                            <span>Daftarkan CSIRT</span>
                          </button>
                        </div>
                      </div>

     
                      <div class="col-12 mb-4">
                        <div class="card custom-card">
                          <div class="card-header d-flex align-items-center justify-content-between gap-3 bg-white border-bottom">
                            <div class="d-flex align-items-center gap-2">
                              <div class="card-title mb-0 fw-semibold text-dark">PIC Perusahaan</div>
                              <span class="pic-count-badge bg-primary-transparent text-primary ms-2">{{ friends.length }}</span>
                            </div>
                            <button v-if="isAdmin" @click="router.push({ path: '/pic-add', query: { slug: currentStakeholder.slug, id_perusahaan: currentStakeholder.id } })" class="btn-sm btn-primary d-flex align-items-center gap-2 btn-edit-profile">
                              <i class="ri-add-line"></i><span>Add PIC</span>
                            </button>
                          </div>
                          <div class="card-body p-0">
                            <div class="stakeholder-table-wrap" style="border:none;border-radius:0;box-shadow:none">
                              <table class="table stakeholder-table text-nowrap mb-0">
                                <thead class="stakeholder-thead">
                                  <tr>
                                    <th class="th-no">No</th>
                                    <th>
                                      <div class="d-flex align-items-center gap-2">
                                        <i class="ri-user-line text-primary"></i>Nama
                                      </div>
                                    </th>
                                    <th>
                                      <div class="d-flex align-items-center gap-2">
                                        <i class="ri-phone-line text-primary"></i>Telepon
                                      </div>
                                    </th>
                                    <th v-if="isAdmin" class="text-center th-actions-sm">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-if="!friends.length && !isLoadingPics">
                                    <td :colspan="isAdmin ? 4 : 3" class="text-center py-5">
                                      <div class="empty-state">
                                        <div class="empty-icon-ring mb-3">
                                          <div class="empty-icon-inner"><i class="ri-contacts-line"></i></div>
                                        </div>
                                        <h6 class="fw-semibold mb-1 empty-state-title">Belum Ada PIC</h6>
                                        <p class="text-muted fs-13 mb-0">Belum ada data PIC untuk perusahaan ini.</p>
                                      </div>
                                    </td>
                                  </tr>
                                  <tr v-if="isLoadingPics">
                                    <td :colspan="isAdmin ? 4 : 3" class="text-center py-4">
                                      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                                      <span class="text-muted fs-13">Memuat data PIC...</span>
                                    </td>
                                  </tr>
                                  <tr v-for="(pic, index) in friends" :key="pic.id" class="stakeholder-row">
                                    <td class="align-middle text-center">
                                      <span class="row-number">{{ index + 1 }}</span>
                                    </td>
                                    <td class="align-middle">
                                      <div class="d-flex align-items-center gap-3">
                                        <div class="company-avatar" :class="getPicAvatarClass(pic.nama || '')">
                                          <span class="company-avatar-letter">{{ pic.nama?.charAt(0)?.toUpperCase() }}</span>
                                        </div>
                                        <span class="company-name">{{ pic.nama }}</span>
                                      </div>
                                    </td>
                                    <td class="align-middle">
                                      <span class="text-muted fs-13">
                                        <i class="ri-phone-line me-1"></i>{{ pic.telepon }}
                                      </span>
                                    </td>
                                    <td v-if="isAdmin" class="text-center align-middle">
                                      <div class="d-flex gap-1 justify-content-center">
                                        <button @click="editPIC(pic)" class="btn btn-sm btn-icon btn-wave btn-warning-light" title="Edit">
                                          <i class="ri-pencil-line"></i>
                                        </button>
                                        <button @click="deletePIC(pic)" class="btn btn-sm btn-icon btn-wave btn-danger-light" title="Hapus">
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

                      <!-- ═══════════  TENTANG PERUSAHAAN  ═══════════ -->
                      <div class="col-12 mb-4">
                        <div class="card custom-card">
                          <div class="card-header d-flex align-items-center gap-3 bg-white border-bottom">
                            <div>
                              <div class="card-title mb-0 fw-semibold text-dark">Tentang Perusahaan</div>
                              <div class="text-muted fs-13 mt-1">{{ currentStakeholder.sub_sektor?.nama_sub_sektor || currentStakeholder.sektor }}</div>
                            </div>
                          </div>
                          <div class="card-body">
                            <!-- Company description -->
                            <p class="text-muted fs-13 mb-3" style="line-height:1.7">{{ companyDescription }}</p>

                            <!-- Detail items -->
                            <div class="info-grid" style="grid-template-columns:repeat(3, 1fr)">
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


</template>
