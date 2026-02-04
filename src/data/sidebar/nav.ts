

import * as Svgicons from "../sidebar/menusvg-icons";

const badgeSucccess = `<span class="badge bg-success-transparent ms-2">6</span>`
const badgeWarning = `<span class="badge bg-warning-transparent ms-2">5</span>`
const badgeInfo = `<span class="badge bg-info-transparent ms-2">4</span>`
const badgedanger = `<span class="badge bg-danger-transparent ms-2">6</span>`
const badgeSuccess = `<span class="badge bg-success-transparent ms-2">8</span>`

interface MenuItemBase {
  title: string;
  icon?: any;
  type?: string;
  active?: boolean;
  selected?: boolean;
  dirchange?: boolean;
  badgetxt?: string;
  requiredRole?: string;
  hidden?: boolean;
  doublToggle?: boolean;
  menusub?: boolean;
}

interface LinkMenuItem extends MenuItemBase {
  type: 'link';
  path: string;
}

interface SubMenuItem extends MenuItemBase {
  type: 'sub';
  children: MenuItem[];
}

type MenuItem = LinkMenuItem | SubMenuItem;


export const MENUITEMS: (MenuItem | { menutitle: string })[] = [

  {
    path: "/dashboards", icon: Svgicons.Dashboardicon, title: "Dashboards", type: "link", active: true, dirchange: false, selected: false

  },

  {
    path: "/stakeholders", icon: Svgicons.Stakeholdersicon, title: "Stakeholders", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/users-list", icon: Svgicons.UserListicon, title: "User List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/ikas", icon: Svgicons.Analyticsicon, title: "IKAS", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/kse", icon: Svgicons.Todoicon, title: "Kategorisasi SE", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/csirt", icon: Svgicons.Taskicon, title: "CSIRT", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/role-list", icon: Svgicons.RoleListicon, title: "Role List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
]

