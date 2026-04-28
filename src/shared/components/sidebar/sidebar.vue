<template>
  <!-- Sidebar Overlay -->
  <div id="responsive-overlay" @click="mainContentFn"></div>

  <aside class="app-sidebar sticky sidebar-v2" id="sidebar">

    <!-- Video background -->
    <video class="sb2-bg-video" autoplay muted loop playsinline>
      <source src="/video/BG2.webm" type="video/webm" />
    </video>

    <!-- Decorative background orbs -->
    <div class="sb2-orb sb2-orb-1" aria-hidden="true"></div>
    <div class="sb2-orb sb2-orb-2" aria-hidden="true"></div>
    <div class="sb2-orb sb2-orb-3" aria-hidden="true"></div>

    <!-- ── Logo Header ── -->
    <div class="main-sidebar-header sb2-header">
      <router-link :to="dashboardRoute" class="header-logo sb2-logo-link">
        <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-desktop"      class="sb2-logo-full" />
        <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-desktop-dark" class="sb2-logo-full" />
        <img src="/images/brand-logos/logoD4.svg"   alt="logo" id="logo-toggle"       class="sb2-logo-mini" />
        <img src="/images/brand-logos/logoD4.svg"   alt="logo" id="logo-toggle-dark"  class="sb2-logo-mini" />
      </router-link>
    </div>

    <!-- ── Scrollable Menu ── -->
    <div class="main-sidebar sb2-scroll" id="sidebar-scroll">
      <nav class="main-menu-container nav nav-pills flex-column sub-open">

        <div class="slide-left" id="slide-left" @click="leftArrowFn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 24 24">
            <path d="M13.293 6.293 7.586 12l5.707 5.707 1.414-1.414L10.414 12l4.293-4.293z"/>
          </svg>
        </div>

        <ul class="main-menu sb2-menu">
          <li
            v-for="(mainmenuItem, index) in menuData"
            :key="index"
            :class="[
              mainmenuItem?.menutitle ? 'sb2-category-li' : '',
              mainmenuItem?.type === 'link'  ? 'slide' : '',
              mainmenuItem?.type === 'empty' ? 'slide' : '',
              mainmenuItem?.type === 'sub'   ? 'slide has-sub' : '',
              mainmenuItem?.active   ? 'open'   : '',
              mainmenuItem?.selected ? 'active' : '',
            ]"
          >
            <!-- Category title -->
            <template v-if="mainmenuItem?.menutitle">
              <div class="sb2-category">
                <span class="sb2-category-text">{{ mainmenuItem.menutitle }}</span>
                <span class="sb2-category-rule"></span>
              </div>
            </template>

            <!-- Direct link -->
            <template v-if="mainmenuItem?.type === 'link'">
              <router-link
                :to="mainmenuItem.path"
                class="side-menu__item sb2-item"
                :class="mainmenuItem.selected ? 'active' : ''"
                @click="mainContentFn"
              >
                <span class="sb2-item-indicator" aria-hidden="true"></span>
                <span class="sb2-icon-wrap" v-if="mainmenuItem.icon" v-html="mainmenuItem.icon"></span>
                <span class="side-menu__label sb2-label">
                  {{ mainmenuItem.title }}
                  <span v-if="mainmenuItem.badgetxt" v-html="mainmenuItem.badgetxt"></span>
                </span>
              </router-link>
            </template>

            <!-- Empty / placeholder link -->
            <template v-if="mainmenuItem?.type === 'empty'">
              <a href="javascript:;" class="side-menu__item sb2-item">
                <span class="sb2-item-indicator" aria-hidden="true"></span>
                <span class="sb2-icon-wrap" v-if="mainmenuItem.icon" v-html="mainmenuItem.icon"></span>
                <span class="side-menu__label sb2-label">
                  {{ mainmenuItem.title }}
                  <span v-if="mainmenuItem.badgetxt" v-html="mainmenuItem.badgetxt"></span>
                </span>
              </a>
            </template>

            <!-- Sub-menu -->
            <template v-if="mainmenuItem?.type === 'sub'">
              <a href="javascript:;" class="side-menu__item sb2-item" @click="toggleSubmenu($event, mainmenuItem)">
                <span class="sb2-item-indicator" aria-hidden="true"></span>
                <span class="sb2-icon-wrap" v-if="mainmenuItem.icon" v-html="mainmenuItem.icon"></span>
                <span class="side-menu__label sb2-label">
                  {{ mainmenuItem.title }}
                  <span v-if="mainmenuItem.badgetxt" v-html="mainmenuItem.badgetxt"></span>
                </span>
                <i class="ri-arrow-right-s-line side-menu__angle" :class="mainmenuItem.active ? 'horizontal-arrow' : ''"></i>
              </a>
              <ul v-if="mainmenuItem.children && mainmenuItem.children.length > 0" class="slide-menu child1" :class="mainmenuItem.active ? 'doublemenu_slide-menu open' : 'doublemenu_slide-menu'">
                <li
                  v-for="(child, cIndex) in mainmenuItem.children"
                  :key="cIndex"
                  :class="{ 'active': child.selected }"
                >
                  <router-link
                    :to="child.path"
                    class="side-menu__item"
                    :class="{ 'active': child.selected }"
                  >
                    <span class="side-menu__label">{{ child.title }}</span>
                  </router-link>
                </li>
              </ul>
            </template>
          </li>
        </ul>
      </nav>
    </div>

    <!-- ── AI Assistant Footer ── -->
    <div class="sidebar-chatbot-footer sb2-footer">
      <a href="javascript:void(0);" class="sb2-ai-btn" @click="toggleChat">
        <span class="sb2-ai-glow" aria-hidden="true"></span>
        <span class="sb2-ai-icon">
          <i class="ti ti-message-chatbot"></i>
        </span>
        <span class="sb2-ai-body">
          <span class="sb2-ai-label">AI Assistant</span>
          <span class="sb2-ai-sub">Tanya apa saja &bull; Powered by AI</span>
        </span>
        <span class="sb2-ai-arrow">
          <i class="ti ti-chevron-right"></i>
        </span>
      </a>
    </div>

    <Teleport to="body">
      <ChatModal :isOpen="isChatOpen" @close="isChatOpen = false" />
    </Teleport>

  </aside>
