<script setup>
// Import Vue FilePond
import vueFilePond from 'vue-filepond'

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

const dataToPass = {
    title: "Pages",
    currentpage: "Profile Stakeholders",
    activepage: "Profile Stakeholders",
}
let myFiles = []
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
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card profile-card">
                    <div class="profile-banner-image">
                        <img src="/images/media/Gemini_Generated_Image_k641ivk641ivk641.png" class="card-img-top" alt="...">
                    </div>
                    <div class="card-body p-4 pb-0 position-relative">
                        <div class="d-flex align-items-end justify-content-between flex-wrap">
                            <div class="profile-avatar-container">
                                <!-- <span class="avatar avatar-xxl avatar-rounded bg-info profile-avatar-large">
                                        <img src="/images/faces/12.jpg" alt="">
                                    </span> -->
                                <div class="mt-4 mb-3 d-flex align-items-center flex-wrap gap-3 justify-content-between">
                                    <div>
                                        <h1 class="fw-semibold" style="margin-top: -1.75rem !important;">Nama Perusahaan</h1>
                                        <span class="d-block fw-medium text-muted mb-1">Bergerak Pada Bidang</span>
                                        <p class="fs-12 mb-0 fw-medium text-muted"> <span class="me-3"><i class="ri-building-line me-1 align-middle"></i>Lokasi</span>
                                            <span class="me-3"><i class="ri-phone-line me-1 align-middle"></i>+1 (123)456-7890</span>
                                            <span><i class="ri-mail-line me-1 align-middle"></i>mail@perusahaan</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-12">
                <div class="tab-content" id="profile-tabs">
                    <div class="tab-pane show active p-0 border-0" id="profile-about-tab-pane" role="tabpanel" aria-labelledby="profile-about-tab" tabindex="0">
                        <div class="row">                          
                                    <SpkReusableAnlyticsCard :analyticData=indexPenilaian.indexPenilaian />
                                    <div class="col-xl-12">
                                        <!--  -->
                                    </div>
                                    <div class="col-xl-12">
                                        <div class="card custom-card">
                                            <div class="card-header">
                                                <div class="card-title">
                                                    About
                                                </div>
                                            </div>
                                            <div class="card-body">
                                                <p class="text-muted">Experienced pereson passionate about
                                                    delivering
                                                    user-centered solutions, leading cross-functional teams, and
                                                    driving
                                                    product success.</p>
                                                <div class="text-muted">
                                                    <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                        <span class="avatar avatar-sm avatar-rounded text-default">
                                                            <i class="ri-mail-line align-middle fs-15"></i>
                                                        </span>
                                                        <span class="fw-medium text-default">Email : </span>
                                                        your.email@example.com
                                                    </div>
                                                    <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                        <span class="avatar avatar-sm avatar-rounded text-default">
                                                            <i class="ri-phone-line align-middle fs-15"></i>
                                                        </span>
                                                        <span class="fw-medium text-default">Phone : </span> +1
                                                        (555)
                                                        123-4567
                                                    </div>
                                                    <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                        <span class="avatar avatar-sm avatar-rounded text-default">
                                                            <i class="ri-map-pin-line align-middle fs-15"></i>
                                                        </span>
                                                        <span class="fw-medium text-default">Website : </span>
                                                        www.yourwebsite.com
                                                    </div>
                                                    <div class="mb-0 d-flex align-items-center gap-1">
                                                        <span class="avatar avatar-sm avatar-rounded text-default">
                                                            <i class="ri-building-line align-middle fs-15"></i>
                                                        </span>
                                                        <span class="fw-medium text-default">Location : </span>
                                                        City,
                                                        Country
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
    </div>
</div>
<!-- End:: row-1 -->
</template>

<style scoped>
/* Add your styles here */
</style>
