<template>
  <header
    ref="headerRoot"
    class="app-header sticky sb-header"
    :class="{ 'is-dark-header': isDarkTheme }"
    id="header"
  >
    <!-- Start::main-header-container -->
    <div class="main-header-container container-fluid">
      <!-- Start::header-content-left -->
      <div class="header-content-left">

        <!-- Start::header-element -->
        <div class="header-element mx-lg-0 mx-2 sb-menu-element">
          <a
            aria-label="Hide Sidebar"
            @click="ToggleMenu"
            class="sidemenu-toggle header-link animated-arrow hor-toggle horizontal-navtoggle"
            data-bs-toggle="sidebar"
            href="javascript:void(0);"
            ><span></span
          ></a>
        </div>
        <!-- End::header-element -->

        <div class="header-element">
            <div class="horizontal-logo">
                  <router-link :to="dashboardPath" class="header-logo">
                    <img src="/images/brand-logos/logoLight.svg" alt="logo" id="logo-desktop"      class="sb2-logo-full" />
                    <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-desktop-dark" class="sb2-logo-full" />
                    <img src="/images/brand-logos/logoD4.svg"   alt="logo" id="logo-toggle"       class="sb2-logo-mini" />
                    <img src="/images/brand-logos/logoD4.svg"   alt="logo" id="logo-toggle-dark"  class="sb2-logo-mini" />
                  </router-link>
            </div>
        </div>

        <div class="header-element header-search d-md-block d-none">
          <div class="autoComplete_wrapper">
            <!-- Start::header-link -->
            <input
              type="text"
              class="header-search-bar form-control bg-white"
              id="header-search"
              :value="search"
              @input="handleToChange"
              placeholder="Search"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
            />
            <template v-if="showSuggestions">
              <div
                class="custom-card card w-100 search-result position-absolute z-index-9 search-fix border mt-1"
              >
                <div class="card-header">
                  <div class="card-title mb-0 text-break">
                    Search result of {{ search }}
                  </div>
                </div>
                <div class="card-body overflow-auto">
                  <div
                    class="list-group custom-header"
                    id="autoComplete_list_1"
                  >
                    <template v-if="uniqueSuggestions.length > 0">
                      <li
                        id="autoComplete_result_0"
                        class="list-group-item li-Class"
                        v-for="(e, index) in uniqueSuggestions.slice(0, 7)"
                        :key="index"
                      >
                        <router-link
                          :to="`${e.path}/`"
                          class="search-result-item"
                          @click="handleSuggestionClick(e.title)"
                        >
                          {{ e.title }}
                        </router-link>
                      </li>
                    </template>
                    <template v-else>
                      <b class="text-danger"
                        >There is no component with this name</b
                      >
                    </template>
                  </div>
                </div>
              </div>
            </template>
            <a href="javascript:void(0);" class="header-search-icon border-0">
              <i class="bi bi-search fs-12 mb-1"></i>
            </a>
            <!-- End::header-link -->
          </div>
        </div>
      </div>
      <!-- End::header-content-left -->

      <!-- Start::header-content-right -->
      <ul class="header-content-right align-items-center">
        <!-- Start::header-element -->
        <li class="header-element d-md-none d-block">
          <a
            href="javascript:void(0);"
            class="header-link d-flex align-items-center"
            data-bs-toggle="modal"
            data-bs-target="#header-responsive-search"
          >
            <div class="d-flex align-items-center mt-2">
              <!-- Start::header-link-icon -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="header-link-icon"
                viewBox="0 0 256 256"
              >
                <rect width="256" height="256" fill="none" />
                <circle cx="112" cy="112" r="80" opacity="0.2" />
                <circle
                  cx="112"
                  cy="112"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="16"
                />
                <line
                  x1="168.57"
                  y1="168.57"
                  x2="224"
                  y2="224"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="16"
                />
              </svg>
              <!-- End::header-link-icon -->
            </div>
          </a>
        </li>
        <!-- End::header-element -->

        <li class="header-element sb-action-item theme-toggle-item">
          <button
            type="button"
            class="header-link sb-action-link theme-toggle-btn"
            :class="{ 'is-dark': isDarkTheme }"
            aria-label="Toggle theme"
            @click="toggleTheme"
          >
            <!-- Sky background layers -->
            <span class="theme-toggle-track"></span>
            <span class="theme-toggle-stars-layer" aria-hidden="true">
              <svg viewBox="0 0 110 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="stars-svg">
                <!-- Sparkle stars (4-point) -->
                <path d="M22 9l1.2 3 3 1.2-3 1.2L22 17.4l-1.2-3-3-1.2 3-1.2z" fill="rgba(255,255,255,0.95)"/>
                <path d="M38 7l0.8 2 2 0.8-2 0.8L38 12.6l-0.8-2-2-0.8 2-0.8z" fill="rgba(255,255,255,0.8)"/>
                <path d="M55 15l0.6 1.5 1.5 0.6-1.5 0.6L55 19.2l-0.6-1.5-1.5-0.6 1.5-0.6z" fill="rgba(255,255,255,0.7)"/>
                <path d="M30 24l0.5 1.2 1.2 0.5-1.2 0.5L30 27.4l-0.5-1.2-1.2-0.5 1.2-0.5z" fill="rgba(255,255,255,0.6)"/>
                <path d="M48 28l0.4 1 1 0.4-1 0.4L48 30.8l-0.4-1-1-0.4 1-0.4z" fill="rgba(255,255,255,0.55)"/>
                <!-- Tiny dots -->
                <circle cx="18" cy="18" r="0.7" fill="rgba(255,255,255,0.55)"/>
                <circle cx="42" cy="22" r="0.6" fill="rgba(255,255,255,0.45)"/>
                <circle cx="34" cy="12" r="0.5" fill="rgba(255,255,255,0.5)"/>
                <circle cx="50" cy="10" r="0.4" fill="rgba(255,255,255,0.4)"/>
                <circle cx="26" cy="30" r="0.5" fill="rgba(255,255,255,0.35)"/>
              </svg>
            </span>

            <!-- Thumb: Sun / Moon -->
            <span class="theme-toggle-thumb" aria-hidden="true">
              <!-- Sun face -->
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="thumb-sun-svg">
                <defs>
                  <radialGradient id="sunGrad" cx="45%" cy="42%" r="50%">
                    <stop offset="0%" stop-color="#FFF176"/>
                    <stop offset="40%" stop-color="#FFE066"/>
                    <stop offset="75%" stop-color="#FFD600"/>
                    <stop offset="100%" stop-color="#F5A623"/>
                  </radialGradient>
                </defs>
                <circle cx="18" cy="18" r="14" fill="url(#sunGrad)"/>
                <circle cx="18" cy="18" r="13.2" fill="none" stroke="rgba(245,166,35,0.25)" stroke-width="0.5"/>
                <!-- Sun highlight -->
                <ellipse cx="14" cy="13" rx="4" ry="3" fill="rgba(255,255,255,0.18)" transform="rotate(-20 14 13)"/>
              </svg>
              <!-- Moon face -->
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="thumb-moon-svg">
                <defs>
                  <radialGradient id="moonGrad" cx="38%" cy="38%" r="55%">
                    <stop offset="0%" stop-color="#F0E8D4"/>
                    <stop offset="40%" stop-color="#DDD5BB"/>
                    <stop offset="100%" stop-color="#B8B098"/>
                  </radialGradient>
                </defs>
                <circle cx="18" cy="18" r="14" fill="url(#moonGrad)"/>
                <!-- Craters -->
                <circle cx="13" cy="13" r="3" fill="rgba(155,147,125,0.3)"/>
                <circle cx="21" cy="11" r="1.8" fill="rgba(155,147,125,0.22)"/>
                <circle cx="15" cy="22" r="2.4" fill="rgba(155,147,125,0.25)"/>
                <circle cx="23" cy="19" r="1.4" fill="rgba(155,147,125,0.18)"/>
                <circle cx="10" cy="18" r="1.1" fill="rgba(155,147,125,0.18)"/>
                <circle cx="19" cy="26" r="1" fill="rgba(155,147,125,0.15)"/>
                <!-- Rim highlight -->
                <circle cx="18" cy="18" r="13.2" fill="none" stroke="rgba(200,192,168,0.2)" stroke-width="0.5"/>
                <ellipse cx="13" cy="12" rx="5" ry="3.5" fill="rgba(255,255,255,0.08)" transform="rotate(-15 13 12)"/>
              </svg>
            </span>

            <!-- Clouds -->
            <span class="theme-toggle-clouds" aria-hidden="true">
              <svg viewBox="0 0 110 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="clouds-svg">
                <!-- Far cloud (softer) -->
                <ellipse cx="62" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.35)"/>
                <ellipse cx="70" cy="18" rx="7" ry="5" fill="rgba(255,255,255,0.3)"/>
                <!-- Main cloud cluster -->
                <ellipse cx="68" cy="28" rx="16" ry="9" fill="rgba(255,255,255,0.75)"/>
                <ellipse cx="76" cy="22" rx="12" ry="8" fill="rgba(255,255,255,0.85)"/>
                <ellipse cx="82" cy="26" rx="10" ry="7" fill="rgba(255,255,255,0.9)"/>
                <ellipse cx="72" cy="30" rx="14" ry="8" fill="rgba(255,255,255,0.92)"/>
                <!-- Front highlight -->
                <ellipse cx="78" cy="28" rx="11" ry="7" fill="rgba(255,255,255,0.95)"/>
              </svg>
            </span>
          </button>
        </li>

        <!-- Start::header-element (Admin & Staff) -->
        <li v-if="authStore.isAdmin" ref="notifDropdownRoot" class="header-element notifications-dropdown d-flex align-items-center dropdown sb-action-item">
          <!-- Start::header-link|dropdown-toggle -->
          <a
            href="javascript:void(0);"
            class="header-link dropdown-toggle d-flex align-items-center sb-action-link"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            id="messageDropdown"
            aria-expanded="false"
            @click="ensureNotificationsLoaded"
          >
            <div class="d-flex align-items-center header-action-icon-wrap">
              <i class="ri-notification-3-line"></i>
              <span v-if="notifStore.unreadCount > 0" class="header-count-badge">
                {{ notifStore.unreadCount > 99 ? '99+' : notifStore.unreadCount }}
              </span>
            </div>
          </a>
          <!-- End::header-link|dropdown-toggle -->
          <!-- Start::main-header-dropdown -->
          <div
            class="main-header-dropdown dropdown-menu dropdown-menu-end"
            data-popper-placement="none"
          >
            <div class="p-3 bg-primary text-fixed-white">
              <div class="d-flex align-items-center justify-content-between">
                <p class="mb-0 fs-16">Notifikasi <span v-if="notifStore.unreadCount > 0" class="badge bg-light text-primary ms-1">{{ notifStore.unreadCount }}</span></p>
                <a
                  href="javascript:void(0);"
                  class="badge bg-light text-default border"
                  @click="notifStore.markAllAsRead()"
                  >Tandai Dibaca</a
                >
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <PerfectScrollbar
              class="list-unstyled mb-0"
              id="header-notification-scroll"
              style="max-height: 400px; position: relative;"
            >
              <!-- Real-time events from store -->
              <template v-if="notifStore.recentForDropdown.length > 0">
                <li
                  class="dropdown-item position-relative"
                  v-for="evt in notifStore.recentForDropdown"
                  :key="evt.id"
                  :class="{ 'bg-primary-transparent': !evt.isRead }"
                  @click="!evt.isRead && notifStore.markAsRead(evt.id)"
                >
                  <div class="d-flex align-items-start gap-3">
                    <div class="lh-1">
                      <span class="avatar avatar-sm avatar-rounded"
                        :class="evt.type === 'created' ? 'bg-success-transparent' : evt.type === 'updated' ? 'bg-info-transparent' : 'bg-danger-transparent'">
                        <i :class="evt.type === 'created' ? 'ri-add-circle-line fs-16' : evt.type === 'updated' ? 'ri-edit-box-line fs-16' : 'ri-delete-bin-line fs-16'"></i>
                      </span>
                    </div>
                    <div class="flex-fill" style="min-width: 0;">
                      <span class="d-block fw-semibold fs-13" style="white-space: normal; line-height: 1.4;">
                        {{ evt.actorName }}
                        <span class="fw-normal text-muted">{{ evt.actionVerb }}</span>
                        {{ evt.targetLabel }}
                      </span>
                      <span class="d-block text-muted fs-12 mt-1" style="white-space: normal;">{{ evt.details }}</span>
                    </div>
                    <div class="text-end flex-shrink-0">
                      <span class="d-block mb-1 fs-11 text-muted">{{ evt.timeAgoStr }}</span>
                      <button
                        v-if="!evt.isRead"
                        type="button"
                        class="btn btn-sm btn-link p-0 text-primary text-decoration-none"
                        title="Tandai dibaca"
                        @click.stop="notifStore.markAsRead(evt.id)"
                      >
                        <i class="ri-check-line fs-6"></i>
                      </button>
                    </div>
                  </div>
                </li>
              </template>
            </PerfectScrollbar>
            <div v-if="notifStore.recentForDropdown.length === 0" class="p-5 text-center">
              <span class="avatar avatar-xl avatar-rounded bg-secondary-transparent">
                <i class="ri-notification-off-line fs-2"></i>
              </span>
              <h6 class="fw-medium mt-3">Tidak Ada Notifikasi</h6>
            </div>
            <div class="p-2 text-center border-top">
              <router-link
                to="/notif"
                class="text-primary fw-semibold fs-13 text-decoration-none d-block py-1"
              >
                Lihat Semua Notifikasi <i class="ri-arrow-right-s-line align-middle"></i>
              </router-link>
            </div>
          </div>
          <!-- End::main-header-dropdown -->
        </li>
        <!-- End::header-element -->

        <li v-if="authStore.isAdmin" ref="requestDropdownRoot" class="header-element request-notifications-dropdown d-flex align-items-center dropdown sb-action-item">
          <a
            href="javascript:void(0);"
            class="header-link dropdown-toggle d-flex align-items-center request-link sb-action-link"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            aria-expanded="false"
            @click="loadRequestEditCounts"
          >
            <div class="d-flex align-items-center request-trigger">
              <i class="ri-edit-2-line"></i>
              <span v-if="totalRequestEditCount > 0" class="request-total-badge">
                {{ totalRequestEditCount > 99 ? '99+' : totalRequestEditCount }}
              </span>
            </div>
          </a>
          <div
            ref="requestDropdownMenu"
            class="main-header-dropdown dropdown-menu dropdown-menu-end request-dropdown-menu"
            data-popper-placement="none"
          >
            <div class="p-3 bg-primary text-fixed-white">
              <div class="d-flex align-items-center justify-content-between">
                <p class="mb-0 fs-16">
                  Request Edit
                  <span v-if="totalRequestEditCount > 0" class="badge bg-light text-primary ms-1">{{ totalRequestEditCount }}</span>
                </p>
              </div>
              <div class="request-menu-subtitle">SE dan IKAS menunggu review</div>
            </div>
            <div class="dropdown-divider"></div>
            <div class="request-list">
              <router-link to="/kse-list-admin" class="dropdown-item request-list-item">
                <span class="avatar avatar-sm avatar-rounded bg-warning-transparent text-warning">
                  <i class="ri-server-line fs-16"></i>
                </span>
                <span class="flex-fill" style="min-width: 0;">
                  <span class="d-block fw-semibold fs-13">Request Edit SE</span>
                  <span class="d-block text-muted fs-12">Sistem Elektronik</span>
                </span>
                <span class="badge bg-warning-transparent text-warning">{{ requestEditCounts.se }}</span>
              </router-link>
              <router-link to="/ikas-list" class="dropdown-item request-list-item">
                <span class="avatar avatar-sm avatar-rounded bg-info-transparent text-info">
                  <i class="ri-shield-star-line fs-16"></i>
                </span>
                <span class="flex-fill" style="min-width: 0;">
                  <span class="d-block fw-semibold fs-13">Request Edit IKAS</span>
                  <span class="d-block text-muted fs-12">Maturity IKAS</span>
                </span>
                <span class="badge bg-info-transparent text-info">{{ requestEditCounts.ikas }}</span>
              </router-link>
            </div>
            <div class="p-2 text-center border-top">
              <router-link to="/kse-list-admin" class="text-primary fw-semibold fs-13 text-decoration-none d-block py-1">
                Lihat Antrean Review
                <i class="ri-arrow-right-s-line"></i>
              </router-link>
            </div>
          </div>
        </li>
        <!-- End::header-element -->

        <!-- Start::header-element -->
        <li class="header-element dropdown sb-profile-item" ref="profileDropdownRoot">
          <!-- Start::header-link|dropdown-toggle -->
          <a
            href="javascript:void(0);"
            class="header-link dropdown-toggle header-profile-trigger"
            id="mainHeaderProfile"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            aria-expanded="false"
          >
            <div class="d-flex align-items-center header-profile-trigger-inner">
              <div class="header-profile-avatar">
                <img :src="fotoProfileUrl" alt="img" class="avatar avatar-sm avatar-rounded" />
              </div>
              <div class="d-none d-sm-block text-start header-profile-meta">
                <p class="fw-semibold mb-0 lh-1 header-profile-name">{{ displayName }}</p>
                <span class="text-muted fs-12 lh-1 header-profile-email">{{ displayEmail }}</span>
              </div>
              <i class="ri-arrow-down-s-line d-none d-sm-inline-block ms-2 text-muted"></i>
            </div>
          </a>
          <!-- End::header-link|dropdown-toggle -->
          <div
            class="main-header-dropdown dropdown-menu pt-0 overflow-hidden header-profile-dropdown dropdown-menu-end"
            aria-labelledby="mainHeaderProfile"
          >
            <div class="p-3 bg-primary text-fixed-white">
              <div class="d-flex align-items-center justify-content-between">
                <p class="mb-0 fs-16">Profile</p>
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <div class="p-3">
              <div class="d-flex align-items-start gap-2">
                <div class="lh-1">
                  <span
                    class="avatar avatar-sm bg-primary-transparent avatar-rounded"
                  >
                    <img :src="fotoProfileUrl" alt="" />
                  </span>
                </div>
                <div>
                  <span class="d-block fw-semibold lh-1">{{
                    displayName
                  }}</span>
                  <span class="text-muted fs-12">{{ displayEmail }}</span>
                </div>
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <ul class="list-unstyled mb-0">
              <li>
                <ul class="list-unstyled mb-0 sub-list">
                  <li>
                    <router-link
                      class="dropdown-item d-flex align-items-center"
                      to="/profile"
                      ><i class="ti ti-user-circle me-2 fs-18"></i>View
                      Profile</router-link
                    >
                  </li>
                  <li>
                    <router-link
                      class="dropdown-item d-flex align-items-center"
                      to="/profile-settings"
                    >
                      <i class="ti ti-settings-cog me-2 fs-18"></i>Account
                      Settings
                    </router-link>
                  </li>
                </ul>
              </li>
              <li>
                <a
                  href="javascript:void(0);"
                  @click="handleLogout"
                  class="dropdown-item d-flex align-items-center"
                  ><i class="ti ti-logout me-2 fs-18"></i>Log Out</a
                >
              </li>
            </ul>
          </div>
        </li>
        <!-- End::header-element -->
      </ul>
      <!-- End::header-content-right -->
    </div>
    <!-- End::main-header-container -->
  </header>

  <div
    class="modal fade"
    id="header-responsive-search"
    tabindex="-1"
    aria-labelledby="header-responsive-search"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-body">
          <div class="input-group">
            <input
              type="text"
              class="form-control border-end-0"
              placeholder="Search Anything ..."
              :value="search"
              @input="handleToChange"
              aria-label="Search Anything ..."
              aria-describedby="button-addon2"
            />
            <template v-if="showSuggestions">
              <div
                class="custom-card card w-100 search-result position-absolute z-index-9 search-fix border mt-15"
              >
                <div class="card-header">
                  <div class="card-title mb-0 text-break">
                    Search result of
                    <b
                      ><u>{{ search }}</u></b
                    >
                  </div>
                </div>
                <div class="card-body overflow-auto">
                  <div class="m-2 list-group" id="autoComplete_list_1">
                    <template v-if="uniqueSuggestions.length > 0">
                      <li
                        id="autoComplete_result_0"
                        class="list-group-item"
                        v-for="(e, index) in uniqueSuggestions.slice(0, 7)"
                        :key="index"
                      >
                        <router-link
                          :to="`${e.path}/`"
                          class="search-result-item"
                          @click="handleSuggestionClick(e.title)"
                        >
                          {{ e.title }}
                        </router-link>
                      </li>
                    </template>
                    <template v-else>
                      <b class="text-danger"
                        >There is no component with this name</b
                      >
                    </template>
                  </div>
                </div>
              </div>
            </template>
            <button class="btn btn-primary" type="button" id="button-addon2">
              <i class="bi bi-search"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { Tooltip } from "bootstrap";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import "vue3-perfect-scrollbar/style.css";
