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
                                <!-- Sales Overview -->
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
    <!-- End:: row-1 -->

    <!-- Start:: row-2 -->
    <div class="row">
        <div class="col-xxl-6 col-md-6">
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
        <div class="col-xxl-6 col-xl-6">
            <div class="card custom-card">
                <div class="card-header justify-content-between">
                    <div class="card-title">
                        Stakeholders 
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
    </div>
    <!-- End:: row-2 -->
</template>

<style scoped>
/* Add your styles here */
</style>
