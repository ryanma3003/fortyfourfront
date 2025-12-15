<script setup>
import { ref } from "vue";
import pageheader from "../../shared/components/pageheader/pageheader.vue";
import toggleSwitch from "../../shared/UI/toggleSwitch.vue";
import { useRouter } from "vue-router";

const router = useRouter();

const handleCancel = () => {
  router.back();
};


//Reactive State

const dataToPass = {
    title: "stakeholders",
    currentpage: "Stakeholders Profile Settings",
    activepage: "Stakeholders Profile Settings",
}

</script>

<template>
    <Pageheader :propData="dataToPass" />
    <!-- Start::row-1 -->
    <div class="row">
        <div class="col-xl-12">
            <div class="card custom-card">
                <div class="card-header">
                    <div class="card-title">
                        Account
                    </div>
                </div>
                <div class="card-body p-4">
                    <div class="row gy-3">
                        <div class="col-xl-12">
                            <div class="d-flex align-items-start flex-wrap gap-3">
                                <div>
                                    <span class="avatar avatar-xxl">
                                        <img src="/images/faces/9.jpg" alt="">
                                    </span>
                                </div>
                                <div>
                                    <span class="fw-medium d-block mb-2">Profile Picture</span>
                                    <div class="btn-list mb-1">
                                        <button class="btn btn-sm btn-primary btn-wave"><i
                                                class="ri-upload-2-line me-1"></i>Change Image</button>
                                        <button class="btn btn-sm btn-light btn-wave"><i
                                                class="ri-delete-bin-line me-1"></i>Remove</button>
                                    </div>
                                    <span class="d-block fs-12 text-muted">Use JPEG, PNG, or GIF. Best size: 200x200
                                        pixels. Keep it under 5MB</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-6">
                            <label for="profile-user-name" class="form-label">Nama Perusahaan :</label>
                            <input type="text" class="form-control" id="profile-user-name" value=""
                                placeholder="Enter Name">
                        </div>
                        <div class="col-xl-6">
                            <label for="profile-email" class="form-label">Email :</label>
                            <input type="email" class="form-control" id="profile-email" value=""
                                placeholder="Enter Email">
                        </div>
                        <div class="col-xl-6">
                            <label for="profile-phn-no" class="form-label">Phone No :</label>
                            <input type="number" class="form-control" id="profile-phn-no" value=""
                                placeholder="Enter Number">
                        </div>
                        <div class="col-xl-6">
                            <label for="profile-sector" class="form-label">Sektor :</label>
                            <select class="form-select" id="profile-sector">
                                <option value="" selected disabled>-- Pilih Sektor --</option>
                                <option value="teknologi">Teknologi</option>
                                <option value="keuangan">Keuangan</option>
                                <option value="kesehatan">Kesehatan</option>
                                <option value="pendidikan">Pendidikan</option>
                                <option value="manufaktur">Manufaktur</option>
                            </select>
                        </div>
                        <div class="col-xl-6">
                            <label for="profile-web" class="form-label">Website :</label>
                            <input type="text" class="form-control" id="profile-web" value=""
                                placeholder="Enter Website">                      
                        </div>
                        <div class="col-xl-12">
                            <label for="profile-address" class="form-label">Alamat :</label>
                            <textarea class="form-control" id="profile-address" rows="3"></textarea>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-secondary" @click="handleCancel">
                                Cancel
                            </button>
                            <button class="btn btn-primary">
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