<template>
  <div class="summary-bar">
    <!-- 중앙: 금액 + 서브 정보 -->
    <div class="summary-bar__main">
      <span class="summary-bar__meta">
        Total {{ formatAmount(summary.totalAmount) }} &nbsp;·&nbsp; {{ summary.checkedCount }}/{{
          summary.totalCount
        }}
        items checked
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'src/css/summary-bar.css';
import type { OrderSummary } from 'src/models/order';

const props = defineProps<{
  summary: OrderSummary;
  currencyMode?: 'KRW' | 'USD';
  usdKrwRate?: number | null;
}>();

function formatAmount(value: number): string {
  if (props.currencyMode === 'USD') {
    if (!props.usdKrwRate) return '$ -';
    const usdValue = value / props.usdKrwRate;
    return '$ ' + usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₩ ' + value.toLocaleString('ko-KR');
}
</script>
