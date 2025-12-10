<script setup lang="ts">
// Import Vue FilePond
import vueFilePond from 'vue-filepond'
import { useRoute } from 'vue-router'
import { stakeholdersData } from '../../data/dummydata.ts'
import type { Stakeholder } from '../../data/dummydata.ts'
import type { Penilaian } from "../../data/dashboards/dummyDataPercentage";
import { stakeholderPenilaian } from "../../data/dashboards/dummyDataPercentage";
import { computed, ref, onMounted } from 'vue'

// Import FilePond styles
import 'filepond/dist/filepond.min.css'

// Import image preview plugin styles
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css'

// Import image preview and file type validation plugins
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import * as indexPenilaian from "../../data/dashboards/dummyDataPercentage";
import * as ProfileData from "../../data/pages/profiledata";
import ProfileGallery from "../../shared/UI/profileGallery.vue";
import Pageheader from '../../shared/components/pageheader/pageheader.vue'
import SpkReusableAnlyticsCard from "../../shared/components/@spk/dashboards/spk-reusable-anlyticsStakeholder.vue";


// Create component
const FilePond = vueFilePond(
    FilePondPluginFileValidateType,
    FilePondPluginImagePreview
)

const route = useRoute()
let myFiles = []

const stakeholderSlug = computed(() => route.params.slug as string)

// Cari stakeholder berdasarkan slug
const currentStakeholder = computed<Stakeholder | undefined>(() => {
    return stakeholdersData.find(sh => sh.slug === stakeholderSlug.value)
})

// Cari penilaian berdasarkan slug
const penilaian = computed<Penilaian[]>(() => {
    const found = stakeholderPenilaian.find(sp => sp.slug === stakeholderSlug.value)
    return found ? found.penilaian : []
})

const dataToPass = computed(() => ({
    // title: {
    //     text: "Stakeholders",
    //     link: "/stakeholders"
    // },
    currentpage: `Profile ${currentStakeholder.value?.nama_perusahaan || 'Stakeholder'}`,
    activepage: "Profile Stakeholders",
}))


</script>


<style scoped>
/* Profile Card Styles */
.profile-card {
    overflow: visible;
}

.profile-banner-image {
    height: 400px;
    overflow: hidden;
}

.profile-banner-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Responsive - Tablet (768px - 991px) */
@media (max-width: 991px) {
    .profile-banner-image {
        height: 220px;
    }
}

/* Responsive - Mobile (576px - 767px) */
@media (max-width: 767px) {
    .profile-banner-image {
        height: 180px;
    }
}

/* Responsive - Small Mobile (< 576px) */
@media (max-width: 575px) {
    .profile-banner-image {
        height: 150px;
    }
}
</style>