</template>

<script setup>
import {
  onBeforeMount,
  onMounted,
  reactive,
  ref,
  watchEffect,
  computed,
  onUnmounted,
} from "vue";
import { MENUITEMS as staticMenuData } from "../../../data/sidebar/nav.ts";
import { useRoute, useRouter } from "vue-router";
// import { PerfectScrollbar } from "vue3-perfect-scrollbar";
// import "vue3-perfect-scrollbar/style.css";
import media80 from "/images/media/media-80.png";
import { switcherStore } from "../../../stores/switcher";
import { useAuthStore } from "../../../stores/auth";
import RecursiveMenu from "../../UI/recursiveMenu.vue";
import ChatModal from "../chatbot/ChatModal.vue";

const authStore = useAuthStore();

// Filter menu based on user role
const filterMenuByRole = (items) => {
  const role = authStore.currentUser?.role;
  return items
    .filter((item) => {
      // If item has requiredRole, check access
      if (item.requiredRole) {
        if (item.requiredRole === 'fullAdmin') {
          // Only pure admin (not staff) can see these
          if (role !== 'admin') return false;
        } else if (item.requiredRole === 'admin') {
          // Both admin and staff can see these
          if (role !== 'admin' && role !== 'staff') return false;
        } else if (item.requiredRole === 'user') {
          // Only regular users can see these
          if (role !== item.requiredRole) return false;
        } else {
          // Generic role check
          if (role !== item.requiredRole) return false;
        }
      }
      // Check if item is hidden
      if (item.hidden) {
        return false;
      }
      return true;
    })
    .map((item) => {
      // Recursively filter children
      if (item.children) {
        return { ...item, children: filterMenuByRole(item.children) };
      }
      return item;
    });
};

const menuData = reactive(filterMenuByRole(staticMenuData));

// Watch for auth changes and update menu
watchEffect(() => {
  const filteredItems = filterMenuByRole(staticMenuData);
  menuData.length = 0;
  filteredItems.forEach((item) => menuData.push(item));
});

