

import * as Svgicons from "../sidebar/menusvg-icons";

const badgeSucccess = `<span class="badge bg-success-transparent ms-2">6</span>`
const badgeWarning = `<span class="badge bg-warning-transparent ms-2">5</span>`
const badgeInfo = `<span class="badge bg-info-transparent ms-2">4</span>`
const badgedanger = `<span class="badge bg-danger-transparent ms-2">6</span>`
const badgeSuccess = `<span class="badge bg-success-transparent ms-2">8</span>`

interface MenuItemBase {
  title: string;
  path?: string;
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
    path: "/dashboard",
    icon: Svgicons.Dashboardicon,
    title: "Dashboard",
    type: "sub",
    active: true,
    dirchange: false,
    selected: false,
    requiredRole: "admin",
    children: [
      {
        path: "/dashboard/analytics",
        icon: '<i class="ri-line-chart-line"></i>',
        title: "Analytics",
        type: "link",
        active: true,
        dirchange: false,
        selected: false,
        requiredRole: "admin",
      },
    ],
  },
  {
    path: "/pages/error/role-akses", icon: Svgicons.Dashboardicon, title: "Dashboard", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/stakeholders",
    icon: Svgicons.Stakeholdersicon,
    title: "Stakeholders",
    type: "sub",
    active: false,
    dirchange: false,
    selected: false,
    requiredRole: "admin",
    children: [
      {
        path: "/stakeholders/sektor-setup",
        icon: '<i class="ri-settings-4-line"></i>',
        title: "Sektor Setup",
        type: "link",
        active: false,
        dirchange: false,
        selected: false,
      },
    ],
  },
  {
    path: "/csirt-list", icon: Svgicons.Csirticon, title: "CSIRT List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/kse-list-admin", icon: Svgicons.Todoicon, title: "KSE List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/ikas-list", icon: Svgicons.Analyticsicon, title: "IKAS List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/users", icon: Svgicons.UserListicon, title: "User List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "fullAdmin"
  },
  {
    path: "/ikas", icon: Svgicons.Analyticsicon, title: "IKAS", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/kse", icon: Svgicons.Todoicon, title: "Kategorisasi SE", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/csirt", icon: Svgicons.Csirticon, title: "CSIRT", type: "link", active: true, dirchange: false, selected: false, requiredRole: "user"
  },
  {
    path: "/roles", icon: Svgicons.RoleListicon, title: "Role List", type: "link", active: true, dirchange: false, selected: false, requiredRole: "fullAdmin"
  },
  {
    path: "/lms/kelas", icon: Svgicons.LMSicon, title: "LMS", type: "link", active: false, dirchange: false, selected: false, requiredRole: "admin"
  },
  {
    path: "/event", icon: Svgicons.Blogicon, title: "Event", type: "link", active: false, dirchange: false, selected: false, requiredRole: "admin"
  },
]

