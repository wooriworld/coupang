<template>
  <div class="card-base section-gap">
    <div class="month-selector__row">
      <div class="month-selector__top-row">
        <!-- DatePicker 트리거 -->
        <div
          class="month-selector__trigger"
          :class="{ 'month-selector__trigger--disabled': loading }"
        >
          <span class="month-selector__value">{{ monthLabel }}</span>
          <q-spinner v-if="loading" color="grey-4" size="11px" class="month-selector__spinner" />
          <q-icon v-else name="keyboard_arrow_down" size="14px" class="month-selector__arrow" />

          <q-popup-proxy
            ref="qDatePopup"
            transition-show="scale"
            transition-hide="scale"
            :disable="loading"
          >
            <div class="month-selector__date-popup">
              <div class="month-selector__year-nav">
                <q-btn
                  flat
                  round
                  dense
                  icon="chevron_left"
                  class="month-selector__year-btn"
                  :disable="popupYear <= 2010"
                  @click.stop="popupYear--"
                />
                <span class="month-selector__year-label">{{ popupYear }}</span>
                <q-btn
                  flat
                  round
                  dense
                  icon="chevron_right"
                  class="month-selector__year-btn"
                  :disable="popupYear >= currentYear"
                  @click.stop="popupYear++"
                />
              </div>
              <div class="month-selector__month-grid">
                <button
                  v-for="(name, idx) in MONTHS"
                  :key="idx"
                  class="month-selector__month-btn"
                  :class="{
                    'month-selector__month-btn--selected':
                      idx + 1 === selectedMonth && popupYear === year,
                    'month-selector__month-btn--has-data': hasMonthData(idx + 1),
                    'month-selector__month-btn--disabled': isMonthDisabled(idx + 1),
                  }"
                  :disabled="isMonthDisabled(idx + 1)"
                  @click="onMonthClick(idx + 1)"
                >
                  {{ name }}
                  <span v-if="hasMonthData(idx + 1)" class="month-selector__month-dot" />
                </button>
              </div>
            </div>
          </q-popup-proxy>
        </div>

        <div class="month-selector__currency-toggle">
          <q-btn-toggle
            v-model="currencyMode"
            unelevated
            no-caps
            dense
            toggle-color="primary"
            :options="[
              { label: 'KRW', value: 'KRW' },
              { label: 'USD', value: 'USD' },
            ]"
          />
          <q-tooltip
            v-model="showRateTooltip"
            no-parent-event
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 8]"
          >
            1 USD = {{ usdKrwRate?.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) }} KRW
          </q-tooltip>
        </div>

        <div class="month-selector__top-actions">
          <q-btn
            v-if="showRefetch"
            class="month-selector__icon-btn month-selector__icon-btn--refresh"
            unelevated
            :loading="isRefetching"
            :disable="isRefetching || isSaving || isFetching"
            icon="refresh"
            @click="emit('refetch')"
          />
          <ChartModal :currency-mode="currencyMode" :usd-krw-rate="usdKrwRate" />
        </div>
      </div>

      <!-- 금액 요약 -->
      <div class="month-selector__amounts">
        <div class="month-selector__amount-item">
          <q-icon name="inventory_2" size="14px" class="month-selector__amount-icon" />
          <span class="month-selector__amount-label">Order</span>
          <span class="month-selector__amount-value month-selector__amount-value--order">{{
            orderAmountLabel
          }}</span>
        </div>
        <div class="month-selector__amount-item">
          <q-icon name="add_shopping_cart" size="14px" class="month-selector__amount-icon" />
          <span class="month-selector__amount-label">Add</span>
          <span class="month-selector__amount-value month-selector__amount-value--add">{{
            userAmountLabel
          }}</span>
        </div>
        <div class="month-selector__amount-item month-selector__amount-item--total">
          <span class="month-selector__amount-label">Total</span>
          <span class="month-selector__amount-value month-selector__amount-value--total">{{
            totalAmountLabel
          }}</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import 'src/css/month-selector.css';
import type { SelectedMonth } from 'src/models/app';
import type { OrderSummary } from 'src/models/order';
import ChartModal from 'components/ChartModal.vue';

const props = defineProps<{
  modelValue: SelectedMonth;
  loading?: boolean;
  monthsWithData?: number[];
  allMonthsWithData?: Map<number, number[]>;
  summary?: OrderSummary;
  userTotal?: number;
  isSaving?: boolean;
  isRefetching?: boolean;
  isFetching?: boolean;
  showRefetch?: boolean;
  hasFetched?: boolean;
}>();

