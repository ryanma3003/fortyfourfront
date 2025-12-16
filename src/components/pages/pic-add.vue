<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { FriendsList } from "../../data/pages/profiledata";

const route = useRoute();
const router = useRouter();
const DEFAULT_IMAGE = "/images/faces/face9.png";

const index = computed(() =>
  route.query.index !== undefined ? Number(route.query.index) : null
);
const isEdit = computed(
  () => index.value !== null && !!FriendsList[index.value]
);

const dataToPass = computed(() => ({
  title: "stakeholders",
  currentpage: isEdit.value ? "Edit PIC" : "Add PIC",
  activepage: "Stakeholders Profile Settings",
}));

const form = ref({
  name: "",
  telepon: "",
  imgSrc: DEFAULT_IMAGE,
});

const errors = ref({
  name: "",
  telepon: "",
});

const isFormValid = computed(
  () =>
    form.value.name.trim() &&
    form.value.telepon.trim() &&
    !errors.value.name &&
    !errors.value.telepon
);

const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (isEdit.value && index.value !== null) {
    Object.assign(form.value, FriendsList[index.value]);
  }
});

const validateName = () => {
  errors.value.name = form.value.name.trim() ? "" : "Name cannot be empty";
};

const validatePhone = () => {
  errors.value.telepon = form.value.telepon.trim()
    ? ""
    : "Phone number is required";
};

const openFilePicker = () => fileInput.value?.click();

const handleImageChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Max image size is 5MB");
    input.value = "";
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Only image files are allowed");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => (form.value.imgSrc = reader.result as string);
  reader.readAsDataURL(file);
};

const removeImage = () => {
  form.value.imgSrc = DEFAULT_IMAGE;
  if (fileInput.value) fileInput.value.value = "";
};

const handleSave = () => {
  validateName();
  validatePhone();

  if (!isFormValid.value) return;

  const data = { ...form.value };
  if (isEdit.value && index.value !== null) {
    FriendsList[index.value] = data;
  } else {
    FriendsList.push(data);
  }

  router.back();
};

const handleCancel = () => router.back();
</script>

<template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div class="card-body p-4">
          <!-- PROFILE IMAGE -->
          <div class="d-flex align-items-start gap-3 mb-4">
            <span class="avatar avatar-xxl">
              <img :src="form.imgSrc" alt="profile" />
            </span>

            <div>
              <span class="fw-medium d-block mb-2">Profile Picture</span>

              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                hidden
                @change="handleImageChange"
              />

              <div class="btn-list mb-1">
                <button class="btn btn-sm btn-primary" @click="openFilePicker">
                  Change Image
                </button>
                <button class="btn btn-sm btn-light" @click="removeImage">
                  Remove
                </button>
              </div>

              <span class="fs-12 text-muted">JPEG, PNG, GIF • Max 5MB</span>
            </div>
          </div>

          <!-- FORM -->
          <div class="row gy-3">
            <div class="col-xl-6">
              <label class="form-label">Name</label>
              <input
                class="form-control"
                v-model="form.name"
                @blur="validateName"
                placeholder="Enter name"
                :class="{ 'is-invalid': errors.name }"
              />
              <div class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <div class="col-xl-6">
              <label class="form-label">Phone</label>
              <input
                class="form-control"
                v-model="form.telepon"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="15"
                placeholder="Enter phone number"
                @input="form.telepon = form.telepon.replace(/[^0-9]/g, '')"
                @blur="validatePhone"
                :class="{ 'is-invalid': errors.telepon }"
              />
              <div class="invalid-feedback">{{ errors.telepon }}</div>
            </div>

            <div class="col-xl-12 d-flex justify-content-end gap-2">
              <button class="btn btn-secondary" @click="handleCancel">
                Cancel
              </button>
              <button
                class="btn btn-primary"
                :disabled="!isFormValid"
                @click="handleSave"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar img {
  object-fit: cover;
}
</style>