let level = 0;
let isChild = false;
let setMenu = false;
let hasParent = false;
let hasParentLevel = 0;
let WindowPreSize = [window.innerWidth];
const previousUrl = ref("/");

const router = useRouter();
const route = useRoute();

const isChatOpen = ref(false);

let observer = null;
let toggledObserver = null;

// Computed property for dynamic dashboard route based on user role
const dashboardRoute = computed(() => {
  return authStore.isAdmin ? '/dashboard' : '/dashboards';
});

const toggleChat = () => {
  isChatOpen.value = !isChatOpen.value;
};

function toggleSubmenu(
  event,
  targetObject,
  menuList = menuData,
  isChildFlag = isChild
) {
  let html = document.documentElement;
  if (
    html.getAttribute("data-vertical-style") === "doublemenu" &&
    html.getAttribute("data-toggled") === "double-menu-close"
  )
    return;
  let element = event.target;
  if (
    (html.getAttribute("data-nav-style") == "icon-hover" &&
      html.getAttribute("data-toggled") == "icon-hover-closed") ||
    (html.getAttribute("data-toggled") == "menu-hover-closed" &&
      html.getAttribute("data-nav-style") == "menu-hover")
  ) {
    return;
  }
  for (const item of menuList) {
    if (item === targetObject) {
      if (html.getAttribute("data-vertical-style") == "doublemenu") {
        if (isChildFlag) {
          item.active = !item.active;
        } else {
          item.active = !item.active;
        }
      } else {
        item.active = !item.active;
      }
      if (item.active) {
        closeOtherMenus(menuList, item);
        setAncestorsActive(menuData, item);
      }
    } else if (!item.active) {
      if (html.getAttribute("data-vertical-style") != "doublemenu") {
        item.active = false;
      }
    }
    if (item.children && item.children.length > 0) {
      toggleSubmenu(event, targetObject, item.children, true);
    }
  }
  if (targetObject?.children && targetObject.active) {
    if (
      html.getAttribute("data-vertical-style") == "doublemenu" &&
      html.getAttribute("data-toggled") != "open"
    ) {
      html.setAttribute("data-toggled", "double-menu-open");
    }
  }
  if (
    element &&
    html.getAttribute("data-nav-layout") == "horizontal" &&
    (html.getAttribute("data-nav-style") == "menu-click" ||
      html.getAttribute("data-nav-style") == "icon-click")
  ) {
    const listItem = element.closest("li");
    if (listItem) {
      // Find the first sibling <ul> element
      const siblingUL = listItem.querySelector("ul");
      let outterUlWidth = 0;
      let listItemUL = listItem.closest("ul:not(.main-menu)");
      while (listItemUL) {
        listItemUL = listItemUL.parentElement.closest("ul:not(.main-menu)");
        if (listItemUL) {
          outterUlWidth += listItemUL.clientWidth;
        }
      }
      if (siblingUL) {
        // You've found the sibling <ul> element
        let siblingULRect = listItem.getBoundingClientRect();
        if (html.getAttribute("dir") == "rtl") {
          if (
            siblingULRect.left - siblingULRect.width - outterUlWidth + 150 <
              0 &&
            outterUlWidth < window.innerWidth &&
            outterUlWidth + siblingULRect.width + siblingULRect.width <
              window.innerWidth
          ) {
            targetObject.dirchange = true;
          } else {
            targetObject.dirchange = false;
          }
        } else {
          if (
            outterUlWidth + siblingULRect.right + siblingULRect.width + 50 >
              window.innerWidth &&
            siblingULRect.right >= 0 &&
            outterUlWidth + siblingULRect.width + siblingULRect.width <
              window.innerWidth
          ) {
            targetObject.dirchange = true;
          } else {
            targetObject.dirchange = false;
          }
        }
      }
      // setTimeout(() => {
      //   let computedValue = siblingUL.getBoundingClientRect();
      //   if (computedValue.bottom > window.innerHeight) {
      //     siblingUL.style.height =
      //       window.innerHeight - computedValue.top - 8 + "px";
      //     siblingUL.style.overflow = "auto";
      //   }
      // }, 100);
    }
  }
}