const $q = useQuasar();

const emit = defineEmits<{
  'update:modelValue': [value: SelectedMonth];
  fetch: [];
  save: [];
  refetch: [];
  'currency-change': [value: { mode: 'KRW' | 'USD'; usdKrwRate: number | null }];
}>();

const currentYear = new Date().getFullYear();
const year = ref(props.modelValue.year);
const selectedMonth = ref(props.modelValue.month);
const popupYear = ref(props.modelValue.year);
const qDatePopup = ref<{ hide: () => void }>();
const currencyMode = ref<'KRW' | 'USD'>('KRW');
const usdKrwRate = ref<number | null>(null);
const isFetchingRate = ref(false);
const showRateTooltip = ref(false);
let rateTooltipTimer: ReturnType<typeof setTimeout> | null = null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hasMonthData(month: number): boolean {
  return (props.allMonthsWithData?.get(popupYear.value) ?? []).includes(month);
}

function isMonthDisabled(month: number): boolean {
  return popupYear.value === currentYear && month > new Date().getMonth() + 1;
}

function onMonthClick(month: number) {
  year.value = popupYear.value;
  selectMonth(month);
  qDatePopup.value?.hide();
}
const monthLabel = computed(() => `${MONTHS[selectedMonth.value - 1]} ${year.value}`);

const orderAmountLabel = computed(() => formatCurrencyValue(props.summary?.checkedAmount));

const userAmountLabel = computed(() => formatCurrencyValue(props.userTotal));

const totalAmountLabel = computed(() => {
  const order = props.summary?.checkedAmount;
  const user = props.userTotal;
  if (order === undefined && user === undefined) return '—';
  return formatCurrencyValue((order ?? 0) + (user ?? 0));
});

watch(
  () => props.modelValue,
  (val) => {
    year.value = val.year;
    selectedMonth.value = val.month;
    popupYear.value = val.year;
  },
);

function selectMonth(m: number) {
  selectedMonth.value = m;
  emitUpdate();
  emit('fetch');
}

function emitUpdate() {
  emit('update:modelValue', { year: year.value, month: selectedMonth.value });
}

watch(currencyMode, async (mode) => {
  if (mode !== 'USD') {
    hideRateTooltip();
    return;
  }

  if (usdKrwRate.value) {
    showRateTooltipTemporarily();
    return;
  }

  if (!isFetchingRate.value) {
    await fetchUsdKrwRate();
  }
});

watch(
  [currencyMode, usdKrwRate],
  () => {
    emit('currency-change', {
      mode: currencyMode.value,
      usdKrwRate: usdKrwRate.value,
    });
  },
  { immediate: true },
);

function formatCurrencyValue(value: number | undefined): string {
  if (value === undefined) return '—';
  if (currencyMode.value === 'KRW') return '₩ ' + value.toLocaleString('ko-KR');
  if (!usdKrwRate.value) return '$ -';
  const usdValue = value / usdKrwRate.value;
  return '$ ' + usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchUsdKrwRate() {
  isFetchingRate.value = true;
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('환율 응답 실패');
    const data = (await response.json()) as { rates?: { KRW?: number } };
    const rate = data.rates?.KRW;
    if (!rate) throw new Error('KRW 환율 없음');
    usdKrwRate.value = rate;
    showRateTooltipTemporarily();
  } catch {
    currencyMode.value = 'KRW';
    $q.notify({
      type: 'warning',
      message: 'USD 환율을 가져오지 못해 원화로 표시합니다.',
    });
  } finally {
    isFetchingRate.value = false;
  }
}

function hideRateTooltip() {
  showRateTooltip.value = false;
  if (rateTooltipTimer) {
    clearTimeout(rateTooltipTimer);
    rateTooltipTimer = null;
  }
}

function showRateTooltipTemporarily() {
  if (!usdKrwRate.value) return;
  hideRateTooltip();
  showRateTooltip.value = true;
  rateTooltipTimer = setTimeout(() => {
    showRateTooltip.value = false;
    rateTooltipTimer = null;
  }, 3000);
}

onBeforeUnmount(() => {
  hideRateTooltip();
});

onMounted(() => {
  // Always start with KRW selected on first render.
  currencyMode.value = 'KRW';
  usdKrwRate.value = null;
});
</script>
