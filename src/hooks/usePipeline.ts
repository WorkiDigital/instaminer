import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ContentItem, ContentItemInsert, ContentItemUpdate, ContentStatus } from '../types/database';
import toast from 'react-hot-toast';

export function usePipeline() {
  const { user } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) {
        toast.error('Erro ao carregar pipeline');
        console.error(error);
      } else {
        setItems(data || []);
      }
    } catch (err) {
      console.error('Pipeline fetch error:', err);
      toast.error('Erro de conexão ao carregar pipeline');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchItems();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchItems]);

  // Group items by status
  const columns: Record<ContentStatus, ContentItem[]> = {
    idea_bank: items.filter(i => i.status === 'idea_bank'),
    modeled: items.filter(i => i.status === 'modeled'),
    in_production: items.filter(i => i.status === 'in_production'),
    posted: items.filter(i => i.status === 'posted'),
  };

  const moveItem = async (itemId: string, newStatus: ContentStatus) => {
    // Optimistic update
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    );

    const { error } = await supabase
      .from('content_items')
      .update({ status: newStatus })
      .eq('id', itemId);

    if (error) {
      toast.error('Erro ao mover card');
      console.error(error);
      await fetchItems(); // Revert on error
      return false;
    }
    return true;
  };

  const createItem = async (data: Omit<ContentItemInsert, 'user_id'> = {}) => {
    if (!user) return null;

    const maxPosition = items
      .filter(i => i.status === (data.status || 'idea_bank'))
      .reduce((max, i) => Math.max(max, i.position), -1);

    const { data: newItem, error } = await supabase
      .from('content_items')
      .insert({
        user_id: user.id,
        status: 'idea_bank',
        position: maxPosition + 1,
        ...data,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar item');
      console.error(error);
      return null;
    }

    toast.success('Item adicionado ao Banco de Ideias!');
    await fetchItems();
    return newItem;
  };

  const updateItem = async (id: string, data: ContentItemUpdate) => {
    const { error } = await supabase
      .from('content_items')
      .update(data)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar item');
      console.error(error);
      return false;
    }

    await fetchItems();
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir item');
      console.error(error);
      return false;
    }

    toast.success('Item excluído');
    await fetchItems();
    return true;
  };

  return {
    items,
    columns,
    loading,
    moveItem,
    createItem,
    updateItem,
    deleteItem,
    refetch: fetchItems,
  };
}
