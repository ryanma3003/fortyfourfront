<script setup>
import { ref } from "vue";
import * as salesData from "../../data/dashboards/salesdata";
import SpkReusebleJobs from "../../shared/components/@spk/dashboards/jobs/dashboard/spk-reuseble-jobs.vue";
import TableComponent from "../../shared/components/@spk/table-reuseble/table-component.vue";
const picked = ref(new Date());
const picked2 = ref(new Date());
const lowerpicked = new Date(picked2.value);
const date = ref();
// Get the day of the month
const currentDay = picked.value.getDate();

// Calculate the date of the next 5th day
const picked1 = new Date(picked.value);
picked1.setDate(currentDay + 5);
lowerpicked.setDate(currentDay - 5);
const startDate = new Date();
const endDate = new Date(new Date().setDate(startDate.getDate() + 7));
date.value = [startDate, endDate];

</script>

<template>
    <!-- Start::app-content -->

    <!-- Start::page-header -->
    <div class="d-flex align-items-center justify-content-between mb-3 page-header-breadcrumb flex-wrap gap-2">
        <div>
            <h1 class="page-title fw-medium fs-20 mb-0">Dashboard</h1>
        </div>
        <div class="d-flex align-items-center flex-wrap">
            <div class="form-group">
                <Datepicker placeholder="Search By Date Range"
                    class="form-control breadcrumb-input border-0 bg-white custom-date-input " autoApply v-model="date"
                    range />
            </div>
            <div class="btn-list custom-button-list">
                <button class="btn btn-icon btn-primary btn-wave">
                    <i class="ri-refresh-line"></i>
                </button>
                <button class="btn btn-icon btn-primary btn-wave me-0">
                    <i class="ri-filter-3-line"></i>
                </button>
            </div>
        </div>
    </div>
    <!-- End::page-header -->
    <!-- Start:: row-1 -->
    <div class="row">
        <div class="col-xxl-9">
            <div class="row">
                <div class="col-xl-3">
                    <div class="row">
                        <div class='col-xl-12 col-md-6' v-for='(idx, index) in salesData.SalesCard' :key='index'>
                            <SpkReusebleJobs titleClass="fs-13 fw-medium mb-0" :listCard="true"
                                :cardClass="`card ${idx.cardClass}`" :list="idx" :NoCountUp="true" />
                        </div>
                        <!-- <SalesCard :dashboardCards="salesData.dashboardCards" /> -->
                    </div>
                </div>
                <div class="col-xl-9">
                    <div class="card custom-card">
                        <div class="card-header justify-content-between">
                            <div class="card-title">
                                Sales Overview
                            </div>
                            <div class="btn-group btn-group-sm" role="group" aria-label="Basic example">
                                <button type="button"
                                    class="btn btn-primary btn-wave waves-effect waves-light">Day</button>
                                <button type="button"
                                    class="btn btn-primary-light btn-wave waves-effect waves-light">Week</button>
                                <button type="button"
                                    class="btn btn-primary-light btn-wave waves-effect waves-light">Month</button>
                                <button type="button"
                                    class="btn btn-primary-light btn-wave waves-effect waves-light">Year</button>
                            </div>
                        </div>
                        <div class="card-body pb-0 pt-5">
                            <div id="sales-overview">
                                <apexchart height="348px" type="line" :options="salesData.overviewoptions"
                                    :series="salesData.overviewseries" />
                            </div>
                        </div>
                        <div class="card-footer bg-light p-0">
                            <div class="row g-0 w-100">
                                <div class="col-sm-4 border-sm-end">
                                    <div class="p-3 text-center">
                                        <span class="d-block text-muted mb-1">Total Orders</span>
                                        <h6 class="fw-semibold mb-0">15,535</h6>
                                    </div>
                                </div>
                                <div class="col-sm-4 border-sm-end">
                                    <div class="p-3 text-center">
                                        <span class="d-block text-muted mb-1">Total Sales</span>
                                        <h6 class="fw-semibold mb-0">21,754</h6>
                                    </div>
                                </div>
                                <div class="col-sm-4">
                                    <div class="p-3 text-center">
                                        <span class="d-block text-muted mb-1">Revenue Earned</span>
                                        <h6 class="fw-semibold mb-0">$1.8M</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-xxl-3">
            <div class="row">
                <div class="col-xl-12">
                    
                </div>
                <div class="col-xl-12">
                    <div class="card custom-card">
                        <div class="card-header justify-content-between">
                            <div class="card-title">
                                Visitors By Device
                            </div>
                            <a href="javascript:void(0);" class="fs-12 text-muted text-decoration-underline">View
                                Report <i class="ti ti-arrow-narrow-right"></i></a>
                        </div>
                        <div class="card-body pb-0">
                            <div id="visitors-report">
                                <apexchart height="284px" type="radar" :options="salesData.visitorsoptions"
                                    :series="salesData.visitorsseries" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- End:: row-1 -->

    <!-- Start:: row-2 -->
    <div class="row">
        <div class="col-xxl-3 col-md-6">
            <div class="card custom-card overflow-hidden">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Top Selling Products
                    </div>
                    <a href="javascript:void(0);" class="text-muted fs-12 text-decoration-underline">View All<i
                            class="ti ti-arrow-narrow-right"></i></a>
                </div>
                <div class="card-body p-0">
                    <ul class="list-group list-group-flush">
                        <li v-for="(product, index) in salesData.topSellingProducts" :key="index"
                            class="list-group-item">
                            <div class="d-flex align-items-center gap-3">
                                <div class="lh-1">
                                    <span class="avatar avatar-lg bg-light border border-dashed p-1">
                                        <img :src="product.image" :alt="product.title">
                                    </span>
                                </div>
                                <div class="flex-fill">
                                    <span class="fw-semibold mb-1 d-block">{{ product.title }}</span>
                                    <div class="d-flex align-items-center gap-2 fw-medium">
                                        <div class="fs-12 text-muted">{{ product.price }}</div>
                                        <div class="vr"></div>
                                        <span :class="product.stockClass + ' fs-12'">
                                            <i class="ri-circle-fill me-1 fs-7 align-middle"></i>{{
                                                product.stockStatus }}
                                        </span>
                                    </div>
                                </div>
                                <div class="text-end">
                                    <span class="d-block fw-semibold">{{ product.sales }}</span>
                                    <span class="fs-12 d-block text-muted">Sales</span>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="col-xxl-3 col-md-6">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Recent Activity
                    </div>
                    <a href="javascript:void(0);" class="text-muted fs-12 text-decoration-underline">View All<i
                            class="ti ti-arrow-narrow-right"></i></a>
                </div>
                <div class="card-body px-5">
                    <ul class="list-unstyled recent-activity-list">
                        <li v-for="(activity, i) in salesData.recentActivities" :class="activity.liclass" :key="i">
                            <div class="recent-activity-time text-end">
                                <span class="fw-semibold d-block">{{ activity.date }}</span>
                                <span class="d-block text-muted fs-12">{{ activity.time }}</span>
                            </div>
                            <div>
                                <span class="d-block fs-13 mt-0">
                                    <template v-for="(part, idx) in activity.descriptionParts" :key="idx">
                                        <span :class="part.class">{{ part.text }}</span>
                                    </template>
                                </span>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="col-xxl-3 col-xl-6">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Top Customers
                    </div>
                    <a href="javascript:void(0);" class="text-muted fs-12 text-decoration-underline">View All<i
                            class="ti ti-arrow-narrow-right"></i></a>
                </div>
                <div class="card-body">
                    <ul class="list-unstyled top-customers-list">
                        <li v-for="(user, index) in salesData.topCustomers" :key="index">
                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                <div class="lh-1">
                                    <span :class="user.avatarClass">
                                        {{ user.initials }}
                                    </span>
                                </div>
                                <div class="flex-fill">
                                    <span class="d-block fw-semibold">{{ user.name }}</span>
                                    <span class="fs-11 text-muted">{{ user.email }}</span>
                                </div>
                                <div class="text-end">
                                    <div :class="user.spentClass">{{ user.spentAmount }}</div>
                                    <span class="fs-12 text-muted">{{ user.spentLabel }}</span>
                                </div>
                            </div>
                        </li>
                    </ul>

                </div>
            </div>
        </div>
        <div class="col-xxl-3 col-xl-6">
            <div class="card custom-card overflow-hidden">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Top User Channels
                    </div>
                    <div class="dropdown">
                        <a aria-label="anchor" href="javascript:void(0);" class="btn btn-icon btn-sm btn-light"
                            data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="ri-more-2-fill"></i>
                        </a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="javascript:void(0);">Week</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0);">Month</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0);">Year</a></li>
                        </ul>
                    </div>
                </div>
                <div class="card-body">
                    <ul class="list-unstyled top-user-channels-list">
                        <li v-for="(company, index) in salesData.userChannels" :key="index">
                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                <div class="lh-1">
                                    <span :class="company.avatarClass">
                                        <img :src="company.imgSrc" alt="" />
                                    </span>
                                </div>
                                <div class="flex-fill">
                                    <span class="d-block fw-semibold">{{ company.name }}</span>
                                    <span class="text-muted fs-12">{{ company.subtitle }}</span>
                                </div>
                                <div class="text-end">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span :class="['fs-12', 'fw-medium', company.arrowColorClass]">
                                            <i :class="company.arrowClass"></i>{{ company.percent }}
                                        </span>
                                        <div class="fw-semibold">{{ company.count }}</div>
                                    </div>
                                    <div :class="company.progressBgClass" role="progressbar" aria-valuenow="75"
                                        aria-valuemin="0" aria-valuemax="100">
                                        <div :class="company.progressBarClass"
                                            :style="{ width: company.progressWidth }"></div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <!-- End:: row-2 -->

    <!-- Start:: row-3 -->
    <div class="row">
        <div class="col-xl-8">
            <div class="card custom-card overflow-hidden">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Recent Invoices
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        <div class="dropdown">
                            <a href="javascript:void(0);"
                                class="btn btn-outline-light btn-wave waves-effect waves-light"
                                data-bs-toggle="dropdown" aria-expanded="false">Filters<i
                                    class="ri-arrow-down-s-line align-middle ms-1 d-inline-block"></i> </a>
                            <ul class="dropdown-menu" role="menu">
                                <li><a class="dropdown-item" href="javascript:void(0);">New</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0);">Popular</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0);">Relevant</a></li>
                            </ul>
                        </div>
                        <div>
                            <input class="form-control" type="text" placeholder="Search Here"
                                aria-label=".form-control-sm example">
                        </div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <TableComponent tableClass="table text-nowrap table-hover" :showCheckbox="true"
                        :headers="[{ text: 'ID' }, { text: 'Customer' }, { text: '	Ordered Date' }, { text: 'Items' }, { text: 'Price' }, { text: 'Status' }, { text: 'Actions' }]"
                        :rows="salesData.orders" v-slot:cell="{ row }">
                        <td :class="row.tableClass">{{ row.orderId }}</td>
                        <td :class="row.tableClass">
                            <div class="d-flex align-items-center gap-2">
                                <div class="lh-1">
                                    <span :class="['avatar avatar-sm avatar-rounded', row.user.avatarClass]">
                                        {{ row.user.initials }}
                                    </span>
                                </div>
                                <div>
                                    <span class="d-block fw-semibold">{{ row.user.name }}</span>
                                    <span class="fs-12 d-block text-muted">{{ row.user.email }}</span>
                                </div>
                            </div>
                        </td>
                        <td :class="row.tableClass">
                            <div>
                                {{ row.date }}
                            </div>
                            <div class="text-muted fs-12">
                                {{ row.time }}
                            </div>
                        </td>
                        <td :class="row.tableClass">
                            <div class="avatar-list-stacked">
                                <span v-for="(image, index) in row.avatars" :key="index"
                                    class="avatar avatar-rounded avatar-sm bg-light" data-bs-toggle="tooltip"
                                    data-bs-placement="top" data-bs-title="Mikon Camera"
                                    data-bs-custom-class="tooltip-primary">
                                    <img :src="image.src" :alt="image.alt">
                                </span>
                            </div>
                        </td>
                        <td :class="row.tableClass">
                            {{ row.amount }}
                        </td>
                        <td :class="row.tableClass">
                            <span :class="row.badge.class">{{ row.badge.text }}</span>
                        </td>
                        <td :class="row.tableClass">
                            <div class="dropdown">
                                <a aria-label="anchor" href="javascript:void(0);"
                                    class="btn btn-icon btn-sm btn-light border" data-bs-toggle="dropdown"
                                    aria-expanded="false"> <i class="ri-more-2-fill"></i> </a>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                class="ri-eye-line me-2"></i>View</a></li>
                                    <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                class="ri-pencil-line me-2"></i>Edit</a></li>
                                    <li><a class="dropdown-item" href="javascript:void(0);"><i
                                                class="ri-delete-bin-line me-2"></i>Delete</a></li>
                                </ul>
                            </div>
                        </td>
                    </TableComponent>

                </div>
                <div class="card-footer">
                    <div class="d-flex align-items-center flex-wrap">
                        <div> Showing 5 Entries <i class="bi bi-arrow-right ms-2 fw-semibold"></i> </div>
                        <div class="ms-auto">
                            <nav aria-label="Page navigation" class="pagination-style-2">
                                <ul class="pagination mb-0 flex-wrap">
                                    <li class="page-item disabled">
                                        <a class="page-link" href="javascript:void(0);">
                                            Prev
                                        </a>
                                    </li>
                                    <li class="page-item"><a class="page-link" href="javascript:void(0);">1</a></li>
                                    <li class="page-item active"><a class="page-link" href="javascript:void(0);">2</a>
                                    </li>
                                    <li class="page-item">
                                        <a class="page-link" href="javascript:void(0);">
                                            <i class="bi bi-three-dots"></i>
                                        </a>
                                    </li>
                                    <li class="page-item"><a class="page-link" href="javascript:void(0);">17</a>
                                    </li>
                                    <li class="page-item">
                                        <a class="page-link text-primary" href="javascript:void(0);">
                                            next
                                        </a>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-xl-4">
            <div class="card custom-card overflow-hidden">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Recent Transactions
                    </div>
                    <div class="dropdown">
                        <a aria-label="anchor" href="javascript:void(0);" class="btn btn-icon btn-light border"
                            data-bs-toggle="dropdown" aria-expanded="false"> <i class="ri-more-2-fill"></i>
                        </a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="javascript:void(0);">Week</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0);">Month</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0);">Year</a></li>
                        </ul>
                    </div>
                </div>
                <div class="card-body p-0">
                    <TableComponent tableClass="table text-nowrap"
                        :headers="[{ text: 'Order' }, { text: 'Price' }, { text: 'Products', thClass: 'text-end' },]"
                        :rows="salesData.recentTransactions" v-slot:cell="{ row }">
                        <td :class="row.tdClass">
                            <div class="flex-fill">
                                <div><span class="fw-semibold">Order Id</span> - {{ row.orderId }}</div>
                                <div class="d-flex align-items-center gap-2 fw-medium">
                                    <div class="fs-12 text-muted">{{ row.itemCount }}</div>
                                    <div class="vr"></div>
                                    <span :class="row.status.class"><i :class="row.status.icon"></i>{{ row.status.text
                                    }}</span>
                                </div>
                            </div>
                        </td>
                        <td :class="row.tdClass">
                            <div>
                                <span class="d-block fw-semibold">{{ row.amount }}</span>
                                <span class="d-block fs-12 text-muted">{{ row.date }}</span>
                            </div>
                        </td>
                        <td :class="row.tdClass">
                            <div class="avatar-list-stacked text-end">
                                <span v-for="(image, index) in row.avatars" :key="index"
                                    class="avatar avatar-rounded avatar-sm me-2 bg-light">
                                    <img :src="image.src" :alt="image.alt">

                                </span>
                                <span v-if="row.count">
                                    <a class="avatar bg-primary avatar-rounded avatar-sm" href="javascript:void(0);">
                                        {{ row.count }}
                                    </a>
                                </span>
                            </div>
                        </td>
                    </TableComponent>
                </div>
            </div>
        </div>
    </div>
    <!-- End:: row-3 -->
</template>

<style scoped>
/* Add your styles here */
</style>
