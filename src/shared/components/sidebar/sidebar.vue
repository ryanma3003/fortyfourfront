<template>
  <!-- Start::app-sidebar -->
  <div id="responsive-overlay" @click="mainContentFn"></div>
  <aside class="app-sidebar sticky" id="sidebar">
    <!-- Start::main-sidebar-header -->
    <div class="main-sidebar-header">
      <router-link :to="dashboardRoute" class="header-logo">
        <img
          src="/images/brand-logos/logoLight.svg"
          alt="logo"
          id="logo-desktop"
          style="height: 50px; width: auto"
        />
        <img
          src="/images/brand-logos/logoDark.svg"
          alt="logo"
          id="logo-desktop-dark"
          style="height: 50px; width: auto"
        />
        <img
          src="/images/brand-logos/logoD4.svg"
          alt="logo"
          id="logo-toggle"
          style="height: 50px; width: auto"
        />
        <img
          src="/images/brand-logos/logoD4.svg"
          alt="logo"
          id="logo-toggle-dark"
          style="height: 50px; width: auto"
        />
      </router-link>
    </div>
    <!-- End::main-sidebar-header -->

    <!-- Start::main-sidebar -->
    <PerfectScrollbar class="main-sidebar" id="sidebar-scroll">
      <!-- Start::nav -->
      <nav class="main-menu-container nav nav-pills flex-column sub-open">
        <div class="slide-left" id="slide-left" @click="leftArrowFn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="#7b8191"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path
              d="M13.293 6.293 7.586 12l5.707 5.707 1.414-1.414L10.414 12l4.293-4.293z"
            ></path>
          </svg>
        </div>
        <ul class="main-menu">
          <li
            v-for="(mainmenuItem, index) in menuData"
            :key="index"
            :class="`${mainmenuItem?.menutitle ? '' : ''} ${
              mainmenuItem?.type == 'link' ? 'slide' : ''
            } ${mainmenuItem?.type == 'empty' ? 'slide' : ''} ${
              mainmenuItem?.type == 'sub' ? 'slide has-sub' : ''
            } ${mainmenuItem?.active ? 'open' : ''} ${
              mainmenuItem?.selected ? 'active' : ''
            }`"
          >
            <template v-if="mainmenuItem?.menutitle">
              <span class="">{{ mainmenuItem.menutitle }}</span>
            </template>
            <template v-if="mainmenuItem?.type === 'link'">
              <router-link
                :to="mainmenuItem.path"
                class="side-menu__item"
                :class="`${mainmenuItem.selected ? 'active' : ''}`"
                @click="mainContentFn"
              >
                <span v-if="mainmenuItem.icon" v-html="mainmenuItem.icon">
                </span>
                <span class="side-menu__label"
                  >{{ mainmenuItem.title }}
                  <span
                    v-if="mainmenuItem.badgetxt"
                    v-html="mainmenuItem.badgetxt"
                  ></span>
                </span>
              </router-link>
            </template>
            <template v-if="mainmenuItem?.type === 'empty'">
              <a href="javascript:;" class="side-menu__item">
                <span v-if="mainmenuItem.icon" v-html="mainmenuItem.icon">
                </span>
                <span class="side-menu__label"
                  >{{ mainmenuItem.title }}
                  <span
                    v-if="mainmenuItem.badgetxt"
                    v-html="mainmenuItem.badgetxt"
                  ></span>
                </span>
              </a>
            </template>
            <template v-if="mainmenuItem?.type === 'sub'">
              <RecursiveMenu
                :menuData="mainmenuItem"
                :toggleSubmenu="toggleSubmenu"
                :HoverToggleInnerMenuFn="HoverToggleInnerMenuFn"
                :level="level + 1"
              />
            </template>
          </li>
          <!-- <li>
                    <ul class="slide-menu child1 doublemenu_slide-menu">
                        <li class="text-center p-3 text-fixed-white">
                            <div class="doublemenu_slide-menu-background">
                                <img src="/images/media/backgrounds/13.png" alt="">
                            </div>
                            <div class="d-flex flex-column align-items-center justify-content-between h-100">
                                <div class="fs-15 fw-medium">Dashboard AI Helper</div>
                                <div>
                                    <span class="avatar avatar-lg p-1">
                                        <img :src="media80" alt="">
                                        <span class="top-right"></span>
                                        <span class="bottom-right"></span>
                                    </span>
                                </div>
                                <div class="d-grid w-100">
                                    <button class="btn btn-light border-0">Try Now</button>
                                </div>
                            </div>
                        </li>
                    </ul>
                </li> -->
        </ul>
      </nav>
      <!-- End::nav -->
    </PerfectScrollbar>
    <!-- End::main-sidebar -->
    
    <!-- Chatbot Sidebar Footer -->
    <!-- Chatbot Sidebar Footer -->
    <div class="sidebar-chatbot-footer">
       <a href="javascript:void(0);" class="side-menu__item" @click="toggleChat">
          <i class="ti ti-message-chatbot side-menu__icon"></i>
          <span class="side-menu__label">AI Assistant</span>
       </a>
    </div>

    <Teleport to="body">
      <ChatModal :isOpen="isChatOpen" @close="isChatOpen = false" />
    </Teleport>

  </aside>
  <!-- End::app-sidebar -->
</template>

<script setup>
import {
  onBeforeMount,
  onMounted,
  reactive,
  ref,
  watchEffect,
  computed,
} from "vue";
import { MENUITEMS as staticMenuData } from "../../../data/sidebar/nav.ts";
import { useRoute, useRouter } from "vue-router";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import "vue3-perfect-scrollbar/style.css";
import media80 from "/images/media/media-80.png";
import { switcherStore } from "../../../stores/switcher";
import { useAuthStore } from "../../../stores/auth";
import RecursiveMenu from "../../UI/recursiveMenu.vue";
import ChatModal from "../chatbot/ChatModal.vue";

const authStore = useAuthStore();

// Filter menu based on user role
const filterMenuByRole = (items) => {
  return items
    .filter((item) => {
      // If item has requiredRole, check if user has that role
      if (item.requiredRole) {
        if (authStore.currentUser?.role !== item.requiredRole) {
          return false;
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

// Computed property for dynamic dashboard route based on user role
const dashboardRoute = computed(() => {
  return authStore.userRole === 'admin' ? '/admin/dashboard' : '/dashboards';
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
        setAncestorsActive(menuList, item);
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
      setTimeout(() => {
        let computedValue = siblingUL.getBoundingClientRect();
        if (computedValue.bottom > window.innerHeight) {
          siblingUL.style.height =
            window.innerHeight - computedValue.top - 8 + "px";
          siblingUL.style.overflow = "auto";
        }
      }, 100);
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
  // Used to move the slide of the menu in Horizontal and also remove the arrows after click  if there was no space
  // Used to Slide the menu to Left side
  let slideLeft = document.querySelector(".slide-left");
  let slideRight = document.querySelector(".slide-right");
  let menuNav = document.querySelector(".main-menu");
  let mainContainer1 = document.querySelector(".main-sidebar");
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
      slideRight.classList.remove("d-none");
    } else if (marginRightValue >= 0) {
      menuNav.style.marginInlineStart = "0px";
      slideLeft.classList.add("d-none");
      slideRight.classList.remove("d-none");
    } else {
      menuNav.style.marginInlineStart = "0px";
      slideLeft.classList.add("d-none");
      slideRight.classList.remove("d-none");
    }
  } else {
    menuNav.style.marginInlineStart = "0px";
    slideLeft.classList.add("d-none");
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
        slideRight.classList.add("d-none");
      }
      menuNav.style.marginInlineStart =
        Number(menuNav.style.marginInlineStart.split("px")[0]) -
        Math.abs(mainContainer1Width) +
        "px";
      slideLeft.classList.remove("d-none");
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
  if (mainMenu && menuNav && slideRight && slideLeft) {
    let marginRightValue = Math.ceil(
      Number(window.getComputedStyle(mainMenu).marginInlineStart.split("px")[0])
    );
    if (mainMenu.scrollWidth > menuNav.offsetWidth) {
      slideRight?.classList.remove("d-none");
      slideLeft?.classList.add("d-none");
    } else {
      slideRight?.classList.add("d-none");
      slideLeft?.classList.add("d-none");
      mainMenu.style.marginLeft = "0px";
      mainMenu.style.marginRight = "0px";
    }
    if (marginRightValue == 0) {
      slideLeft?.classList.add("d-none");
    } else {
      slideLeft?.classList.remove("d-none");
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
        document.querySelector(".main-menu").style.marginInlineStart = "0px";
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
  mainContent.addEventListener("click", mainContentFn, {
    passive: true,
  });
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
  const observer = new MutationObserver(handleAttributeChange);
  // Create a MutationObserver instance to watch data-toggled
  const toggledObserver = new MutationObserver(handleToggledChange);
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

onBeforeMount(() => {
  window.removeEventListener("resize", menuResizeFn);
});
</script>

<style scoped lang="scss">
.app-sidebar {
  display: flex !important;
  flex-direction: column;
}

.main-sidebar {
  flex: 1; /* Takes up remaining space */
}

.sidebar-chatbot-footer {
  padding: 10px 20px;
  border-top: 1px solid var(--menu-border-color);
  background: transparent;
  
  .side-menu__item {
    display: flex;
    align-items: center;
    color: var(--menu-prime-color);
    padding: 10px;
    border-radius: 6px;
    transition: all 0.3s ease;
    
    &:hover {
      background-color: var(--primary01);
      color: var(--primary-color);
      
      .side-menu__icon {
        color: var(--primary-color);
        fill: var(--primary-color);
      }
    }
    
    .side-menu__icon {
      font-size: 20px;
      margin-right: 10px;
      color: var(--menu-icon-color);
      fill: var(--menu-icon-color);
      transition: all 0.3s ease;
    }
    
    .side-menu__label {
      font-size: 14px;
      white-space: nowrap;
    }
  }
}

/* Handle collapsed state */
[data-toggled="icon-overlay-close"] .sidebar-chatbot-footer,
[data-toggled="close"] .sidebar-chatbot-footer,
[data-toggled="icon-text-close"] .sidebar-chatbot-footer {
  padding: 10px 5px; /* Reduce padding */
  text-align: center;
  
  .side-menu__item {
    justify-content: center;
    padding: 10px 0;
    
    .side-menu__icon {
      margin-right: 0;
      font-size: 24px;
    }
    
    .side-menu__label {
      display: none;
    }
  }
}
</style>