function setAncestorsActive(menuData, targetObject, level) {
  let html = document.documentElement;
  const parent = findParent(menuData, targetObject);
  if (parent) {
    parent.active = true;
    if (parent.active) {
      html.setAttribute("data-toggled", "double-menu-open");
    }

    setAncestorsActive(menuData, parent, level);
  } else {
    if (
      html.getAttribute("data-vertical-style") == "doublemenu" &&
      level == 1
    ) {
      html.setAttribute("data-toggled", "double-menu-close");
    }
  }
}

function closeOtherMenus(menuData, targetObject) {
  for (const item of menuData) {
    if (item !== targetObject) {
      item.active = false;
      if (item.children && item.children.length > 0) {
        closeOtherMenus(item.children, targetObject);
      }
    }
  }
}

function findParent(menuData, targetObject) {
  for (const item of menuData) {
    if (item.children && item.children.includes(targetObject)) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const parent = findParent(item.children, targetObject);
      if (parent) {
        return parent;
      }
    }
  }
  return null;
}

function HoverToggleInnerMenuFn(event, item) {
  let html = document.documentElement;
  let element = event.target;
  if (
    element &&
    html.getAttribute("data-nav-layout") == "horizontal" &&
    (html.getAttribute("data-nav-style") == "menu-hover" ||
      html.getAttribute("data-nav-style") == "icon-hover")
  ) {
    const listItem = element.closest("li");
    if (listItem) {
      // Find the first sibling <ul> element
      const siblingUL = listItem.querySelector("ul");
      let outterUlWidth = 0;
      let listItemUL = listItem.closest("ul:not(.main-menu)");
      while (listItemUL) {
        listItemUL = listItemUL.parentElement.closest("ul:not(.main-menu)");
        if (listItemUL) {
          outterUlWidth += listItemUL.clientWidth;
        }
      }
      if (siblingUL) {
        // You've found the sibling <ul> element
        let siblingULRect = listItem.getBoundingClientRect();
        if (html.getAttribute("dir") == "rtl") {
          if (
            siblingULRect.left - siblingULRect.width - outterUlWidth + 150 <
              0 &&
            outterUlWidth < window.innerWidth &&
            outterUlWidth + siblingULRect.width + siblingULRect.width <
              window.innerWidth
          ) {
            item.dirchange = true;
          } else {
            item.dirchange = false;
          }
        } else {
          if (
            outterUlWidth + siblingULRect.right + siblingULRect.width + 50 >
              window.innerWidth &&
            siblingULRect.right >= 0 &&
            outterUlWidth + siblingULRect.width + siblingULRect.width <
              window.innerWidth
          ) {
            item.dirchange = true;
          } else {
            item.dirchange = false;
          }
        }
      }
    }
  }
}

function setSubmenu(event, targetObject, menuList = menuData) {
  let html = document.documentElement;
  if (
    html.getAttribute("data-nav-style") != "icon-hover" &&
    html.getAttribute("data-nav-style") != "menu-hover"
  ) {
    if (!event?.ctrlKey) {
      setMenu = true;
      for (const item of menuList) {
        if (item === targetObject) {
          item.active = true;
          item.selected = true;
          setMenuAncestorsActive(item);
        } else if (!item.active && !item.selected) {
          item.active = false;
          item.selected = false;
        } else {
          removeActiveOtherMenus(item);
        }
        if (item.children && item.children.length > 0) {
          setSubmenu(event, targetObject, item.children);
        }
      }
      setMenu = false;
    }
  }
}

function getParentObject(obj, childObject) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (
        typeof obj[key] === "object" &&
        JSON.stringify(obj[key]) === JSON.stringify(childObject)
      ) {
        return obj; // Return the parent object
      }
      if (typeof obj[key] === "object") {
        const parentObject = getParentObject(obj[key], childObject);
        if (parentObject !== null) {
          return parentObject;
        }
      }
    }
  }
  return null; // Object not found
}

function setMenuAncestorsActive(targetObject) {
  const parent = getParentObject(menuData, targetObject);
  let html = document.documentElement;
  if (parent) {
    if (hasParentLevel > 2) {
      hasParent = true;
    }
    parent.active = true;
    parent.selected = true;
    hasParentLevel += 1;
    setMenuAncestorsActive(parent);
  } else if (!hasParent) {
    // For single link items (no parent), just ensure they stay marked
    // For items with children (sub), close other top-level menus appropriately
    if (targetObject.children && targetObject.children.length > 0) {
      // This is a parent menu with children
      if (html.getAttribute("data-vertical-style") == "doublemenu") {
        html.setAttribute("data-toggled", "double-menu-close");
      }
    }
  }
}