<template>
<Pageheader :propData="dataToPass" />
<!-- Start:: row-1 -->
<div class="row justify-content-center">
    <div class="col-xl-10">
        <!-- Error handling jika stakeholder tidak ditemukan -->
        <div v-if="!currentStakeholder" class="alert alert-warning alert-dismissible fade show" role="alert">
            <strong>Oops!</strong> Data stakeholder tidak ditemukan.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>

        <!-- Content jika stakeholder ditemukan -->
        <template v-else>
            <div class="row">
                <div class="col-xl-12">
                    <div class="card custom-card profile-card">
                        <div class="profile-banner-image">
                            <img :src="currentStakeholder.photo" class="card-img-top" alt="foto-perusahaan">
                        </div>
                        <div class="card-body p-4 pb-0 position-relative">
                            <div class="d-flex align-items-end justify-content-between flex-wrap">
                                <div class="profile-avatar-container">
                                    <div class="mt-4 mb-3 d-flex align-items-center flex-wrap gap-3 justify-content-between">
                                        <div>
                                            <h1 class="fw-semibold" style="margin-top: -1.75rem !important;">{{ currentStakeholder.nama_perusahaan }}</h1>
                                            <span class="d-block fw-medium text-muted mb-1">{{ currentStakeholder.sektor }}</span>
                                            <p class="fs-12 mb-0 fw-medium text-muted">
                                                <span class="me-3"><i class="ri-building-line me-1 align-middle"></i>{{ currentStakeholder.alamat }}</span>
                                                <span class="me-3"><i class="ri-phone-line me-1 align-middle"></i>{{ currentStakeholder.telepon }}</span>
                                                <span><i class="ri-mail-line me-1 align-middle"></i>{{ currentStakeholder.email }}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <router-link to="/pages/profile-settings" class="btn btn-warning d-flex align-items-start mb-5 gap-2"><i class="ri-edit-line"></i><span>Edit Profil</span></router-link>
                                <!-- <router-link :to="`/pages/profile-settings`" class="btn btn-primary mb-3">Edit Profile</router-link> -->
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-12">
                    <div class="tab-content" id="profile-tabs">
                        <div class="tab-pane show active p-0 border-0" id="profile-about-tab-pane" role="tabpanel" aria-labelledby="profile-about-tab" tabindex="0">
                            <div class="row">                          
                                        <SpkReusableAnlyticsCard :analyticData="penilaian" />
                                        <div class="col-xl-12">
                                            <div class="card custom-card">
                                                <div class="card-header d-flex align-items-center justify-content-between">
                                                    <div class="card-title">
                                                        PIC Perusahaan
                                                    </div>
                                                    <router-link to="/pages/profile-settings" class="btn btn-warning d-flex align-items-start gap-2"><i class="ri-add-line"></i><span>Add PIC</span></router-link>
                                                </div>
                                                <div class="card-body">
                                                    <div class="row g-5">
                                                        <div class="col-xxl-3 col-xl-4 col-lg-6 col-md-6 col-sm-12" v-for="(idx, index) in ProfileData.FriendsList" :key="index">
                                                            <div class="card custom-card h-100 d-flex align-items-center">
                                                                <div class="card-body p-4 text-center">
                                                                    <div class="dropdown profile-friends-actions">
                                                                        <a aria-label="anchor" href="javascript:void(0);" class="btn btn-icon rounded-circle border btn-light" data-bs-toggle="dropdown" aria-expanded="false">
                                                                            <i class="ri-more-2-fill"></i>
                                                                        </a>
                                                                        <ul class="dropdown-menu">
                                                                            <li><a class="dropdown-item" href="javascript:void(0);"><i class="ri-edit-line me-2"></i>Edit</a></li>
                                                                            <li><a class="dropdown-item" href="javascript:void(0);"><i class="ri-delete-bin-line me-2"></i>Delete</a></li>
                                                                        </ul>
                                                                    </div>
                                                                    <div class="lh-1 mb-2">
                                                                        <span class="avatar avatar-xxl avatar-rounded">
                                                                            <img :src="idx.imgSrc" alt="">
                                                                        </span>
                                                                    </div>
                                                                    <div class="mb-2">
                                                                        <span class="d-block fw-semibold">{{ idx.name }}</span>
                                                                        <span class="text-muted fs-13"><i class="ri-phone-line align-middle fs-15"></i>{{ idx.telepon }}</span>
                                                                    </div>
                                                                    <!-- <div class="btn-list">
                                                                        <button class="btn btn-icon btn-facebook btn-wave rounded-circle waves-effect waves-light">
                                                                            <i class="ri-facebook-line"></i>
                                                                        </button>
                                                                        <button class="btn btn-icon btn-twitter btn-wave rounded-circle waves-effect waves-light">
                                                                            <i class="ri-twitter-x-line"></i>
                                                                        </button>
                                                                        <button class="btn btn-icon btn-instagram btn-wave rounded-circle waves-effect waves-light">
                                                                            <i class="ri-instagram-line"></i>
                                                                        </button>
                                                                    </div> -->
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-xl-12">
                                            <div class="card custom-card">
                                                <div class="card-header">
                                                    <div class="card-title">
                                                        Tentang Perusahaan
                                                    </div>
                                                </div>
                                                <div class="card-body">
                                                    <p class="text-muted">Informasi lengkap tentang {{ currentStakeholder.nama_perusahaan }}, perusahaan yang bergerak di bidang {{ currentStakeholder.sektor }}.</p>
                                                    <div class="text-muted">
                                                        <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                            <span class="avatar avatar-sm avatar-rounded text-default">
                                                                <i class="ri-mail-line align-middle fs-15"></i>
                                                            </span>
                                                            <span class="fw-medium text-default">Email : </span>
                                                            {{ currentStakeholder.email }}
                                                        </div>
                                                        <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                            <span class="avatar avatar-sm avatar-rounded text-default">
                                                                <i class="ri-phone-line align-middle fs-15"></i>
                                                            </span>
                                                            <span class="fw-medium text-default">Telepon : </span>
                                                            {{ currentStakeholder.telepon }}
                                                        </div>
                                                        <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                            <span class="avatar avatar-sm avatar-rounded text-default">
                                                                <i class="ri-map-pin-line align-middle fs-15"></i>
                                                            </span>
                                                            <span class="fw-medium text-default">Website : </span>
                                                            <a :href="currentStakeholder.website" target="_blank">{{ currentStakeholder.website }}</a>
                                                        </div>
                                                        <div class="mb-0 d-flex align-items-center gap-1">
                                                            <span class="avatar avatar-sm avatar-rounded text-default">
                                                                <i class="ri-building-line align-middle fs-15"></i>
                                                            </span>
                                                            <span class="fw-medium text-default">Lokasi : </span>
                                                            {{ currentStakeholder.alamat }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>    
                            </div>
                        </div>
                        <div class="tab-pane p-0 border-0" id="gallery-tab-pane" role="tabpanel" aria-labelledby="gallery-tab" tabindex="0">
                            <!-- <ProfileGallery /> -->
                        </div>
                        <div class="tab-pane p-0 border-0" id="followers-tab-pane" role="tabpanel" aria-labelledby="followers-tab" tabindex="0">
                            <div class="row">
                                <div class="col-xl-4" v-for="(idx, index) in ProfileData.Profiles" :key="index">
                                    <div class="card custom-card">
                                        <div class="card-body">
                                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                                <div class="lh-1">
                                                    <span class="avatar avatar-lg avatar-rounded">
                                                        <img :src="idx.imgSrc" alt="">
                                                    </span>
                                                </div>
                                                <div class="flex-fill">
                                                    <span class="fw-semibold d-block">{{ idx.name }}</span>
                                                    <span class="text-muted fs-13">{{ idx.mail }}</span>
                                                </div>
                                                <div>
                                                    <button :class="`btn btn-${idx.color}-ghost`"><i :class="`ri-user-${idx.icon}-line me-1`"></i>{{
                                                            idx.followers }}</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tab-pane p-0 border-0" id="friends-tab-pane" role="tabpanel" aria-labelledby="friends-tab" tabindex="0">
                            <div class="row">
                                <div class="col-xxl-3 col-xl-4 col-lg-6" v-for="(idx, index) in ProfileData.FriendsList" :key="index">
                                    <div class="card custom-card">
                                        <div class="card-body p-4 text-center">
                                            <div class="dropdown profile-friends-actions">
                                                <a aria-label="anchor" href="javascript:void(0);" class="btn btn-icon rounded-circle border btn-light" data-bs-toggle="dropdown" aria-expanded="false">
                                                    <i class="ri-more-2-fill"></i>
                                                </a>
                                                <ul class="dropdown-menu">
                                                    <li><a class="dropdown-item" href="javascript:void(0);"><i class="ri-edit-line me-2"></i>Edit</a></li>
                                                    <li><a class="dropdown-item" href="javascript:void(0);"><i class="ri-delete-bin-line me-2"></i>Delete</a></li>
                                                </ul>
                                            </div>
                                            <div class="lh-1 mb-2">
                                                <span class="avatar avatar-xxl avatar-rounded">
                                                    <img :src="idx.imgSrc" alt="">
                                                </span>
                                            </div>
                                            <div class="mb-3">
                                                <span class="d-block fw-semibold">{{ idx.name }}</span>
                                                <span class="text-muted fs-13">{{ idx.mail }}</span>
                                            </div>
                                            <div class="btn-list">
                                                <button class="btn btn-icon btn-facebook btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-facebook-line"></i>
                                                </button>
                                                <button class="btn btn-icon btn-twitter btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-twitter-x-line"></i>
                                                </button>
                                                <button class="btn btn-icon btn-instagram btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-instagram-line"></i>
                                                </button>
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
<!-- End:: row-1 -->
</template>

<style scoped>
/* Add your styles here */
</style>
