import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TargetAudience, TargetAudienceInsert, TargetAudienceUpdate } from '../types/database';
import toast from 'react-hot-toast';

export function useAudiences() {
  const { user } = useAuth();
  const [audiences, setAudiences] = useState<TargetAudience[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAudiences = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('target_audiences')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar públicos-alvo');
      console.error(error);
    } else {
      setAudiences(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchAudiences();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchAudiences]);

  const createAudience = async (
    data: Omit<TargetAudienceInsert, 'user_id'>
  ) => {
    if (!user) return;

    // If this is default, unset others first
    if (data.is_default) {
      await supabase
        .from('target_audiences')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { error } = await supabase
      .from('target_audiences')
      .insert({ ...data, user_id: user.id });

    if (error) {
      toast.error('Erro ao criar público-alvo');
      console.error(error);
      return false;
    }

    toast.success('Público-alvo criado!');
    await fetchAudiences();
    return true;
  };

  const updateAudience = async (id: string, data: TargetAudienceUpdate) => {
    if (!user) return;

    if (data.is_default) {
      await supabase
        .from('target_audiences')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { error } = await supabase
      .from('target_audiences')
      .update(data)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar público-alvo');
      console.error(error);
      return false;
    }

    toast.success('Público-alvo atualizado!');
    await fetchAudiences();
    return true;
  };

  const deleteAudience = async (id: string) => {
    const { error } = await supabase
      .from('target_audiences')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir público-alvo');
      console.error(error);
      return false;
    }

    toast.success('Público-alvo excluído');
    await fetchAudiences();
    return true;
  };

  const getDefault = () => audiences.find(a => a.is_default) || audiences[0] || null;

  return {
    audiences,
    loading,
    createAudience,
    updateAudience,
    deleteAudience,
    getDefault,
    refetch: fetchAudiences,
  };
}
