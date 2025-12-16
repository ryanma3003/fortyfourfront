<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
import pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useRouter, useRoute } from "vue-router";
import { stakeholdersData } from "../../data/dummydata";
import type { Stakeholder } from "../../data/dummydata";

const router = useRouter();
const route = useRoute();

const handleCancel = () => {
  router.back();
};

const form = reactive<Partial<Stakeholder>>({
  nama_perusahaan: "",
  email: "",
  telepon: "",
  sektor: "",
  website: "",
  alamat: "",
  photo: "", // Add photo to form
});

const currentSlug = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  const slug = route.query.slug as string;
  if (slug) {
    currentSlug.value = slug;
    const found = stakeholdersData.find((s) => s.slug === slug);
    if (found) {
      form.nama_perusahaan = found.nama_perusahaan;
      form.email = found.email;
      form.telepon = found.telepon;
      form.sektor = found.sektor;
      form.website = found.website;
      form.alamat = found.alamat;
      form.photo = found.photo;
    }
  }
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        form.photo = e.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = () => {
  form.photo = ""; // Or set to a default placeholder path if you have one
};

const saveChanges = () => {
  const foundIndex = stakeholdersData.findIndex(
    (s) => s.slug === currentSlug.value
  );
  if (foundIndex !== -1) {
    Object.assign(stakeholdersData[foundIndex], form);
    router.push(`/profile-stakeholders/${currentSlug.value}`);
  }
};

//Reactive State

const dataToPass = {
  title: "stakeholders",
  currentpage: "Stakeholders Profile Settings",
  activepage: "Stakeholders Profile Settings",
};
</script>

<template>
  <Pageheader :propData="dataToPass" />
  <!-- Start::row-1 -->
  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div class="card-header">
          <div class="card-title">Account</div>
        </div>
        <div class="card-body p-4">
          <div class="row gy-3">
            <div class="col-xl-12">
              <div class="d-flex align-items-start flex-wrap gap-3">
                <div>
                  <span class="avatar avatar-xxl">
                    <img :src="form.photo || '/images/faces/9.jpg'" alt="" />
                  </span>
                </div>
                <div>
                  <span class="fw-medium d-block mb-2">Profile Picture</span>
                  <div class="btn-list mb-1">
                    <button
                      class="btn btn-sm btn-primary btn-wave"
                      @click="triggerFileInput"
                    >
                      <i class="ri-upload-2-line me-1"></i>Change Image
                    </button>
                    <button
                      class="btn btn-sm btn-light btn-wave"
                      @click="removeImage"
                    >
                      <i class="ri-delete-bin-line me-1"></i>Remove
                    </button>
                    <input
                      type="file"
                      ref="fileInput"
                      class="d-none"
                      accept="image/*"
                      @change="onFileChange"
                    />
                  </div>
                  <span class="d-block fs-12 text-muted"
                    >Use JPEG, PNG, or GIF. Best size: 200x200 pixels. Keep it
                    under 5MB</span
                  >
                </div>
              </div>
            </div>
            <div class="col-xl-6">
              <label for="profile-user-name" class="form-label"
                >Nama Perusahaan :</label
              >
              <input
                type="text"
                class="form-control"
                id="profile-user-name"
                v-model="form.nama_perusahaan"
                placeholder="Enter Name"
              />
            </div>
            <div class="col-xl-6">
              <label for="profile-email" class="form-label">Email :</label>
              <input
                type="email"
                class="form-control"
                id="profile-email"
                v-model="form.email"
                placeholder="Enter Email"
              />
            </div>
            <div class="col-xl-6">
              <label for="profile-phn-no" class="form-label">Phone No :</label>
              <input
                type="text"
                class="form-control"
                id="profile-phn-no"
                v-model="form.telepon"
                placeholder="Enter Number"
              />
            </div>
            <div class="col-xl-6">
              <label for="profile-sector" class="form-label">Sektor :</label>
              <select
                class="form-select"
                id="profile-sector"
                v-model="form.sektor"
              >
                <option value="" disabled>-- Pilih Sektor --</option>
                <option value="Teknologi Informasi">Teknologi Informasi</option>
                <option value="Perdagangan Umum">Perdagangan Umum</option>
                <option value="Software Development">
                  Software Development
                </option>
                <option value="Konstruksi">Konstruksi</option>
                <option value="teknologi">Teknologi</option>
                <option value="keuangan">Keuangan</option>
                <option value="kesehatan">Kesehatan</option>
                <option value="pendidikan">Pendidikan</option>
                <option value="manufaktur">Manufaktur</option>
              </select>
            </div>
            <div class="col-xl-6">
              <label for="profile-web" class="form-label">Website :</label>
              <input
                type="text"
                class="form-control"
                id="profile-web"
                v-model="form.website"
                placeholder="Enter Website"
              />
            </div>
            <div class="col-xl-12">
              <label for="profile-address" class="form-label">Alamat :</label>
              <textarea
                class="form-control"
                id="profile-address"
                rows="3"
                v-model="form.alamat"
              ></textarea>
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button class="btn btn-secondary" @click="handleCancel">
                Cancel
              </button>
              <button class="btn btn-primary" @click="saveChanges">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!--End::row-1 -->
</template>

<style scoped>
/* Add your styles here */
</style>
