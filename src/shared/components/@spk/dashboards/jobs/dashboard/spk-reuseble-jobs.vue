<script>
import CountUp from 'vue-countup-v3'

export default {
    props: {
        list: Object,
        jobsCard: Boolean,
        cardClass: String,
        bodyClass: String,
        listCard:Boolean,
        titleClass:String,
        NoCountUp:Boolean,
        CountUp:Boolean
    },
    components: {
        CountUp
    }
}
</script>

<template>
<div :class="`custom-card ${cardClass}`">
    <div :class="`card-body ${bodyClass}`">
        <!-- Top Row: Icon Left, Title Right (or justified between) -->
        <div class="d-flex justify-content-between">
            <div class="mb-2">
                <span :class="`avatar avatar-md bg-${list.priceColor}-transparent svg-${list.priceColor}`" v-html="list.svgIcon">
                </span>
            </div>
            <span class="fs-16 fw-bold">{{ list.title }}</span>
        </div>

        <!-- Bottom Row: Stats Left, Chart Right -->
        <div class="d-flex align-items-center justify-content-between">
            <div>
                <!-- Count value -->
                <span class="fs-20 fw-medium mb-0 d-flex align-items-center">
                     <span class="count-up" v-if="NoCountUp">{{ list.count }}</span>
                     <span class="count-up" v-if="CountUp"><count-up :end-val="list.count" /></span>{{ list.countK ? 'K' :'' }}
                </span>
                
                <!-- Percentage / Small text -->
                <span :class="`fs-13 text-muted ${list.smallText}`">
                     <!-- We can reuse the existing icon/percent logic or simplify if user just wants text. 
                          The snippet had sales.inc. I will try to rebuild the existing percent block here visually. -->
                     <span :class="`text-${list.iconColor} me-1 d-inline-block ${list.percentColor}`">
                        <i :class="list.icon"></i>
                        {{ list.percent }}
                     </span>
                     <span class="monthly-percent">this month</span>
                </span>
            </div>
            
            <!-- Chart ID container -->
            <div v-if="list.chartOptions && list.chartSeries" :id="list.id">
                <apexchart :height="`${list.height}px`" :width="`${list.width}px`" :type="list.type" :options="list.chartOptions" :series="list.chartSeries" />
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
/* Add any necessary styles here */
</style>