function removeActiveOtherMenus(item) {
  if (item) {
    if (Array.isArray(item)) {
      for (const val of item) {
        val.active = false;
        val.selected = false;
      }
    }
    item.active = false;
    item.selected = false;

    if (item.children && item.children.length > 0) {
      removeActiveOtherMenus(item.children);
    }
  } else {
    return;
  }
}

function closeMenuFn() {
  const closeMenuRecursively = (items) => {
    items?.forEach((item) => {
      item.active = false;
      closeMenuRecursively(item.children);
    });
  };
  closeMenuRecursively(menuData);
}
const switcher = switcherStore();
const colorthemeFn = (value) => {
  localStorage.setItem("vyzorcolortheme", value),
    localStorage.removeItem("vyzorbodyBgRGB", value);
  switcher.colorthemeFn(value);
};

function menuResizeFn() {
  WindowPreSize.push(window.innerWidth);
  if (WindowPreSize.length > 2) {
    WindowPreSize.shift();
  }
  if (WindowPreSize.length > 1) {
    if (
      WindowPreSize[WindowPreSize.length - 1] < 992 &&
      WindowPreSize[WindowPreSize.length - 2] >= 992
    ) {
      // less than 992;
      let html = document.documentElement;
      html.setAttribute("data-toggled", "close");
    }

    if (
      WindowPreSize[WindowPreSize.length - 1] >= 992 &&
      WindowPreSize[WindowPreSize.length - 2] < 992
    ) {
      let html = document.documentElement;
      // greater than 992
      if (html.getAttribute("data-vertical-style") == "doublemenu") {
        html.setAttribute("data-toggled", "double-menu-open");
      } else {
        html.removeAttribute("data-toggled");
      }
    }
  }
}

function mainContentFn() {
  // Used to close the menu in Horizontal and small screen
  let html = document.documentElement;
  if (window.innerWidth < 992) {
    html.setAttribute("data-toggled", "close");
  } else if (
    html.getAttribute("data-nav-layout") == "horizontal" ||
    html.getAttribute("data-nav-style") == "menu-click" ||
    html.getAttribute("data-nav-style") == "icon-click"
  ) {
    closeMenuFn();
  }
}

function leftArrowFn() {
  let slideLeft = document.querySelector(".slide-left");
  let slideRight = document.querySelector(".slide-right");
  let menuNav = document.querySelector(".main-menu");
  let mainContainer1 = document.querySelector(".main-sidebar");
  
  if (!menuNav || !mainContainer1) return;

  let marginRightValue = Math.ceil(
    Number(window.getComputedStyle(menuNav).marginInlineStart.split("px")[0])
  );
  let mainContainer1Width = mainContainer1.offsetWidth;
  if (menuNav.scrollWidth > mainContainer1.offsetWidth) {
    if (
      marginRightValue < 0 &&
      !(Math.abs(marginRightValue) < mainContainer1Width)
    ) {
      menuNav.style.marginInlineStart =
        Number(menuNav.style.marginInlineStart.split("px")[0]) +
        Math.abs(mainContainer1Width) +
        "px";
      if (slideRight) slideRight.classList.remove("d-none");
    } else if (marginRightValue >= 0) {
      menuNav.style.marginInlineStart = "0px";
      if (slideLeft) slideLeft.classList.add("d-none");
      if (slideRight) slideRight.classList.remove("d-none");
    } else {
      menuNav.style.marginInlineStart = "0px";
      if (slideLeft) slideLeft.classList.add("d-none");
      if (slideRight) slideRight.classList.remove("d-none");
    }
  } else {
    menuNav.style.marginInlineStart = "0px";
    if (slideLeft) slideLeft.classList.add("d-none");
  }

  let element = document.querySelector(".main-menu > .slide.open");
  let element1 = document.querySelector(".main-menu > .slide.open >ul");
  if (element) {
    element.classList.remove("open");
  }
  if (element1) {
    element1.style.display = "none";
  }
}

