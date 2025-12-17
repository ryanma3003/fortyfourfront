<script setup lang="ts">
import { ref, computed } from "vue";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import {
  usersDummy as initialUsers,
  rolesDummy,
  type User,
  type Role,
  getRoleByName,
} from "../../data/roledummydata";

// --- State ---
const users = ref<User[]>([...initialUsers]);
const showModal = ref(false);
const selectedUser = ref<User | null>(null);
const newRoleName = ref("");
type SortOrder = "asc" | "desc";

const roleSortOrder = ref<SortOrder>("asc");
const nameSortOrder = ref<SortOrder>("asc");

const sortField = ref<"name" | "role" | "id">("id");
const sortOrder = ref<"asc" | "desc">("asc");

// --- Actions ---
const openEditModal = (user: User) => {
  selectedUser.value = { ...user }; // Clone to avoid direct mutation
  newRoleName.value = user.role;
  showModal.value = true;
};

const toggleSort = (field: "name" | "role" | "id") => {
  if (sortField.value === field) {
    // Jika field sama, balikkan urutan (asc <-> desc)
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    // Jika field baru, set ke field tersebut dan mulai dari asc
    sortField.value = field;
    sortOrder.value = "asc";
  }
};

// Computed untuk hasil akhir yang ditampilkan di tabel
const displayUsers = computed(() => {
  return [...users.value].sort((a, b) => {
    let modifier = sortOrder.value === "asc" ? 1 : -1;

    // Logika sortir berdasarkan field yang dipilih
    const valA = a[sortField.value].toString().toLowerCase();
    const valB = b[sortField.value].toString().toLowerCase();

    if (valA < valB) return -1 * modifier;
    if (valA > valB) return 1 * modifier;
    return 0;
  });
});

const saveChanges = () => {
  if (selectedUser.value) {
    const roleData = getRoleByName(newRoleName.value);

    // Find user in the list and update
    const index = users.value.findIndex((u) => u.id === selectedUser.value?.id);
    if (index !== -1 && roleData) {
      users.value[index] = {
        ...users.value[index],
        role: roleData.name,
        permissions: roleData.permissions,
        allAccess: roleData.allAccess ?? false,
      };
    }
  }
  showModal.value = false;
};

const handleDelete = (userId: number) => {
  if (confirm("Are you sure? This action cannot be undone.")) {
    users.value = users.value.filter((u) => u.id !== userId);
  }
};

let lastId = users.value.length ? users.value[users.value.length - 1].id : 0;

const addThreeRandomUsers = () => {
  for (let i = 1; i <= 3; i++) {
    const randomRole =
      rolesDummy[Math.floor(Math.random() * rolesDummy.length)];

    users.value.push({
      id: ++lastId,
      name: `New User ${lastId}`,
      role: randomRole.name,
      permissions: randomRole.permissions,
      allAccess: randomRole.allAccess ?? false,
    });
  }
};

const dataToPass = {
  title: "Role Management",
  currentpage: "Role List",
  activepage: "Role List",
};

const sortedUsers = computed(() => {
  if (!roleSortOrder.value) return [...users.value];

  return [...users.value].sort((a, b) => {
    if (roleSortOrder.value === "asc") {
      return a.role.localeCompare(b.role);
    } else {
      return b.role.localeCompare(a.role);
    }
  });
});

