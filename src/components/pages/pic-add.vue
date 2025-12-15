<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { FriendsList } from "../../data/pages/profiledata";

const route = useRoute();
const router = useRouter();

const DEFAULT_IMAGE = "/images/faces/face9.png";

const index = computed(() => {
  return route.query.index !== undefined
    ? Number(route.query.index)
    : null;
});

const isEdit = computed(() => {
  return index.value !== null && FriendsList[index.value];
});

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

onMounted(() => {
  if (isEdit.value && index.value !== null) {
    form.value = { ...FriendsList[index.value] };
  }
});

const fileInput = ref<HTMLInputElement | null>(null);

const openFilePicker = () => {
  fileInput.value?.click();
};

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
  reader.onload = () => {
    form.value.imgSrc = reader.result as string;
  };
  reader.readAsDataURL(file);
};

const removeImage = () => {
  form.value.imgSrc = DEFAULT_IMAGE;
  if (fileInput.value) fileInput.value.value = "";
};

const handleCancel = () => {
  router.back();
};

const handleSave = () => {
  if (isEdit.value && index.value !== null) {
    // UPDATE
    FriendsList[index.value] = { ...form.value };
  } else {
    // ADD
    FriendsList.push({ ...form.value });
  }
  router.back();
};
</script>

 <template>
  <Pageheader :propData="dataToPass" />

  <div class="row">
    <div class="col-xl-12">
      <div class="card custom-card">
        <div class="card-body p-4">

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
                <button
                  class="btn btn-sm btn-primary"
                  @click="openFilePicker"
                >
                  Change Image
                </button>

                <button
                  class="btn btn-sm btn-light"
                  @click="removeImage"
                >
                  Remove
                </button>
              </div>

              <span class="fs-12 text-muted">
                JPEG, PNG, GIF • Max 5MB
              </span>
            </div>
          </div>

          <div class="row gy-3">
            <div class="col-xl-6">
              <label class="form-label">Name</label>
              <input class="form-control" v-model="form.name" />
            </div>
            <div class="col-xl-6">
              <label class="form-label">Phone</label>
              <input class="form-control" v-model="form.telepon" />
            </div>

            <div class="col-xl-12 d-flex justify-content-end gap-2">
              <button class="btn btn-secondary" @click="handleCancel">
                Cancel
              </button>
              <button class="btn btn-primary" @click="handleSave">
                Save Changes
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