function rightArrowFn() {
  let slideLeft = document.querySelector(".slide-left");
  let slideRight = document.querySelector(".slide-right");
  let menuNav = document.querySelector(".main-menu");
  let mainContainer1 = document.querySelector(".main-sidebar");
  
  if (!menuNav || !mainContainer1) return;

  let marginRightValue = Math.ceil(
    Number(window.getComputedStyle(menuNav).marginInlineStart.split("px")[0])
  );
  let check = menuNav.scrollWidth - mainContainer1.offsetWidth;
  let mainContainer1Width = mainContainer1.offsetWidth;

  if (menuNav.scrollWidth > mainContainer1.offsetWidth) {
    if (Math.abs(check) > Math.abs(marginRightValue)) {
      if (
        !(Math.abs(check) > Math.abs(marginRightValue) + mainContainer1Width)
      ) {
        mainContainer1Width = Math.abs(check) - Math.abs(marginRightValue);
        if (slideRight) slideRight.classList.add("d-none");
      }
      menuNav.style.marginInlineStart =
        Number(menuNav.style.marginInlineStart.split("px")[0]) -
        Math.abs(mainContainer1Width) +
        "px";
      if (slideLeft) slideLeft.classList.remove("d-none");
    }
  }

  let element = document.querySelector(".main-menu > .slide.open");
  let element1 = document.querySelector(".main-menu > .slide.open >ul");
  if (element) {
    element.classList.remove("open");
  }
  if (element1) {
    element1.style.display = "none";
  }
}

function checkHoriMenu() {
  let menuNav = document.querySelector(".main-sidebar");
  let mainMenu = document.querySelector(".main-menu");
  let slideLeft = document.querySelector(".slide-left");
  let slideRight = document.querySelector(".slide-right");

  // Show/Hide the arrows
  if (mainMenu && menuNav) {
    let marginRightValue = Math.ceil(
      Number(window.getComputedStyle(mainMenu).marginInlineStart.split("px")[0])
    );
    if (mainMenu.scrollWidth > menuNav.offsetWidth) {
      if (slideRight) slideRight.classList.remove("d-none");
      if (slideLeft) slideLeft.classList.add("d-none");
    } else {
      if (slideRight) slideRight.classList.add("d-none");
      if (slideLeft) slideLeft.classList.add("d-none");
      mainMenu.style.marginLeft = "0px";
      mainMenu.style.marginRight = "0px";
    }
    if (marginRightValue == 0) {
      if (slideLeft) slideLeft.classList.add("d-none");
    } else {
      if (slideLeft) slideLeft.classList.remove("d-none");
    }
  }
}

function handleAttributeChange(mutationsList) {
  for (const mutation of mutationsList) {
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "data-nav-layout"
    ) {
      const newValue = mutation.target.getAttribute("data-nav-layout");

      if (newValue === "vertical") {
        closeMenuFn();
        setMenuActiveByRoute();
      }

      if (newValue === "horizontal") {
        closeMenuFn();
        const mainMenu = document.querySelector(".main-menu");
        if (mainMenu) {
          mainMenu.style.marginInlineStart = "0px";
        }
      }
    }
  }
}
function setMenuActiveByRoute(items = menuData) {
  items.forEach((item) => {
    if (item.path === route.path) {
      item.active = true;
      item.selected = true;
      setMenuAncestorsActive(item);
    }
    if (item.children) {
      setMenuActiveByRoute(item.children);
    }
  });
}

function setMenuUsingUrl(currentPath) {
  hasParent = false;
  hasParentLevel = 1;

  const setSubmenuRecursively = (items) => {
    items?.forEach((item) => {
      if (!item.path) {
        if (item.children) {
          setSubmenuRecursively(item.children);
        }
        return;
      }
      const isExactMatch =
        currentPath === item.path ||
        currentPath === item.path + "/" ||
        item.path === currentPath + "/";

      const isChildMatch =
        item.children && currentPath.startsWith(item.path + "/");

      if (isExactMatch || (item.children && isChildMatch)) {
        setSubmenu(null, item);
      }

      if (item.children) {
        setSubmenuRecursively(item.children);
      }
    });
  };

  setSubmenuRecursively(menuData);
}

