<script setup>
import * as dashboardData from "../../../data/dashboards/crm/dashboarddata"
import SpkReusableCrmCard from "../../../shared/components/@spk/dashboards/crm/spk-reusable-crmCard.vue";
import Pageheader from "../../../shared/components/pageheader/pageheader.vue";
import TableComponent from "../../../shared/components/@spk/table-reuseble/table-component.vue"

const dataToPass = {
    title: "Dashboards",
    subtitle: "CRM",
    currentpage: "Dashboard",
    activepage: "CRM"
}

</script>

<template>
    <Pageheader :propData="dataToPass" />
    <!-- Start:: row-1 -->
    
    <!-- End:: row-2 -->

    <!-- Start:: row-3 -->
    <div class="row">
        <div class="col-xl-12">
            <div class="card custom-card overflow-hidden">
                <div class="card-header">
                    <div class="card-title">
                        Top Deals
                    </div>
                </div>
                <div class="card-body p-0">
                    <TableComponent tableClass="table text-nowrap"
                        :headers="[{ text: 'Deal ID' }, { text: 'Deal Name' }, { text: 'Client Name' }, { text: 'Deal Amount' }, { text: 'Status' }, { text: 'Closing Date' }, { text: 'Sales Rep' }, { text: 'Priority' }, { text: 'Actions' },]"
                        :rows="dashboardData.topdealsTable" v-slot:cell="{ row }">
                        <td :class="row.tdClass"><a href="javascript:void(0);">{{ row.id }}</a></td>
                        <td :class="row.tdClass">{{ row.title }}</td>
                        <td :class="row.tdClass">
                            <div class="d-flex align-items-center gap-2 position-relative">
                                <a href="javascript:void(0);" class="stretched-link"></a>
                                <div class="lh-1">
                                    <span class="avatar avatar-sm avatar-rounded">
                                        <img :src="row.companyLogo" alt="">
                                    </span>
                                </div>
                                <div>
                                    {{ row.companyName }}
                                </div>
                            </div>
                        </td>
                        <td :class="row.tdClass">{{ row.amount }}</td>
                        <td :class="row.tdClass"><span :class="`badge ${row.status.colorClass}`">{{ row.status.label }}</span></td>
                        <td :class="row.tdClass">{{ row.closeDate }}</td>
                        <td :class="row.tdClass">{{ row.owner }}</td>
                        <td :class="row.tdClass">{{ row.priority }}</td>
                        <td :class="row.tdClass">
                            <div class="btn-list">
                                <button class="btn btn-icon btn-primary-light btn-sm">
                                    <i class="ti ti-edit"></i>
                                </button>
                                <button class="btn btn-icon btn-danger-light btn-sm">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </div>
                        </td>
                    </TableComponent>
                </div>
                <div class="card-footer"> 
                    <div class="d-flex align-items-center flex-wrap"> 
                        <div> Showing 6 Entries <i class="bi bi-arrow-right ms-2 fw-semibold"></i> </div> 
                        <div class="ms-auto"> <nav aria-label="Page navigation" class="pagination-style-2"> 
                            <ul class="pagination mb-0 flex-wrap"> 
                                <li class="page-item disabled"> <a class="page-link" href="javascript:void(0);"> Prev </a> </li> 
                                <li class="page-item"><a class="page-link" href="javascript:void(0);">1</a></li> 
                                <li class="page-item active"><a class="page-link" href="javascript:void(0);">2</a></li> 
                                <li class="page-item"> <a class="page-link" href="javascript:void(0);"> <i class="bi bi-three-dots"></i> </a> </li> 
                                <li class="page-item"><a class="page-link" href="javascript:void(0);">17</a></li> 
                                <li class="page-item"> <a class="page-link text-primary" href="javascript:void(0);"> next </a> </li> 
                            </ul> 
                        </nav>
                     </div> 
                    </div> 
                </div>
            </div>
        </div>
    </div>
    <!-- End:: row-3 -->
</template>

<style scoped>
/* Add your styles here */
</style>