const sortedNames = computed(() => {
  if (!nameSortOrder.value) return [...users.value];

  return [...users.value].sort((a, b) => {
    if (nameSortOrder.value === "asc") {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });
});

const toggleRoleSort = () => {
  if (roleSortOrder.value === "asc") {
    roleSortOrder.value = "desc";
  } else {
    roleSortOrder.value = "asc";
  }
};

const toggleNameSort = () => {
  if (nameSortOrder.value === "asc") {
    nameSortOrder.value = "desc";
  } else {
    nameSortOrder.value = "asc";
  }
};
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div
          class="card-header d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3"
        >
          <div class="card-title">User Role Administration</div>
          <button
            class="btn btn-primary-light btn-sm w-100 w-sm-auto"
            @click="addThreeRandomUsers"
          >
            <i class="ri-add-line"></i> Add 3 Random Users
          </button>
        </div>
        <div class="card-body p-0 p-sm-3">
          <div class="table-responsive">
            <table class="table table-hover text-nowrap mb-0">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col" class="sortable" @click="toggleNameSort">
                    Name
                    <i
                      v-if="nameSortOrder"
                      :class="[
                        'ri-arrow-up-s-line',
                        nameSortOrder === 'desc' && 'rotate',
                      ]"
                    ></i>
                  </th>
                  <th scope="col" class="sortable" @click="toggleRoleSort">
                    Current Role
                    <i
                      v-if="roleSortOrder"
                      :class="[
                        'ri-arrow-up-s-line',
                        roleSortOrder === 'desc' && 'rotate',
                      ]"
                    ></i>
                  </th>

                  <th scope="col">Permissions</th>
                  <th scope="col" class="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(user, index) in displayUsers" :key="user.id">
                  <td>{{ index + 1 }}</td>
                  <td>
                    <div class="fw-semibold">{{ user.name }}</div>
                  </td>
                  <td>
                    <span
                      :class="[
                        'badge',
                        'role-badge',
                        user.role === 'Admin'
                          ? 'bg-danger-transparent'
                          : 'bg-info-transparent',
                      ]"
                    >
                      {{ user.role }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-if="user.allAccess"
                      class="text-success small fw-bold"
                    >
                      <i class="ri-shield-check-line me-1"></i>Full Access
                    </span>
                    <span v-else class="text-muted small">
                      <i class="ri-lock-2-line me-1"></i
                      >{{ user.permissions.length }} active
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="btn-list">
                      <button
                        class="btn btn-sm btn-icon btn-primary-light me-2"
                        @click="openEditModal(user)"
                        title="Edit Role"
                      >
                        <i class="ri-edit-line"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-icon btn-danger-light"
                        @click="handleDelete(user.id)"
                        title="Delete User"
                      >
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Transition name="fade">
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content card custom-card shadow-lg mx-3">
        <div class="card-header">
          <div class="card-title text-truncate">
            Edit Role: {{ selectedUser?.name }}
          </div>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label class="form-label fw-bold">Select Security Role</label>
            <select v-model="newRoleName" class="form-select form-select-lg">
              <option
                v-for="role in rolesDummy"
                :key="role.id"
                :value="role.name"
              >
                {{ role.name }}
              </option>
            </select>
          </div>

          <div class="alert alert-primary-light border-0 mb-0">
            <div class="d-flex align-items-center">
              <i class="ri-information-line fs-20 me-2"></i>
              <small
                >This role includes
                <strong>{{
                  getRoleByName(newRoleName)?.permissions.length || 0
                }}</strong>
                specific permissions.</small
              >
            </div>
          </div>
        </div>
        <div
          class="card-footer d-flex flex-column flex-sm-row justify-content-end gap-2"
        >
          <button
            class="btn btn-light order-2 order-sm-1"
            @click="showModal = false"
          >
            Cancel
          </button>
          <button
            class="btn btn-primary order-1 order-sm-2"
            @click="saveChanges"
          >
            Update Access
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal Overlay Styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6); /* Slightly darker slate */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1rem;
  backdrop-filter: blur(8px); /* Higher blur for premium feel */
}

/* Modal Content Responsive Sizing */
.modal-content {
  width: 100%;
  max-width: 450px;
  border: none;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Badge Styling */
.role-badge {
  font-size: 0.7rem;
  padding: 0.4em 0.7em;
  font-weight: 600;
  text-transform: uppercase;
}

/* Mobile Adjustments */
@media (max-width: 576px) {
  .card-title {
    font-size: 1.1rem;
  }
  .btn-icon {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .table thead th {
    font-size: 0.75rem;
  }
}

/* Standard Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Sortable Column Styling */
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable i {
  margin-left: 6px;
  font-size: 1rem;
  vertical-align: middle;
}

.sortable:hover {
  background-color: rgba(var(--primary-rgb), 0.05);
}

.sortable i.rotate {
  transform: rotate(180deg);
}
</style>
