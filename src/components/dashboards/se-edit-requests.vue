<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { seEditService } from '@/services/se-edit.service';
import type { SeEditRequest } from '@/types/se-edit.types';
import Pageheader from '@/shared/components/pageheader/pageheader.vue';

const requests = ref<SeEditRequest[]>([]);
const loading = ref(true);
const reviewModal = ref(false);
const selectedRequest = ref<SeEditRequest | null>(null);
const adminNotes = ref('');
const isSubmitting = ref(false);

const pageData = {
    title: 'SE Edit Requests',
    currentpage: 'Edit Requests',
    activepage: 'Review',
};

const fetchRequests = async () => {
    loading.value = true;
    try {
        requests.value = await seEditService.getRequests();
    } catch (error) {
        console.error('Failed to fetch requests:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchRequests);

const pendingRequests = computed(() => requests.value.filter(r => r.status === 'pending'));
const historyRequests = computed(() => requests.value.filter(r => r.status !== 'pending'));

const openReview = (req: SeEditRequest) => {
    selectedRequest.value = req;
    adminNotes.value = '';
    reviewModal.value = true;
};

const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest.value) return;
    isSubmitting.value = true;
    try {
        await seEditService.reviewRequest(selectedRequest.value.id, {
            status,
            admin_notes: adminNotes.value
        });
        reviewModal.value = false;
        fetchRequests();
    } catch (error) {
        console.error('Review failed:', error);
    } finally {
        isSubmitting.value = false;
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending': return 'bg-warning-transparent text-warning';
        case 'approved': return 'bg-success-transparent text-success';
        case 'rejected': return 'bg-danger-transparent text-danger';
        default: return 'bg-light text-muted';
    }
};

const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
</script>

<template>
    <Pageheader :propData="pageData" />

    <div class="row">
        <div class="col-xl-12">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">Pending Edit Requests</div>
                    <div class="d-flex">
                        <button class="btn btn-sm btn-primary-light" @click="fetchRequests">
                            <i class="ri-refresh-line"></i> Refresh
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table text-nowrap table-hover">
                            <thead>
                                <tr>
                                    <th>Requester</th>
                                    <th>System Name</th>
                                    <th>Stakeholder</th>
                                    <th>Requested At</th>
                                    <th>Proposed Changes</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loading">
                                    <td colspan="6" class="text-center py-5">
                                        <div class="spinner-border text-primary" role="status"></div>
                                    </td>
                                </tr>
                                <tr v-else-if="pendingRequests.length === 0">
                                    <td colspan="6" class="text-center py-5 text-muted">No pending requests found.</td>
                                </tr>
                                <tr v-for="req in pendingRequests" :key="req.id">
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <div class="me-2">
                                                <span class="avatar avatar-sm avatar-rounded bg-primary-transparent">
                                                    {{ req.user?.username?.charAt(0).toUpperCase() || 'U' }}
                                                </span>
                                            </div>
                                            <div>
                                                <div class="fw-semibold">{{ req.user?.display_name || req.user?.username }}</div>
                                                <div class="text-muted fs-11">{{ req.user?.email }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{{ req.se?.nama_se || 'N/A' }}</td>
                                    <td>{{ req.se?.perusahaan?.nama_perusahaan || 'N/A' }}</td>
                                    <td>{{ formatDate(req.created_at) }}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info-light" @click="openReview(req)">
                                            View Changes
                                        </button>
                                    </td>
                                    <td>
                                        <div class="btn-list">
                                            <button class="btn btn-sm btn-icon btn-success-light" @click="openReview(req)">
                                                <i class="ri-check-line"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon btn-danger-light" @click="openReview(req)">
                                                <i class="ri-close-line"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- History Section -->
            <div class="card custom-card mt-4">
                <div class="card-header">
                    <div class="card-title">Request History</div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table text-nowrap table-hover">
                            <thead>
                                <tr>
                                    <th>Requester</th>
                                    <th>System Name</th>
                                    <th>Status</th>
                                    <th>Reviewed At</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="req in historyRequests" :key="req.id">
                                    <td>{{ req.user?.username }}</td>
                                    <td>{{ req.se?.nama_se }}</td>
                                    <td><span :class="['badge', getStatusBadge(req.status)]">{{ req.status }}</span></td>
                                    <td>{{ formatDate(req.updated_at) }}</td>
                                    <td>{{ req.admin_notes || '-' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Review Modal -->
    <div v-if="reviewModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Review Edit Request</h5>
                    <button type="button" class="btn-close" @click="reviewModal = false"></button>
                </div>
                <div class="modal-body" v-if="selectedRequest">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label text-muted fs-11 text-uppercase fw-bold">Current Data</label>
                            <div class="bg-light p-3 rounded">
                                <div v-for="(val, key) in selectedRequest.proposed_changes" :key="key" class="mb-2">
                                    <div class="fs-12 fw-semibold">{{ key }}:</div>
                                    <div class="fs-13">{{ selectedRequest.se ? (selectedRequest.se as any)[key] : 'N/A' }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-primary fs-11 text-uppercase fw-bold">Proposed Changes</label>
                            <div class="bg-primary-transparent p-3 rounded">
                                <div v-for="(val, key) in selectedRequest.proposed_changes" :key="key" class="mb-2">
                                    <div class="fs-12 fw-semibold">{{ key }}:</div>
                                    <div class="fs-13 text-primary fw-bold">{{ val }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 mt-3">
                            <label class="form-label">Admin Notes</label>
                            <textarea v-model="adminNotes" class="form-control" rows="3" placeholder="Add notes for the requester..."></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-light" @click="reviewModal = false">Cancel</button>
                    <button type="button" class="btn btn-danger" :disabled="isSubmitting" @click="handleReview('rejected')">
                        Reject Request
                    </button>
                    <button type="button" class="btn btn-success" :disabled="isSubmitting" @click="handleReview('approved')">
                        Approve & Update SE
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.avatar {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}
.bg-warning-transparent { background-color: rgba(255, 193, 7, 0.1); }
.bg-success-transparent { background-color: rgba(40, 167, 69, 0.1); }
.bg-danger-transparent { background-color: rgba(220, 53, 69, 0.1); }
.bg-primary-transparent { background-color: rgba(13, 110, 253, 0.1); }
.bg-info-transparent { background-color: rgba(23, 162, 184, 0.1); }
</style>
