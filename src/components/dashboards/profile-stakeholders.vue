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

/* Avatar Container */
/* .profile-avatar-container {
    position: relative;
    margin-top: -80px; 
} */

/* Avatar Large - Desktop */
.profile-avatar-large {
    width: 160px !important;
    height: 160px !important;
    border: 6px solid white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
}

.profile-avatar-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
}

/* Hover effect */
.profile-avatar-large:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
}

/* Responsive - Tablet (768px - 991px) */
@media (max-width: 991px) {
    .profile-banner-image {
        height: 220px;
    }

    /* .profile-avatar-container {
        margin-top: -60px;
    } */

    .profile-avatar-large {
        width: 130px !important;
        height: 130px !important;
        border: 5px solid white;
    }
}

/* Responsive - Mobile (576px - 767px) */
@media (max-width: 767px) {
    .profile-banner-image {
        height: 180px;
    }

    /* .profile-avatar-container {
        margin-top: -50px;
    } */

    .profile-avatar-large {
        width: 110px !important;
        height: 110px !important;
        border: 4px solid white;
    }
}

/* Responsive - Small Mobile (< 576px) */
@media (max-width: 575px) {
    .profile-banner-image {
        height: 150px;
    }

    /* .profile-avatar-container {
        margin-top: -45px;
    }
     */
    .profile-avatar-large {
        width: 90px !important;
        height: 90px !important;
        border: 3px solid white;
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
                            <div class="col-xxl-4">
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
                                    <div class="col-xl-12">
                                        <!-- <div class="card custom-card overflow-hidden">
                                                <div class="card-header">
                                                    <div class="card-title">
                                                        Social Media
                                                    </div>
                                                </div>
                                                <div class="card-body p-0">
                                                    <ul class="list-group list-group-flush social-media-list">
                                                        <li class="list-group-item">
                                                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                                                <div>
                                                                    <span
                                                                        class="avatar avatar-md bg-primary-transparent"><i
                                                                            class="ri-facebook-circle-fill fs-4"></i></span>
                                                                </div>
                                                                <div>
                                                                    <span class="d-block fw-medium">Facebook</span>
                                                                    <a href="javascript:void(0);"
                                                                        class="text-muted">https://www.facebook.com/johndoe</a>
                                                                </div>
                                                            </div>
                                                        </li>
                                                        <li class="list-group-item">
                                                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                                                <div>
                                                                    <span
                                                                        class="avatar avatar-md bg-secondary-transparent"><i
                                                                            class="ri-twitter-x-fill fs-4"></i></span>
                                                                </div>
                                                                <div>
                                                                    <span class="d-block fw-medium">Twitter</span>
                                                                    <a href="javascript:void(0);"
                                                                        class="text-muted">https://twitter.com/johndoe</a>
                                                                </div>
                                                            </div>
                                                        </li>
                                                        <li class="list-group-item">
                                                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                                                <div>
                                                                    <span
                                                                        class="avatar avatar-md bg-success-transparent"><i
                                                                            class="ri-linkedin-box-fill fs-4"></i></span>
                                                                </div>
                                                                <div>
                                                                    <span class="d-block fw-medium">Linkedin</span>
                                                                    <a href="javascript:void(0);"
                                                                        class="text-muted">https://www.linkedin.com/in/johndoe</a>
                                                                </div>
                                                            </div>
                                                        </li>
                                                        <li class="list-group-item">
                                                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                                                <div>
                                                                    <span
                                                                        class="avatar avatar-md bg-orange-transparent"><i
                                                                            class="ri-instagram-fill fs-4"></i></span>
                                                                </div>
                                                                <div>
                                                                    <span class="d-block fw-medium">Instagram</span>
                                                                    <a href="javascript:void(0);"
                                                                        class="text-muted">https://www.instagram.com/johndoe</a>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div> -->
                                    </div>
                                </div>
                            </div>
                            <div class="col-xxl-8">
                                <!-- <div class="card custom-card">
                                        <div class="card-header p-0">
                                            <ul class="nav nav-tabs tab-style-8 scaleX justify-content-end" id="myTab4"
                                                role="tablist">
                                                <li class="nav-item" role="presentation">
                                                    <button class="nav-link active" id="status-tab" data-bs-toggle="tab"
                                                        data-bs-target="#status-tab-pane" type="button" role="tab"
                                                        aria-controls="status-tab-pane" aria-selected="true"><i
                                                            class="ri-radio-button-line lh-1 me-1"></i>Status</button>
                                                </li>
                                                <li class="nav-item" role="presentation">
                                                    <button class="nav-link" id="media-tab" data-bs-toggle="tab"
                                                        data-bs-target="#media-tab-pane" type="button" role="tab"
                                                        aria-controls="media-tab-pane" aria-selected="false"
                                                        tabindex="-1"><i
                                                            class="ri-video-line lh-1 me-1"></i>Image/Video</button>
                                                </li>
                                                <li class="nav-item" role="presentation">
                                                    <button class="nav-link" id="live-stream-tab" data-bs-toggle="tab"
                                                        data-bs-target="#live-stream-tab-pane" type="button" role="tab"
                                                        aria-controls="live-stream-tab-pane" aria-selected="false"
                                                        tabindex="-1"><i class="ri-tv-line lh-1 me-1"></i>Live
                                                        Stream</button>
                                                </li>
                                            </ul>
                                        </div>
                                        <div class="card-body">
                                            <div class="tab-content" id="myTabContent3">
                                                <div class="tab-pane show active overflow-hidden p-0 border-0"
                                                    id="status-tab-pane" role="tabpanel" aria-labelledby="status-tab"
                                                    tabindex="0">
                                                    <textarea class="form-control" id="text-area" rows="4"
                                                        placeholder="What's on your mind?"></textarea>
                                                    <div class="mt-2">
                                                        <button class="btn btn-primary float-end">Post <i
                                                                class="ri-send-plane-2-line ms-1"></i></button>
                                                    </div>
                                                </div>
                                                <div class="tab-pane overflow-hidden border-0 p-0" id="media-tab-pane"
                                                    role="tabpanel" aria-labelledby="media-tab" tabindex="0">
                                                    <textarea class="form-control mb-3" id="text-area" rows="2"
                                                        placeholder="What's on your mind?"></textarea>
                                                    <file-pond name="test" ref="pond"
                                                        label-idle="Drag & Drop files here or <span class='filepond--label-action'>Browse</span>"
                                                        allow-multiple="false" max-files="1"
                                                        accepted-file-types="image/jpeg, image/png"
                                                        v-bind:files="myFiles" />
                                                    <div class="mt-2">
                                                        <button class="btn btn-success float-end">Upload <i
                                                                class="ri-upload-2-line ms-1"></i></button>
                                                    </div>
                                                </div>
                                                <div class="tab-pane overflow-hidden border-0 p-0"
                                                    id="live-stream-tab-pane" role="tabpanel"
                                                    aria-labelledby="live-stream-tab" tabindex="0">
                                                    <textarea class="form-control" id="text-area" rows="4"
                                                        placeholder="What's on your mind?"></textarea>
                                                    <div class="mt-2">
                                                        <button class="btn btn-warning float-end">Start Streaming <i
                                                                class="ri-tv-2-line ms-1"></i></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div> -->
                                <!-- <div class="card custom-card">
                                        <div class="card-body">
                                            <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                                                <div class="lh-1">
                                                    <span class="avatar avatar-rounded avatar-md">
                                                        <img src="/images/faces/12.jpg" alt="">
                                                    </span>
                                                </div>
                                                <div class="flex-fill">
                                                    <span class="d-block fw-semibold">Tom Phillip</span>
                                                    <span class="text-muted fs-13">14 hrs ago</span>
                                                </div>
                                                <div class="dropdown">
                                                    <a aria-label="anchor" href="javascript:void(0);"
                                                        class="btn btn-icon rounded-circle border btn-light"
                                                        data-bs-toggle="dropdown" aria-expanded="false">
                                                        <i class="ri-more-2-fill"></i>
                                                    </a>
                                                    <ul class="dropdown-menu">
                                                        <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                                    class="ri-edit-line me-2"></i>Edit</a></li>
                                                        <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                                    class="ri-delete-bin-line me-2"></i>Delete</a></li>
                                                    </ul>
                                                </div>
                                            </div>
                                            <div class="my-3">Captured the serene beauty of the blue sky as the sun
                                                sets.
                                            </div>
                                            <div>
                                                <img src="/images/media/media-23.jpg" class="card-img" alt="...">
                                            </div>
                                        </div>
                                        <div class="card-footer">
                                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                                <div class="avatar-list-stacked">
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/2.jpg" alt="img">
                                                    </span>
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/8.jpg" alt="img">
                                                    </span>
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/2.jpg" alt="img">
                                                    </span>
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/10.jpg" alt="img">
                                                    </span>
                                                </div>
                                                <div class="flex-fill">
                                                    and 8 others <i class="ri-heart-3-fill text-danger"></i> this post
                                                </div>
                                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                                    <a href="javascript:void(0);"
                                                        class="p-1 px-2 bg-primary-transparent rounded"><i
                                                            class="ri-message-3-line me-1"></i>Comment</a>
                                                    <a href="javascript:void(0);"
                                                        class="p-1 px-2 bg-info-transparent rounded"><i
                                                            class="ri-share-forward-line me-1"></i>Share</a>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="card-footer">
                                            <ul class="list-unstyled post-comments-list">
                                                <li>
                                                    <div class="d-flex align-items-start gap-3">
                                                        <div class="lh-1">
                                                            <span class="avatar avatar-md avatar-rounded">
                                                                <img src="/images/faces/4.jpg" alt="">
                                                            </span>
                                                        </div>
                                                        <div class="flex-fill p-3 rounded bg-light">
                                                            <div
                                                                class="d-flex align-items-center justify-content-between flex-wrap">
                                                                <div class="fw-semibold">Emily_Smith</div>
                                                                <div class="text-muted fs-13">2 hours ago</div>
                                                            </div>
                                                            <div class="text-muted">
                                                                Wow, what a peaceful view! Nature at its best &#x1F60D;.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li>
                                                    <div class="d-flex align-items-start gap-3">
                                                        <div class="lh-1">
                                                            <span class="avatar avatar-md avatar-rounded">
                                                                <img src="/images/faces/14.jpg" alt="">
                                                            </span>
                                                        </div>
                                                        <div class="flex-fill p-3 rounded bg-light">
                                                            <div
                                                                class="d-flex align-items-center justify-content-between flex-wrap">
                                                                <div class="fw-semibold">JohnDoe</div>
                                                                <div class="text-muted fs-13">1 hours ago</div>
                                                            </div>
                                                            <div class="text-muted">
                                                                Absolutely stunning! The colors are just perfect
                                                                &#x1F305;&#x1F499;.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li>
                                                    <div class="d-flex align-items-center lh-1 flex-wrap">
                                                        <div class="me-3">
                                                            <span class="avatar avatar-md avatar-rounded">
                                                                <img src="/images/faces/12.jpg" alt="">
                                                            </span>
                                                        </div>
                                                        <div class="flex-fill">
                                                            <div class="input-group">
                                                                <input type="text" class="form-control"
                                                                    placeholder="Write a comment" aria-label="comment">
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i
                                                                        class="bi bi-emoji-smile"></i></button>
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i
                                                                        class="bi bi-paperclip"></i></button>
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i class="bi bi-camera"></i></button>
                                                                <button class="btn btn-primary"
                                                                    type="button">Post</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    </div> -->
                                <!-- <div class="card custom-card">
                                        <div class="card-body">
                                            <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                                                <div class="lh-1">
                                                    <span class="avatar avatar-rounded avatar-md">
                                                        <img src="/images/faces/12.jpg" alt="">
                                                    </span>
                                                </div>
                                                <div class="flex-fill">
                                                    <span class="d-block fw-semibold">Tom Phillip</span>
                                                    <span class="text-muted fs-13">2 days ago</span>
                                                </div>
                                                <div class="dropdown">
                                                    <a aria-label="anchor" href="javascript:void(0);"
                                                        class="btn btn-icon rounded-circle border btn-light"
                                                        data-bs-toggle="dropdown" aria-expanded="false">
                                                        <i class="ri-more-2-fill"></i>
                                                    </a>
                                                    <ul class="dropdown-menu">
                                                        <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                                    class="ri-edit-line me-2"></i>Edit</a></li>
                                                        <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                                    class="ri-delete-bin-line me-2"></i>Delete</a></li>
                                                    </ul>
                                                </div>
                                            </div>
                                            <div class="my-3">Success is not final, failure is not fatal: It is the
                                                courage
                                                to continue that counts. Keep pushing forward! <a
                                                    href="javascript:void(0);">&#128170; #MotivationMonday</a></div>
                                        </div>
                                        <div class="card-footer">
                                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                                <div class="avatar-list-stacked">
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/12.jpg" alt="img">
                                                    </span>
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/3.jpg" alt="img">
                                                    </span>
                                                    <span class="avatar avatar-rounded">
                                                        <img src="/images/faces/15.jpg" alt="img">
                                                    </span>
                                                </div>
                                                <div class="flex-fill">
                                                    and 2 others <i class="ri-heart-3-fill text-danger"></i> this post
                                                </div>
                                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                                    <a href="javascript:void(0);"
                                                        class="p-1 px-2 bg-primary-transparent rounded"><i
                                                            class="ri-message-3-line me-1"></i>Comment</a>
                                                    <a href="javascript:void(0);"
                                                        class="p-1 px-2 bg-info-transparent rounded"><i
                                                            class="ri-share-forward-line me-1"></i>Share</a>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="card-footer">
                                            <ul class="list-unstyled post-comments-list">
                                                <li>
                                                    <div class="d-flex align-items-center lh-1 flex-wrap">
                                                        <div class="me-3">
                                                            <span class="avatar avatar-md avatar-rounded">
                                                                <img src="/images/faces/12.jpg" alt="">
                                                            </span>
                                                        </div>
                                                        <div class="flex-fill">
                                                            <div class="input-group">
                                                                <input type="text" class="form-control"
                                                                    placeholder="Write a comment" aria-label="comment">
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i
                                                                        class="bi bi-emoji-smile"></i></button>
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i
                                                                        class="bi bi-paperclip"></i></button>
                                                                <button class="btn btn-light border px-2 px-sm-3"
                                                                    type="button"><i class="bi bi-camera"></i></button>
                                                                <button class="btn btn-primary"
                                                                    type="button">Post</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    </div> -->
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