import gsap from "gsap";
import { ikasService } from "@/services/ikas.service";
import { seEditService } from "@/services/se-edit.service";
import {
  Languages,
} from "../../../data/header";
import { switcherStore } from "../../../stores/switcher";
import { MENUITEMS } from "../../../data/sidebar/nav";
import { useAuthStore } from "../../../stores/auth";
import { useProfileStore } from "../../../stores/profile";
import { useNotificationStore } from "../../../stores/notifications";
import Quantity from "../../UI/quantity.vue";

// Stores
const switcher = switcherStore();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const notifStore = useNotificationStore();
const { logUserOut } = authStore;
const router = useRouter();
const requestEditCounts = ref({ se: 0, ikas: 0 });
const requestEditLoading = ref(false);
const requestDropdownRoot = ref<HTMLElement | null>(null);
const requestDropdownMenu = ref<HTMLElement | null>(null);
const notifDropdownRoot = ref<HTMLElement | null>(null);
const profileDropdownRoot = ref<HTMLElement | null>(null);
const headerRoot = ref<HTMLElement | null>(null);
let headerGsapContext: gsap.Context | null = null;

const ensureNotificationsLoaded = () => {
  if (authStore.authenticated && authStore.isAdmin) {
    notifStore.init();
    loadRequestEditCounts();
  }
};

const normalizeListResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  return [];
};

const isPendingRequest = (value: unknown): boolean => {
  return String(value || "").trim().toLowerCase() === "pending";
};

const loadRequestEditCounts = async () => {
  if (!authStore.authenticated || !authStore.isAdmin || requestEditLoading.value) return;

  requestEditLoading.value = true;
  try {
    const [seRequests, ikasRecords] = await Promise.all([
      seEditService.getRequests().catch(() => []),
      ikasService.getIkasList().catch(() => []),
    ]);

    const seList = normalizeListResponse(seRequests);
    const ikasList = normalizeListResponse(ikasRecords);

    requestEditCounts.value = {
      se: seList.filter((item: any) => isPendingRequest(item?.status)).length,
      ikas: ikasList.filter((item: any) => isPendingRequest(item?.edit_request_status || item?.editRequestStatus)).length,
    };
  } catch {
    requestEditCounts.value = { se: 0, ikas: 0 };
  } finally {
    requestEditLoading.value = false;
  }
};

const totalRequestEditCount = computed(() => requestEditCounts.value.se + requestEditCounts.value.ikas);
const handleRequestEditChanged = () => loadRequestEditCounts();
const animateDropdown = (event: Event) => {
  const root = event.currentTarget as HTMLElement;
  const menu = root.querySelector('.dropdown-menu');
  if (!menu) return;

  const targets = Array.from(menu.children).filter(el => !el.classList.contains('dropdown-divider'));

  gsap.killTweensOf([menu, ...targets]);
  gsap.fromTo(
    menu,
    { autoAlpha: 0, y: -4, scale: 0.98 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.15, ease: "power2.out" }
  );
  
  if (targets.length > 0) {
    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: 4 },
      { autoAlpha: 1, y: 0, duration: 0.12, stagger: 0.02, ease: "power2.out", delay: 0.02 }
    );
  }
};

