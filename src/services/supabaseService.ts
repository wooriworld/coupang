import { supabase } from './supabase';
import type { ProductRow, UserItem } from 'src/models/order';

export async function loadOrders(
  yyyymm: string,
): Promise<{ products: ProductRow[]; checkedIds: Set<string> } | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('products, checked_ids')
    .eq('yyyymm', yyyymm)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    products: data.products as ProductRow[],
    checkedIds: new Set((data.checked_ids as string[]) ?? []),
  };
}

export async function saveOrders(
  yyyymm: string,
  products: ProductRow[],
  checkedIds: Set<string>,
): Promise<void> {
  const { error } = await supabase.from('orders').upsert({
    yyyymm,
    saved_at: new Date().toISOString(),
    products,
    checked_ids: Array.from(checkedIds),
  });

  if (error) throw new Error(error.message);
}

export async function deleteOrders(yyyymm: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('yyyymm', yyyymm);

  if (error) throw new Error(error.message);
}

export async function listDataMonths(): Promise<{ year: number; month: number }[]> {
  const { data, error } = await supabase.from('orders').select('yyyymm');

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((d) => /^\d{6}$/.test(d.yyyymm as string))
    .map((d) => ({
      year: parseInt((d.yyyymm as string).slice(0, 4), 10),
      month: parseInt((d.yyyymm as string).slice(4, 6), 10),
    }));
}

export async function loadUserItems(yyyymm: string): Promise<UserItem[]> {
  const { data, error } = await supabase
    .from('user_items')
    .select('items')
    .eq('yyyymm', yyyymm)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.items as UserItem[]) ?? [];
}

export async function saveUserItems(yyyymm: string, items: UserItem[]): Promise<void> {
  const { error } = await supabase.from('user_items').upsert({ yyyymm, items });

  if (error) throw new Error(error.message);
}

export async function loadMonthSummaries(
  yyyymms: string[],
): Promise<Map<string, { totalAmount: number; checkedAmount: number }>> {
  const { data, error } = await supabase
    .from('orders')
    .select('yyyymm, products, checked_ids')
    .in('yyyymm', yyyymms);

  if (error) throw new Error(error.message);

  const result = new Map<string, { totalAmount: number; checkedAmount: number }>();
  for (const row of data ?? []) {
    const products = row.products as ProductRow[];
    const checkedSet = new Set((row.checked_ids as string[]) ?? []);
    result.set(row.yyyymm as string, {
      totalAmount: products.reduce((sum, p) => sum + p.price, 0),
      checkedAmount: products
        .filter((p) => checkedSet.has(p.id))
        .reduce((sum, p) => sum + p.price, 0),
    });
  }
  return result;
}
