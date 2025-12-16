<script setup>
// Import Vue FilePond
import vueFilePond from 'vue-filepond'
import { useRoute } from 'vue-router'
import { computed, ref, onMounted } from 'vue'

// Import FilePond styles
import 'filepond/dist/filepond.min.css'

// Import image preview plugin styles
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css'

// Import image preview and file type validation plugins
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import * as ProfileData from "../../data/pages/profiledata";
import ProfileGallery from "../../shared/UI/profileGallery.vue";
import Pageheader from '../../shared/components/pageheader/pageheader.vue'

// Create component
const FilePond = vueFilePond(
    FilePondPluginFileValidateType,
    FilePondPluginImagePreview
)


const dataToPass = {
    //title: "Pages",
    currentpage: "Profile",
    activepage: "Profile"
}
let myFiles = []
</script>

<template>
    <Pageheader :propData="dataToPass" />
    <!-- Start:: row-1 -->
    <div class="row justify-content-center">
        <div class="col-xl-10">

            <div class="row">
                <div class="col-xl-12">
                    <div class="card custom-card profile-card">
                        <div class="profile-banner-image">
                            <img src="/images/media/media-3.jpg" class="card-img-top" alt="...">
                        </div>
                        <div class="card-body p-4 pb-0 position-relative">
                            <div class="d-flex align-items-end justify-content-between flex-wrap">
                                <div>
                                    <span class="avatar avatar-xxl avatar-rounded bg-info online">
                                        <img src="/images/faces/12.jpg" alt="">
                                    </span>
                                    <div
                                        class="mt-4 mb-3 d-flex align-items-center flex-wrap gap-3 justify-content-between">
                                        <div>
                                            <h5 class="fw-semibold mb-1">Tom Phillip</h5>
                                            <span class="d-block fw-medium text-muted mb-1">Senior Product
                                                Manager</span>
                                            <p class="fs-12 mb-0 fw-medium text-muted"> <span class="me-3"><i
                                                        class="ri-building-line me-1 align-middle"></i>New York,
                                                    USA</span>
                                                <span class="me-3"><i class="ri-phone-line me-2 align-middle"></i>+1 (123)
                                                    456-7890</span>
                                                    <span><i class="ri-mail-line me-1 align-middle"></i>tom@phillip"</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <ul class="nav nav-tabs mb-0 tab-style-8 scaleX" id="myTab" role="tablist">
                                        <li class="nav-item" role="presentation">
                                            <button class="nav-link active" id="profile-about-tab" data-bs-toggle="tab"
                                                data-bs-target="#profile-about-tab-pane" type="button" role="tab"
                                                aria-controls="profile-about-tab-pane"
                                                aria-selected="true">About</button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-12">
                    <div class="tab-content" id="profile-tabs">
                        <div class="tab-pane show active p-0 border-0" id="profile-about-tab-pane" role="tabpanel"
                            aria-labelledby="profile-about-tab" tabindex="0">
                            <div class="row">
                                <div class="col-xl-12">
                                    <div class="row">
                                        <!-- <div class="col-xl-12">
                                            <div class="card custom-card">
                                                <div class="card-body">
                                                    <div class="d-flex align-items-center justify-content-center gap-4">
                                                        <div class="text-center">
                                                            <h3 class="fw-semibold mb-1">
                                                                13,264
                                                            </h3>
                                                            <span class="d-block text-muted">Followers</span>
                                                        </div>
                                                        <div class="vr"></div>
                                                        <div class="text-center">
                                                            <h3 class="fw-semibold mb-1">
                                                                7,238
                                                            </h3>
                                                            <span class="d-block text-muted">Following</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div> -->
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
                                        <!--<div class="col-xl-12">
                                            <div class="card custom-card overflow-hidden">
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
                                            </div>
                                        </div> -->
                                    </div>
                                </div>
                                <div class="col-xxl-8">
                                </div>
                            </div>
                        </div>
                        <div class="tab-pane p-0 border-0" id="followers-tab-pane" role="tabpanel"
                            aria-labelledby="followers-tab" tabindex="0">
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
                                                    <button :class="`btn btn-${idx.color}-ghost`"><i
                                                            :class="`ri-user-${idx.icon}-line me-1`"></i>{{
                                                        idx.followers }}</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- <div class="tab-pane p-0 border-0" id="friends-tab-pane" role="tabpanel"
                            aria-labelledby="friends-tab" tabindex="0">
                            <div class="row">
                                <div class="col-xxl-3 col-xl-4 col-lg-6" v-for="(idx, index) in ProfileData.FriendsList"
                                    :key="index">
                                    <div class="card custom-card">
                                        <div class="card-body p-4 text-center">
                                            <div class="dropdown profile-friends-actions">
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
                                                <button
                                                    class="btn btn-icon btn-facebook btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-facebook-line"></i>
                                                </button>
                                                <button
                                                    class="btn btn-icon btn-twitter btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-twitter-x-line"></i>
                                                </button>
                                                <button
                                                    class="btn btn-icon btn-instagram btn-wave rounded-circle waves-effect waves-light">
                                                    <i class="ri-instagram-line"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>-->
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