const initHeaderMotion = () => {
  if (!headerRoot.value) return;

  headerGsapContext = gsap.context((self) => {
    const actions = self.selector?.(".header-action-icon-wrap, .request-trigger, .header-profile-trigger, .theme-toggle-btn, .sidemenu-toggle") || [];
    const searchInput = self.selector?.(".header-search-bar") || [];
    const searchIcon = self.selector?.(".header-search-icon") || [];

    gsap.from(actions, {
      autoAlpha: 0,
      y: -6,
      duration: 0.22,
      stagger: 0.035,
      ease: "power2.out",
    });

    actions.forEach((item) => {
      const el = item as HTMLElement;
      const lift = () => gsap.to(el, { y: -1, scale: 1.02, duration: 0.16, ease: "power2.out" });
      const settle = () => gsap.to(el, { y: 0, scale: 1, duration: 0.18, ease: "power2.out" });
      const tap = () => gsap.fromTo(el, { scale: 0.98 }, { scale: 1.02, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.out" });

      el.addEventListener("mouseenter", lift);
      el.addEventListener("mouseleave", settle);
      el.addEventListener("mousedown", tap);

      self.add(() => {
        el.removeEventListener("mouseenter", lift);
        el.removeEventListener("mouseleave", settle);
        el.removeEventListener("mousedown", tap);
      });
    });

    if (searchInput[0]) {
      const input = searchInput[0] as HTMLElement;
      const icon = searchIcon[0] as HTMLElement | undefined;
      const focus = () => {
        gsap.to(input, { boxShadow: "0 14px 34px rgba(15, 23, 42, 0.09)", borderColor: "rgba(59, 130, 246, 0.42)", duration: 0.16 });
        if (icon) gsap.to(icon, { x: 2, color: "#2563eb", duration: 0.16 });
      };
      const blur = () => {
        gsap.to(input, { boxShadow: "0 10px 28px rgba(15, 23, 42, 0.04)", borderColor: "rgba(148, 163, 184, 0.22)", duration: 0.18 });
        if (icon) gsap.to(icon, { x: 0, color: "#64748b", duration: 0.18 });
      };

      input.addEventListener("focus", focus);
      input.addEventListener("blur", blur);

      self.add(() => {
        input.removeEventListener("focus", focus);
        input.removeEventListener("blur", blur);
      });
    }
  }, headerRoot.value);
};

// Load profile data on mount - use switchUser to handle proper initialization
onMounted(() => {
  profileStore.switchUser();
  ensureNotificationsLoaded();
  window.addEventListener("se-requests-updated", handleRequestEditChanged);
  window.addEventListener("ikas-requests-updated", handleRequestEditChanged);
  requestDropdownRoot.value?.addEventListener("shown.bs.dropdown", animateDropdown);
  notifDropdownRoot.value?.addEventListener("shown.bs.dropdown", animateDropdown);
  profileDropdownRoot.value?.addEventListener("shown.bs.dropdown", animateDropdown);
  initHeaderMotion();
});

onUnmounted(() => {
  window.removeEventListener("se-requests-updated", handleRequestEditChanged);
  window.removeEventListener("ikas-requests-updated", handleRequestEditChanged);
  requestDropdownRoot.value?.removeEventListener("shown.bs.dropdown", animateDropdown);
  notifDropdownRoot.value?.removeEventListener("shown.bs.dropdown", animateDropdown);
  profileDropdownRoot.value?.removeEventListener("shown.bs.dropdown", animateDropdown);
  headerGsapContext?.revert();
  headerGsapContext = null;
});

// Disconnect notifications on logout. Loading is lazy, triggered when the dropdown opens.
watch(
  () => authStore.authenticated,
  (isAuth) => {
    if (!isAuth) {
      notifStore.disconnect();
      requestEditCounts.value = { se: 0, ikas: 0 };
      return;
    }
    ensureNotificationsLoaded();
  },
  { immediate: true }
);

watch(
  () => authStore.isAdmin,
  (isAdmin) => {
    if (isAdmin && authStore.authenticated) {
      ensureNotificationsLoaded();
    } else {
      requestEditCounts.value = { se: 0, ikas: 0 };
    }
  }
);

// Reactive profile data
const { fotoProfileUrl } = storeToRefs(profileStore);
const displayName = computed(() => profileStore.displayName);
const displayEmail = computed(() => profileStore.displayEmail);
const dashboardPath = computed(() => authStore.isAdmin ? '/dashboard' : '/dashboards');

// Refs
const isFullScreen = ref(false);
const search = ref("");
const showSuggestions = ref(false);
const currentTheme = ref(
  localStorage.getItem("vyzorcolortheme") ||
  document.documentElement.getAttribute("data-theme-mode") ||
  "light"
);
const isDarkTheme = computed(() => currentTheme.value === "dark");

// Functions
const colorthemeFn = (value: string) => {
  currentTheme.value = value;
  localStorage.setItem("vyzorcolortheme", value);
  localStorage.removeItem("vyzorbodyBgRGB"); // ❌ Fix: removeItem takes only one argument
  switcher.colorthemeFn(value);
};

const toggleTheme = () => {
  colorthemeFn(isDarkTheme.value ? "light" : "dark");
};

const handleLogout = async () => {
  notifStore.disconnect();
  await logUserOut();
  router.push("/");
};

const ToggleMenu = () => {
  const html = document.documentElement;

  if (window.innerWidth <= 992) {
    const dataToggled = html.getAttribute("data-toggled");
    html.setAttribute(
      "data-toggled",
      dataToggled === "open" ? "close" : "open"
    );
  } else {
    html.setAttribute("data-nav-style", "icon-click");

    const dataToggled = html.getAttribute("data-toggled");
    if (dataToggled === "icon-click-closed") {
      html.removeAttribute("data-toggled");
    } else {
      html.setAttribute("data-toggled", "icon-click-closed");

      // force hide all open dropdown
      document
        .querySelectorAll(".slide.open, .sub-slide.open")
        .forEach((el) => {
          el.classList.remove("open");
        });
      document
        .querySelectorAll(".slide-menu, .sub-slide-menu")
        .forEach((el) => {
          el.style.display = "none";
        });
    }
  }
};

const handleCartDelete = (id: number) => {
  notificationNotes.value = notificationNotes.value.filter(
    (item) => item.id !== id
  );
};

const dec = (event: Event) => {
  event.preventDefault();
  const input = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelector("input") as HTMLInputElement;
  if (input) {
    const unit = Number(input.value);
    if (unit > 1) {
      input.value = String(unit - 1);
    }
  }
};

const inc = (event: Event) => {
  event.preventDefault();
  const input = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelector("input") as HTMLInputElement;
  if (input) {
    input.value = String(Number(input.value) + 1);
  }
};

const handleClickOutside = () => {
  showSuggestions.value = false;
};

const handleToChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  search.value = target.value;
  showSuggestions.value = search.value.length > 0;
};

const handleSuggestionClick = (suggestionTitle: string) => {
  search.value = "";
  showSuggestions.value = false;
};

// Computed
const filterSuggestions = computed(() => {
  const getTitlesWithPaths = (
    menuItems: any[]
  ): { title: string; path: string }[] => {
    const titles: { title: string; path: string }[] = [];
    menuItems.forEach((item) => {
      if (item?.path) {
        titles.push({ title: item.title, path: item.path });
      }
      if (Array.isArray(item?.children)) {
        titles.push(...getTitlesWithPaths(item.children));
      }
    });
    return titles;
  };
  return getTitlesWithPaths(MENUITEMS);
});

const uniqueSuggestions = computed(() => {
  const searchLower = search.value.toLowerCase();
  const suggestions = filterSuggestions.value.filter((item) =>
    item.title.toLowerCase().includes(searchLower)
  );
  const uniqueTitles = Array.from(
    new Set(suggestions.map((item) => item.title.toLowerCase()))
  );
  return uniqueTitles.map(
    (title) => suggestions.find((item) => item.title.toLowerCase() === title)!
  );
});

// Tooltip lifecycle
let pop: Tooltip | null = null;
</script>

<style scoped>


.sb-header .main-header-container {
  position: relative;
  align-items: center;
  gap: 1rem;
  padding-inline: 1.35rem;
}



.sb-header .header-content-right {
  min-width: 0;
  position: relative;
  z-index: 2;
  gap: 0.45rem;
  align-items: center;
}

.sb-profile-item {
  margin-left: 0.15rem;
}

.theme-toggle-item {
  display: flex;
  align-items: center;
  margin-right: 0.15rem;
}

/* ─── Toggle Button (the pill container) ─── */
.theme-toggle-btn {
  position: relative;
  width: 5rem;
  height: 2.25rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  background: linear-gradient(160deg, #6BB5E0 0%, #4A9AD4 35%, #3D85C6 70%, #5BA3D9 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  box-shadow:
    inset 0 -2px 4px rgba(0, 0, 0, 0.08),
    inset 0 2px 4px rgba(255, 255, 255, 0.18),
    0 4px 12px rgba(15, 23, 42, 0.1);
  transition: background 0.55s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.55s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ─── Track (light sky background) ─── */
.theme-toggle-track {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    #5DADE2 0%,
    #74B9E8 25%,
    #87CEEB 50%,
    #A8D8EA 75%,
    #C5E4F3 100%
  );
  border-radius: 999px;
  opacity: 1;
  transition: opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ─── Stars layer (dark mode only) ─── */
.theme-toggle-stars-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 1;
}

.theme-toggle-stars-layer .stars-svg {
  width: 100%;
  height: 100%;
}

/* ─── Clouds layer (light mode) ─── */
.theme-toggle-clouds {
  position: absolute;
  inset: 0;
  opacity: 1;
  transition: opacity 0.4s ease 0.12s, transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  transform: translateX(0);
  z-index: 2;
}

.theme-toggle-clouds .clouds-svg {
  width: 100%;
  height: 100%;
}

/* ─── Thumb (circular knob) ─── */
.theme-toggle-thumb {
  position: absolute;
  width: 1.72rem;
  height: 1.72rem;
  top: 50%;
  left: 0.25rem;
  transform: translateY(-50%) translateX(0);
  border-radius: 50%;
  z-index: 4;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 8px rgba(245, 166, 35, 0.35),
    0 4px 14px rgba(255, 214, 0, 0.18);
}

.theme-toggle-thumb .thumb-sun-svg,
.theme-toggle-thumb .thumb-moon-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

/* Sun visible, moon hidden (light mode) */
.theme-toggle-thumb .thumb-sun-svg {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}
.theme-toggle-thumb .thumb-moon-svg {
  opacity: 0;
  transform: scale(0.5) rotate(-60deg);
}

/* ─── Hover / Active ─── */
.theme-toggle-btn:hover {
  border-color: rgba(59, 130, 246, 0.32);
  box-shadow:
    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
    inset 0 2px 4px rgba(255, 255, 255, 0.22),
    0 6px 18px rgba(15, 23, 42, 0.14);
}

.theme-toggle-btn:active .theme-toggle-thumb {
  transform: translateY(-50%) translateX(var(--thumb-x, 0px)) scale(0.9);
}

/* ─── ★ DARK MODE ─── */
.theme-toggle-btn.is-dark {
  --thumb-x: 2.75rem;
  background: linear-gradient(160deg, #0A1628 0%, #0F2240 35%, #152D4F 70%, #1A3460 100%);
  border-color: rgba(100, 160, 240, 0.15);
  box-shadow:
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.03),
    0 4px 12px rgba(0, 0, 0, 0.22);
}

.theme-toggle-btn.is-dark .theme-toggle-track {
  opacity: 0;
}

.theme-toggle-btn.is-dark .theme-toggle-stars-layer {
  opacity: 1;
}

.theme-toggle-btn.is-dark .theme-toggle-clouds {
  opacity: 0;
  transform: translateX(-18px);
  transition: opacity 0.3s ease, transform 0.45s ease;
}

.theme-toggle-btn.is-dark .theme-toggle-thumb {
  transform: translateY(-50%) translateX(2.75rem);
  box-shadow:
    0 2px 8px rgba(200, 190, 160, 0.25),
    0 4px 14px rgba(180, 170, 140, 0.15),
    0 0 10px rgba(230, 220, 190, 0.08);
}

/* Moon visible, sun hidden (dark mode) */
.theme-toggle-btn.is-dark .thumb-sun-svg {
  opacity: 0;
  transform: scale(0.5) rotate(60deg);
}
.theme-toggle-btn.is-dark .thumb-moon-svg {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}

.theme-toggle-btn.is-dark:hover {
  border-color: rgba(100, 160, 240, 0.28);
  box-shadow:
    inset 0 -2px 4px rgba(0, 0, 0, 0.32),
    inset 0 2px 4px rgba(255, 255, 255, 0.04),
    0 6px 18px rgba(0, 0, 0, 0.28);
}

.theme-toggle-btn.is-dark:active .theme-toggle-thumb {
  transform: translateY(-50%) translateX(2.75rem) scale(0.9);
}

/* ─── Stars twinkle animation ─── */
@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.theme-toggle-btn.is-dark .stars-svg path:nth-child(1) { animation: twinkle 3s ease-in-out infinite; }
.theme-toggle-btn.is-dark .stars-svg path:nth-child(2) { animation: twinkle 2.5s ease-in-out 0.5s infinite; }
.theme-toggle-btn.is-dark .stars-svg path:nth-child(3) { animation: twinkle 4s ease-in-out 1s infinite; }
.theme-toggle-btn.is-dark .stars-svg path:nth-child(4) { animation: twinkle 3.5s ease-in-out 0.8s infinite; }
.theme-toggle-btn.is-dark .stars-svg path:nth-child(5) { animation: twinkle 2.8s ease-in-out 1.2s infinite; }


.sb-header .main-header-dropdown {
  top: calc(100% + 0.6rem) !important;
  inset-block-start: calc(100% + 0.6rem) !important;
  transform: none !important;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
}

.notifications-dropdown > .main-header-dropdown {
  right: 0 !important;
  left: auto !important;
  width: min(21rem, calc(100vw - 1.5rem));
  overflow: hidden;
}

.sb-profile-item > .header-profile-dropdown {
  right: 0 !important;
  left: auto !important;
  min-width: 14rem;
  overflow: hidden;
}

.sb-header .header-element {
  align-items: center !important;
}

.sb-menu-element .header-link {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 12px;
  justify-content: center;
  color: #475569;
}

.sb-menu-element .header-link:hover {
  background: rgba(15, 23, 42, 0.04);
}

.header-search {
  position: static;
  z-index: auto;
  margin-top: 0.35rem !important;
  display: flex;
  align-items: center;
  transform: none;
}

.header-search .autoComplete_wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.header-search-bar {
  width: clamp(15rem, 24vw, 20rem) !important;
  height: 2.35rem;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  border-radius: 10px;
  background: transparent !important;
  box-shadow: none;
  color: #0f172a;
  font-size: 0.78rem;
  padding-inline: 0.85rem 2.45rem;
  margin-block: auto;
}

.header-search-bar::placeholder {
  color: #94a3b8;
}

.header-search-icon {
  top: 50% !important;
  right: 0.35rem !important;
  width: 2rem !important;
  height: 2rem !important;
  transform: translateY(-50%);
  color: #64748b;
  background: transparent !important;
  box-shadow: none !important;
}

.sb-action-link {
  padding: 0 !important;
}

.header-action-icon-wrap {
  position: relative;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  color: #475569;
  will-change: transform;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.header-action-icon-wrap i {
  font-size: 1.2rem;
}

.header-action-icon-wrap .header-link-icon {
  width: 1.9rem;
  height: 1.9rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.request-link {
  padding-inline: 0;
}

.header-count-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f43f5e;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 6px rgba(244, 63, 94, 0.3);
}

.request-trigger {
  position: relative;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  color: #475569;
  will-change: transform;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.notifications-dropdown .header-link:hover .header-action-icon-wrap,
.notifications-dropdown .header-link.show .header-action-icon-wrap {
  background: #ffffff;
  border-color: rgba(59, 130, 246, 0.32);
  color: #2563eb;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.12);
}

.request-notifications-dropdown .header-link:hover .request-trigger,
.request-notifications-dropdown .header-link.show .request-trigger {
  background: #ffffff;
  border-color: rgba(59, 130, 246, 0.32);
  color: #2563eb;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.12);
}

.notifications-dropdown .header-link:hover .header-action-icon-wrap .header-link-icon,
.request-notifications-dropdown .header-link:hover .request-trigger i {
  transform: scale(1.05);
}

.header-action-icon-wrap .header-link-icon,
.request-trigger i {
  transition: transform 0.18s ease, color 0.18s ease;
}

.header-profile-trigger {
  min-height: 36px;
  padding: 0.2rem 0.35rem 0.2rem 0.2rem !important;
  border: 1px solid transparent;
  border-radius: 12px;
  overflow: visible;
  will-change: transform;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.header-profile-trigger:hover,
.header-profile-trigger.show {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.header-profile-trigger-inner {
  gap: 0.5rem;
  height: 36px;
  min-width: 0;
  margin-top: 0 !important;
  overflow: visible;
}

.header-profile-avatar {
  flex: 0 0 auto;
  overflow: visible;
}

.header-profile-avatar .avatar {
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
  object-fit: cover;
  overflow: hidden;
}

.header-profile-avatar .avatar img {
  display: block;
  object-fit: cover;
}

.header-profile-meta {
  min-width: 0;
  max-width: 12rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.18rem;
}

.header-profile-name,
.header-profile-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-profile-name {
  color: #0f172a;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2 !important;
}

.header-profile-email {
  max-width: 100%;
  color: #64748b !important;
  font-size: 0.65rem !important;
  line-height: 1.2 !important;
}

.sb-header.is-dark-header .header-profile-trigger {
  background: rgba(15, 23, 42, 0.16);
  border-color: transparent;
}

.sb-header.is-dark-header .header-profile-trigger:hover,
.sb-header.is-dark-header .header-profile-trigger.show {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(148, 163, 184, 0.16);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
}

.sb-header.is-dark-header .header-profile-avatar .avatar {
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 10px 22px rgba(0, 0, 0, 0.28);
}

.sb-header.is-dark-header .header-profile-name {
  color: #e5edf8;
}

.sb-header.is-dark-header .header-profile-email {
  color: #9fb0c7 !important;
}

.sb-header.is-dark-header .header-profile-trigger .ri-arrow-down-s-line {
  color: #9fb0c7 !important;
}

.sb-header.is-dark-header .header-action-icon-wrap,
.sb-header.is-dark-header .request-trigger {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(148, 163, 184, 0.18);
  color: #dbeafe;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.sb-header.is-dark-header .notifications-dropdown .header-link:hover .header-action-icon-wrap,
.sb-header.is-dark-header .notifications-dropdown .header-link.show .header-action-icon-wrap,
.sb-header.is-dark-header .request-notifications-dropdown .header-link:hover .request-trigger,
.sb-header.is-dark-header .request-notifications-dropdown .header-link.show .request-trigger {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.24), rgba(14, 165, 233, 0.16));
  border-color: rgba(96, 165, 250, 0.48);
  color: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 14px 30px rgba(0, 0, 0, 0.28);
}

.sb-header.is-dark-header .notifications-dropdown .header-link:hover .header-action-icon-wrap .header-link-icon,
.sb-header.is-dark-header .request-notifications-dropdown .header-link:hover .request-trigger i {
  color: #eff6ff;
}

.notifications-dropdown,
.request-notifications-dropdown {
  display: flex !important;
  align-items: center;
}

.notifications-dropdown .header-link,
.request-notifications-dropdown .header-link {
  height: 36px;
  padding-inline: 0;
  align-items: center !important;
}

.notifications-dropdown .header-action-icon-wrap,
.request-notifications-dropdown .request-trigger {
  margin-top: 0 !important;
}

.request-trigger i {
  font-size: 1.2rem;
}

.request-total-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f43f5e;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 6px rgba(244, 63, 94, 0.3);
}

.request-dropdown-menu {
  min-width: 320px;
  max-width: 360px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  transform-origin: top right;
  right: -56px !important;
  left: auto !important;
  inset-block-start: calc(100% + 8px) !important;
  transform: none !important;
  margin-top: 0 !important;
}

.request-dropdown-menu .border-top {
  border-color: rgba(148, 163, 184, 0.16) !important;
}

.request-list {
  padding: 8px;
  display: grid;
  gap: 8px;
}

.request-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #0f172a !important;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.request-list-item:hover {
  background: #fff;
  border-color: rgba(59, 130, 246, 0.22);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.request-list-item .fw-semibold {
  color: #0f172a;
}

.request-list-item .text-muted {
  color: #64748b !important;
}

.request-menu-subtitle {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}

.sb-header.is-dark-header .request-dropdown-menu {
  background: #101322;
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow: 0 22px 46px rgba(0, 0, 0, 0.36);
}

.sb-header.is-dark-header .request-dropdown-menu .dropdown-divider {
  border-color: rgba(148, 163, 184, 0.12);
}

.sb-header.is-dark-header .request-dropdown-menu .border-top {
  border-color: rgba(148, 163, 184, 0.12) !important;
}

.sb-header.is-dark-header .request-list {
  background: #101322;
}

.sb-header.is-dark-header .request-list-item {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(148, 163, 184, 0.12);
  color: #e5edf8 !important;
}

.sb-header.is-dark-header .request-list-item:hover {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
}

.sb-header.is-dark-header .request-list-item .fw-semibold {
  color: #f8fafc;
}

.sb-header.is-dark-header .request-list-item .text-muted {
  color: #9fb0c7 !important;
}

.sb-header.is-dark-header .request-dropdown-menu .text-primary {
  color: #60a5fa !important;
}

/* ═══════════════════════════════════════════════════════════
   DARK MODE — Notification Dropdown
   ═══════════════════════════════════════════════════════════ */

/* Dropdown container */
.sb-header.is-dark-header .notifications-dropdown > .main-header-dropdown {
  background: #0f1729;
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow: 0 22px 46px rgba(0, 0, 0, 0.4);
}

/* Dividers */
.sb-header.is-dark-header .notifications-dropdown .dropdown-divider {
  border-color: rgba(148, 163, 184, 0.1);
}

/* Notification items — base (read) */
.sb-header.is-dark-header .notifications-dropdown .dropdown-item {
  color: #cbd5e1;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

.sb-header.is-dark-header .notifications-dropdown .dropdown-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* Notification items — UNREAD */
.sb-header.is-dark-header .notifications-dropdown .dropdown-item.bg-primary-transparent {
  background: rgba(59, 130, 246, 0.1) !important;
  border-left: 3px solid rgba(96, 165, 250, 0.6);
}

.sb-header.is-dark-header .notifications-dropdown .dropdown-item.bg-primary-transparent:hover {
  background: rgba(59, 130, 246, 0.16) !important;
}

/* Text inside notifications */
.sb-header.is-dark-header .notifications-dropdown .dropdown-item .fw-semibold {
  color: #e8edf5;
}

.sb-header.is-dark-header .notifications-dropdown .dropdown-item .text-muted {
  color: #8899af !important;
}

/* Avatars inside notifications */
.sb-header.is-dark-header .notifications-dropdown .bg-success-transparent {
  background: rgba(34, 197, 94, 0.15) !important;
  color: #4ade80 !important;
}

.sb-header.is-dark-header .notifications-dropdown .bg-info-transparent {
  background: rgba(14, 165, 233, 0.15) !important;
  color: #38bdf8 !important;
}

.sb-header.is-dark-header .notifications-dropdown .bg-danger-transparent {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #f87171 !important;
}

/* Mark as read check button */
.sb-header.is-dark-header .notifications-dropdown .btn-link.text-primary {
  color: #60a5fa !important;
}

/* Empty state */
.sb-header.is-dark-header .notifications-dropdown .bg-secondary-transparent {
  background: rgba(148, 163, 184, 0.1) !important;
  color: #94a3b8 !important;
}

.sb-header.is-dark-header .notifications-dropdown h6 {
  color: #cbd5e1;
}

/* Footer link */
.sb-header.is-dark-header .notifications-dropdown .border-top {
  border-color: rgba(148, 163, 184, 0.1) !important;
}

.sb-header.is-dark-header .notifications-dropdown .text-primary {
  color: #60a5fa !important;
}

/* Badge count in header */
.sb-header.is-dark-header .header-count-badge,
.sb-header.is-dark-header .request-total-badge {
  border-color: #0f1729;
}

</style>
