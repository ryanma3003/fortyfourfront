<template>
  <header class="app-header sticky" id="header">
    <!-- Start::main-header-container -->
    <div class="main-header-container container-fluid">
      <!-- Start::header-content-left -->
      <div class="header-content-left">

        <!-- Start::header-element -->
        <div class="header-element mx-lg-0 mx-2">
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

        <div class="header-element header-search d-md-block d-none mt-2">
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

        <!-- Start::header-element (Admin Only) -->
        <li v-if="authStore.isAdmin" class="header-element notifications-dropdown d-block dropdown">
          <!-- Start::header-link|dropdown-toggle -->
          <a
            href="javascript:void(0);"
            class="header-link dropdown-toggle d-flex align-items-center"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            id="messageDropdown"
            aria-expanded="false"
          >
            <div class="d-flex align-items-center mt-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="header-link-icon"
                viewBox="0 0 256 256"
              >
                <rect width="256" height="256" fill="none" />
                <path
                  d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z"
                  opacity="0.2"
                />
                <path
                  d="M96,192a32,32,0,0,0,64,0"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="16"
                />
                <path
                  d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="16"
                />
              </svg>
              <span v-if="notifStore.unreadCount > 0"
                class="header-icon-pulse bg-secondary rounded pulse pulse-secondary"
              ></span>
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
                        {{ evt.user?.name || 'Sistem' }}
                        <span class="fw-normal text-muted">{{ evt.type === 'created' ? 'menambahkan' : evt.type === 'updated' ? 'memperbarui' : 'menghapus' }}</span>
                        {{ evt.entity_name || evt.entity || 'data' }}
                      </span>
                      <span class="d-block text-muted fs-12 mt-1" style="white-space: normal;">{{ evt.message }}</span>
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

        <!-- Start::header-element -->
        <li class="header-element dropdown">
          <!-- Start::header-link|dropdown-toggle -->
          <a
            href="javascript:void(0);"
            class="header-link dropdown-toggle"
            id="mainHeaderProfile"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            aria-expanded="false"
          >
            <div class="d-flex align-items-center mt-2">
              <div class="me-sm-2 me-0">
                <img :src="fotoProfileUrl" alt="img" class="avatar avatar-sm avatar-rounded" />
              </div>
              <div class="d-none d-sm-block text-start">
                <p class="fw-semibold mb-1 lh-1">{{ displayName }}</p>
                <span class="text-muted fs-12 lh-1">{{ displayEmail }}</span>
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
                <ul class="list-unstyled mb-0 sub-list">
                  <!-- <li>
                    <a
                      class="dropdown-item d-flex align-items-center"
                      href="javascript:void(0);"
                      ><i class="ti ti-lifebuoy me-2 fs-18"></i>Support</a
                    >
                  </li>
                  <li>
                    <a
                      class="dropdown-item d-flex align-items-center"
                      href="javascript:void(0);"
                      ><i class="ti ti-bolt me-2 fs-18"></i>Activity Log</a
                    >
                  </li> -->
                  <!-- <li>
                    <a
                      class="dropdown-item d-flex align-items-center"
                      href="javascript:void(0);"
                      ><i class="ti ti-calendar me-2 fs-18"></i>Events</a
                    >
                  </li> -->
                  <li>
                    <a
                      href="javascript:void(0);"
                      class="dropdown-item d-flex align-items-center"
                    >
                      <!-- Light mode button -->
                      <span class="light-layout" @click="colorthemeFn('dark')">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="header-link-icons"
                          viewBox="0 0 256 256"
                        >
                          <rect width="256" height="256" fill="none" />
                          <path
                            d="M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z"
                            opacity="0"
                          />
                          <path
                            d="M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z"
                            fill="none"
                            stroke="black"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="20"
                          />
                        </svg>
                        <span class="theme-text">Light Mode</span>
                      </span>

                      <!-- Dark mode button -->
                      <span class="dark-layout" @click="colorthemeFn('light')">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="header-link-icons"
                          viewBox="0 0 256 256"
                        >
                          <rect width="256" height="256" fill="none" />
                          <circle cx="128" cy="128" r="56" opacity="0.2" />
                          <line
                            x1="128"
                            y1="40"
                            x2="128"
                            y2="32"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <circle
                            cx="128"
                            cy="128"
                            r="56"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="64"
                            y1="64"
                            x2="56"
                            y2="56"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="64"
                            y1="192"
                            x2="56"
                            y2="200"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="192"
                            y1="64"
                            x2="200"
                            y2="56"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="192"
                            y1="192"
                            x2="200"
                            y2="200"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="40"
                            y1="128"
                            x2="32"
                            y2="128"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="128"
                            y1="216"
                            x2="128"
                            y2="224"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                          <line
                            x1="216"
                            y1="128"
                            x2="224"
                            y2="128"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="16"
                          />
                        </svg>
                        <span class="theme-text">Dark Mode</span>
                      </span>
                    </a>
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

// Load profile data on mount - use switchUser to handle proper initialization
onMounted(() => {
  profileStore.switchUser();
  // Try init immediately if already authenticated
  if (authStore.authenticated) {
    notifStore.init();
  }
});

// Watch for authentication state changes and initialize store
watch(
  () => authStore.authenticated,
  (isAuth) => {
    if (isAuth) {
      notifStore.init();
    } else {
      notifStore.disconnect();
    }
  },
  { immediate: true }
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

// Functions
const colorthemeFn = (value: string) => {
  localStorage.setItem("vyzorcolortheme", value);
  localStorage.removeItem("vyzorbodyBgRGB"); // ❌ Fix: removeItem takes only one argument
  switcher.colorthemeFn(value);
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
