// Mission 13: Manual Expenses Hook
// CRUD for owner manual expenses (insurance, rates, strata, etc.)

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type {
  ManualExpenseRow,
  ManualExpenseInsert,
  ManualExpenseUpdate,
  ExpenseCategoryRow,
  ExpenseCategoryInsert,
} from '../types/database';

export interface ExpensesFilter {
  propertyId?: string;
  isTaxDeductible?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpensesState {
  expenses: ManualExpenseRow[];
  categories: ExpenseCategoryRow[];
  totalExpenses: number;
  loading: boolean;
  error: string | null;
}

export function useExpenses(filter?: ExpensesFilter) {
  const [state, setState] = useState<ExpensesState>({
    expenses: [],
    categories: [],
    totalExpenses: 0,
    loading: true,
    error: null,
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build expenses query
      let expenseQuery = (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('expense_date', { ascending: false });

      if (filter?.propertyId) {
        expenseQuery = expenseQuery.eq('property_id', filter.propertyId);
      }
      if (filter?.isTaxDeductible !== undefined) {
        expenseQuery = expenseQuery.eq('is_tax_deductible', filter.isTaxDeductible);
      }
      if (filter?.dateFrom) {
        expenseQuery = expenseQuery.gte('expense_date', filter.dateFrom);
      }
      if (filter?.dateTo) {
        expenseQuery = expenseQuery.lte('expense_date', filter.dateTo);
      }

      // Fetch expenses and categories in parallel
      const [expensesResult, categoriesResult] = await Promise.all([
        expenseQuery,
        (supabase.from('expense_categories') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (expensesResult.error) throw expensesResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const expenses = (expensesResult.data as ManualExpenseRow[]) || [];
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      setState({
        expenses,
        categories: (categoriesResult.data as ExpenseCategoryRow[]) || [],
        totalExpenses,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load expenses',
      }));
    }
  }, [filter?.propertyId, filter?.isTaxDeductible, filter?.dateFrom, filter?.dateTo]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Mutations
  const addExpense = useCallback(async (input: Omit<ManualExpenseInsert, 'owner_id'>) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>)
      .insert({ ...input, owner_id: user.id })
      .select()
      .single();
    if (error) throw error;
    await fetchExpenses();
    return data as ManualExpenseRow;
  }, [fetchExpenses]);

  const updateExpense = useCallback(async (id: string, updates: ManualExpenseUpdate) => {
    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>)
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    await fetchExpenses();
  }, [fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchExpenses();
  }, [fetchExpenses]);

  const addCategory = useCallback(async (input: Omit<ExpenseCategoryInsert, 'owner_id'>) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase.from('expense_categories') as ReturnType<typeof supabase.from>)
      .insert({ ...input, owner_id: user.id })
      .select()
      .single();
    if (error) throw error;
    await fetchExpenses();
    return data as ExpenseCategoryRow;
  }, [fetchExpenses]);

  return {
    ...state,
    refreshExpenses: fetchExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
  };
}