const preventpagejump = ref("");
let menuOverflowed = false;

function menuscrollFn() {
  let html = document.documentElement;
  let navLayout = html.getAttribute("data-nav-layout") == "horizontal";
  let menuPosition = html.getAttribute("data-menu-position") == "scrollable";
  let header = document.querySelector(".app-header")?.clientHeight || 0;
  window.onscroll = () => {
    if (
      !menuPosition &&
      preventpagejump.value &&
      preventpagejump.value.style &&
      navLayout &&
      window.innerWidth >= 992
    ) {
      if (window.scrollY > header) {
        preventpagejump.value.style.height = header + "px";
        menuOverflowed = true;
      } else {
        preventpagejump.value.style.height = 0 + "px";
        menuOverflowed = false;
      }
    }
  };
}

onMounted(() => {
  let currentUrl = route.path.endsWith("/")
    ? route.path.slice(0, -1)
    : route.path;
  setMenuUsingUrl(currentUrl);

  // Close menu based on html attribute
  const html = document.documentElement;
  const navLayout = html.getAttribute("data-nav-layout");
  const navStyle = html.getAttribute("data-nav-style");
  if (
    navLayout === "horizontal" ||
    navStyle === "menu-hover" ||
    navStyle === "icon-hover"
  ) {
    closeMenuFn();
  }
});

// Watch route changes reactively
watchEffect(() => {
  let currentPath = router.currentRoute.value.path || "/";

  if (currentPath.length > 1 && currentPath.endsWith("/")) {
    currentPath = currentPath.slice(0, -1);
  }

  if (currentPath !== previousUrl.value) {
    // Reset menu states before setting new active menu
    closeMenuFn();
    setMenuUsingUrl(currentPath);
    previousUrl.value = currentPath;
    // Close sidebar when navigating to widgets or dashboards (including sub-paths) to prevent overlap
   if (
      (currentPath.startsWith("/dashboards") || currentPath.startsWith("/widgets")) &&
      window.innerWidth < 768
    ) {
      document.documentElement.setAttribute("data-toggled", "close")
    }
  }
});

onMounted(() => {
  // Adding the menuResize after the component created.
  window.addEventListener("resize", menuResizeFn, {
    passive: true,
  });
  window.addEventListener("scroll", menuscrollFn, {
    passive: true,
  });
  let mainContent = document.querySelector(".main-content");
  // Adding the mainContentFn after the component created.
  if (mainContent) {
    mainContent.addEventListener("click", mainContentFn, {
      passive: true,
    });
  }
  // Used to check on mounting face to close the menu.
  if (window.innerWidth < 992) {
    document.documentElement.setAttribute("data-toggled", "close");
  } else if (
    document.documentElement.getAttribute("data-nav-layout") == "horizontal"
  ) {
    closeMenuFn();
  }

  // Select the target element
  const targetElement = document.documentElement;

  // Create a MutationObserver instance
  observer = new MutationObserver(handleAttributeChange);
  // Create a MutationObserver instance to watch data-toggled
  toggledObserver = new MutationObserver(handleToggledChange);
  toggledObserver.observe(targetElement, { attributes: true });

  function handleToggledChange(mutationsList) {
    for (const mutation of mutationsList) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "data-toggled"
      ) {
        const toggledValue = mutation.target.getAttribute("data-toggled");

        // Close all menus when sidebar collapsed (half)
        if (toggledValue === "double-menu-close" || toggledValue === "close") {
          closeMenuFn();
        }
      }
    }
  }

  // Configure the observer to watch for attribute changes
  const config = {
    attributes: true,
  };

  // Start observing the target element
  observer.observe(targetElement, config);
});

onUnmounted(() => {
  window.removeEventListener("resize", menuResizeFn);
  window.removeEventListener("scroll", menuscrollFn);
  
  let mainContent = document.querySelector(".main-content");
  if (mainContent) {
    mainContent.removeEventListener("click", mainContentFn);
  }

  if (observer) {
    observer.disconnect();
  }
  if (toggledObserver) {
    toggledObserver.disconnect();
  }
});
</script>

<!-- All sidebar-v2 styles live in src/assets/css/style2.css -->
