<template>
  <li :class="`${item?.menutitle ? '' : ''} ${item?.type == 'link'? 'slide' : ''} ${item?.type == 'empty'? 'slide' : ''} ${item?.type == 'sub' ? 'slide has-sub' : ''} ${item?.active ? 'open' : ''} ${item?.selected ? 'active' : ''}`">
    <template v-if="item?.menutitle">
      <span class="">{{ item.menutitle }}</span>
    </template>
    <template v-if="item?.type === 'link'">
      <router-link :to="item.path" class="side-menu__item" :class="[isRoot ? 'sb2-item' : '', item.selected ? 'active' : '']" @click="handleMenuClick($event, item)">
        <span class="sb2-item-indicator" aria-hidden="true" v-if="isRoot"></span>
        <span :class="isRoot ? 'sb2-icon-wrap' : ''" v-if='item.icon' v-html="item.icon"></span>
        <span class="side-menu__label" :class="isRoot ? 'sb2-label' : ''">{{ item.title }}
          <span v-if="item.badgetxt" v-html="item.badgetxt"></span>
        </span>
      </router-link>
    </template>
    <template v-if="item?.type === 'empty'">
      <a href="javascript:;" class="side-menu__item" :class="isRoot ? 'sb2-item' : ''" @click="handleMenuClick($event, item)">
        <span class="sb2-item-indicator" aria-hidden="true" v-if="isRoot"></span>
        <span :class="isRoot ? 'sb2-icon-wrap' : ''" v-if='item.icon' v-html="item.icon"></span>
        <span class="side-menu__label" :class="isRoot ? 'sb2-label' : ''">{{ item.title }}
          <span v-if="item.badgetxt" v-html="item.badgetxt"></span>
        </span>
      </a>
    </template>
    <template v-if="item?.type === 'sub'">
      <a href="javascript:;" class="side-menu__item" :class="isRoot ? 'sb2-item' : ''" @click="handleMenuClick($event, item)">
        <span class="sb2-item-indicator" aria-hidden="true" v-if="isRoot"></span>
        <span :class="isRoot ? 'sb2-icon-wrap' : ''" v-if='item.icon' v-html="item.icon"></span>
        <span class="side-menu__label" :class="isRoot ? 'sb2-label' : ''">{{ item.title }}
          <span v-if="item.badgetxt" v-html="item.badgetxt"></span>
        </span>
        <i class="ri-arrow-right-s-line side-menu__angle" :class="item.active ? 'horizontal-arrow' : ''"></i>
      </a>
      <ul v-if="item.children && item.children.length > 0" class="slide-menu child1" :class="item.active ? 'doublemenu_slide-menu open' : 'doublemenu_slide-menu'">
        <RecursiveMenu
          v-for="(child, index) in item.children"
          :key="index"
          :menuData="child"
          :toggleSubmenu="toggleSubmenu"
          :HoverToggleInnerMenuFn="HoverToggleInnerMenuFn"
          :level="level + 1"
          :isRoot="false"
        />
      </ul>
    </template>
  </li>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  menuData: {
    type: Object,
    required: true
  },
  toggleSubmenu: {
    type: Function,
    required: true
  },
  HoverToggleInnerMenuFn: {
    type: Function,
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  isRoot: {
    type: Boolean,
    default: false
  }
});

const router = useRouter();
const item = props.menuData;

function handleMenuClick(event, targetItem) {
  // If it's a child link (not root), we handle navigation directly 
  // and skip the complex toggleSubmenu to avoid parent sidebar re-renders/collapses.
  if (targetItem.type === 'link' && !props.isRoot) {
    event.preventDefault();
    if (targetItem.path) {
      router.push(targetItem.path);
    }
  } else {
    // Parent menus or root links still use the standard toggle logic
    props.toggleSubmenu(event, targetItem);
  }
  
  if (props.HoverToggleInnerMenuFn) {
    props.HoverToggleInnerMenuFn(event, targetItem);
  }
}
</script>
