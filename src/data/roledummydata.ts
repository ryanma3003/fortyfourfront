// =====================
// Interfaces
// =====================
export interface Permission {
  id: number
  name: string
  label: string
  group: string
}

export interface Role {
  id: number
  name: string
  description?: string
  permissions: string[]
  allAccess?: boolean
}

export interface User {
  id: number
  name: string
  role: string
  permissions: string[]
  allAccess: boolean
  photo?: string
}

// =====================
// Permissions Dummy
// =====================
export const permissionsDummy: Permission[] = [
  // Users
  { id: 1, name: "users.create", label: "Create User", group: "Users" },
  { id: 2, name: "users.edit", label: "Edit User", group: "Users" },
  { id: 3, name: "users.delete", label: "Delete User", group: "Users" },
  { id: 4, name: "users.view", label: "View User", group: "Users" },

  // Roles
  { id: 5, name: "roles.create", label: "Create Role", group: "Roles" },
  { id: 6, name: "roles.edit", label: "Edit Role", group: "Roles" },
  { id: 7, name: "roles.delete", label: "Delete Role", group: "Roles" },

  // Reports
  { id: 8, name: "reports.view", label: "View Reports", group: "Reports" },
]

// =====================
// Roles Dummy
// =====================
export const rolesDummy: Role[] = [
  {
    id: 1,
    name: "Admin",
    description: "Full access to all features",
    permissions: [],
    allAccess: true,
  },
  {
    id: 2,
    name: "User",
    description: "Read-only access",
    permissions: [
      "Viewers",
    ],
  },
]

// =====================
// Helpers
// =====================
export const getRoleByName = (roleName: string): Role | undefined =>
  rolesDummy.find(role => role.name === roleName)

// =====================
// Users Dummy
// =====================
export const usersDummy: User[] = [
  {
    id: 1,
    name: "Super Admin",
    role: "Admin",
    permissions: getRoleByName("Admin")?.permissions ?? [],
    allAccess: getRoleByName("Admin")?.allAccess ?? false,
  },
  {
    id: 2,
    name: "John User",
    role: "User",
    permissions: getRoleByName("User")?.permissions ?? [],
    allAccess: getRoleByName("User")?.allAccess ?? false,
  },
]

// =====================
// Current User (login)
// =====================
export const currentUserDummy: User = usersDummy[0] // ganti index buat simulasi login
