import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { MinedProfile, MinedPost } from '../types/database';
import toast from 'react-hot-toast';
import { extractAnalysisFromCaption } from '../lib/analysisExtractor';

interface BusinessDiscoveryResult {
  profile: {
    username: string;
    name: string;
    followers_count: number;
    media_count: number;
    profile_picture_url: string;
  };
  media: Array<{
    id: string;
    caption?: string;
    like_count?: number;
    comments_count?: number;
    media_type?: string;
    permalink: string;
    timestamp?: string;
    thumbnail_url?: string;
  }>;
}

interface BusinessDiscoveryError {
  error: string;
  details?: unknown;
}

function isBusinessDiscoveryError(
  data: BusinessDiscoveryResult | BusinessDiscoveryError
): data is BusinessDiscoveryError {
  return 'error' in data;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const defaultMessage = 'Erro ao chamar função';
  const maybeError = error as { message?: string; context?: unknown };

  try {
    const ctx = maybeError.context;
    if (ctx && typeof (ctx as Response).clone === 'function') {
      const body = await (ctx as Response).clone().json().catch(() => null) as { error?: string } | null;
      if (body?.error) return body.error;
    }
  } catch {
    // context não é um Response — ignora
  }

  return maybeError.message || defaultMessage;
}

export function useMining() {
  const { user } = useAuth();
  const [searchLoading, setSearchLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [profileResult, setProfileResult] = useState<BusinessDiscoveryResult | null>(null);
  const [savedProfile, setSavedProfile] = useState<MinedProfile | null>(null);
  const [savedPosts, setSavedPosts] = useState<MinedPost[]>([]);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);

  const saveProfile = useCallback(async (profileData: BusinessDiscoveryResult) => {
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('mined_profiles')
      .upsert({
        user_id: user.id,
        ig_username: profileData.profile.username,
        display_name: profileData.profile.name,
        followers_count: profileData.profile.followers_count,
        media_count: profileData.profile.media_count,
        profile_picture_url: profileData.profile.profile_picture_url,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,ig_username' })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar perfil');
      console.error(error);
      return null;
    }

    setSavedProfile(profile);

    if (profileData.media.length > 0 && profile) {
      const avgLikes = profileData.media.reduce((sum, m) => sum + (m.like_count || 0), 0) / profileData.media.length;
      const avgComments = profileData.media.reduce((sum, m) => sum + (m.comments_count || 0), 0) / profileData.media.length;

      await supabase
        .from('mined_profiles')
        .update({ avg_likes: avgLikes, avg_comments: avgComments })
        .eq('id', profile.id);

      const posts = profileData.media.map(m => {
        const analysis = m.caption ? extractAnalysisFromCaption(m.caption) : null;
        return {
          mined_profile_id: profile.id,
          ig_media_id: m.id,
          permalink: m.permalink,
          media_type: m.media_type || null,
          caption: m.caption || null,
          like_count: m.like_count || 0,
          comments_count: m.comments_count || 0,
          posted_at: m.timestamp || null,
          thumbnail_url: m.thumbnail_url || null,
          performance_ratio: avgLikes > 0 ? (m.like_count || 0) / avgLikes : null,
          transcript_source: m.caption ? 'caption' : 'none',
          transcript: m.caption || null,
          analysis: analysis,
          is_analyzed: !!analysis,
        };
      });

      const { data: savedPostsData, error: postsError } = await supabase
        .from('mined_posts')
        .insert(posts)
        .select();

      if (postsError) {
        console.error(postsError);
      }

      setSavedPosts(savedPostsData || []);
    }

    toast.success('Perfil salvo com sucesso!');
    return profile;
  }, [user]);

  const searchProfile = useCallback(async (username: string) => {
    if (!user) return;
    setSearchLoading(true);
    setProfileResult(null);

    try {
      const { data: connection } = await supabase
        .from('instagram_connections')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!connection) {
        toast.error('Conecte sua conta Instagram primeiro em Configurações');
        return;
      }

      const { data, error } = await supabase.functions.invoke<
        BusinessDiscoveryResult | BusinessDiscoveryError
      >('instagram-business-discovery', {
        body: { username },
      });

      if (error) {
        console.error('Business Discovery function error:', error);
        toast.error(await getFunctionErrorMessage(error));
        return;
      }

      if (!data) {
        toast.error('A API nao retornou dados do perfil');
        return;
      }

      if (isBusinessDiscoveryError(data)) {
        console.error('Business Discovery API error:', data);
        toast.error(data.error || 'Erro ao minerar perfil no Instagram');
        return;
      }

      setProfileResult(data);
      await saveProfile(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar perfil');
    } finally {
      setSearchLoading(false);
    }
  }, [saveProfile, user]);

  const loadSavedProfiles = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('mined_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      return data || [];
    } catch (err) {
      console.error('Fetch error:', err);
      return [];
    }
  }, [user]);

  const loadProfilePosts = useCallback(async (profileId: string) => {
    setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mined_posts')
        .select('*')
        .eq('mined_profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      setSavedPosts(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setSavedPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const analyzePost = useCallback(async (postId: string) => {
    const post = savedPosts.find(p => p.id === postId);
    setAnalyzingPostId(postId);

    try {
      // Transcrição real → IA (vale a pena)
      if (post?.transcript_source === 'whisper' && post.transcript) {
        const { data, error } = await supabase.functions.invoke('ai-analyze', {
          body: { postId },
        });
        if (error) throw new Error(await getFunctionErrorMessage(error));
        if (data?.error) throw new Error(data.error);
        setSavedPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, is_analyzed: true, analysis: data.analysis } : p
        ));
      } else {
        // Só legenda → extração por código (instantânea, gratuita)
        const caption = post?.caption || '';
        if (!caption.trim()) {
          toast.error('Este post não tem legenda para analisar.');
          return;
        }
        const analysis = extractAnalysisFromCaption(caption);
        const { error } = await supabase
          .from('mined_posts')
          .update({ analysis, is_analyzed: true })
          .eq('id', postId);
        if (error) throw new Error('Erro ao salvar análise no banco.');
        setSavedPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, is_analyzed: true, analysis } : p
        ));
      }

      toast.success('Análise concluída!');
    } catch (err: unknown) {
      console.error('Erro na análise:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao analisar o post.');
    } finally {
      setAnalyzingPostId(null);
    }
  }, [savedPosts]);

  const transcribePost = useCallback(async (postId: string, file?: File) => {
    setAnalyzingPostId(postId);
    const toastId = toast.loading(file ? 'Enviando arquivo...' : 'Buscando vídeo via Instagram API...');
    try {
      let response;
      if (file) {
        const formData = new FormData();
        formData.append('post_id', postId);
        formData.append('file', file);
        
        response = await supabase.functions.invoke<{
          ok?: boolean; error?: string; transcript?: string; analysis?: Record<string, unknown>;
        }>('transcribe-video', { body: formData });
      } else {
        response = await supabase.functions.invoke<{
          ok?: boolean; error?: string; transcript?: string; analysis?: Record<string, unknown>;
        }>('transcribe-video', { body: { post_id: postId } });
      }

      const { data, error } = response;

      if (error) { toast.error(await getFunctionErrorMessage(error), { id: toastId }); return; }
      if (data?.error) { toast.error(data.error, { id: toastId }); return; }

      setSavedPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              transcript: data?.transcript ?? null,
              transcript_source: 'whisper',
              is_analyzed: true,
              analysis: (data?.analysis ?? null) as import('../types/database').PostAnalysis | null,
            }
          : p
      ));
      toast.success('Transcrição concluída!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao transcrever', { id: toastId });
    } finally {
      setAnalyzingPostId(null);
    }
  }, []);

  return {
    searchLoading,
    postsLoading,
    profileResult,
    savedProfile,
    savedPosts,
    analyzingPostId,
    searchProfile,
    saveProfile,
    loadSavedProfiles,
    loadProfilePosts,
    analyzePost,
    transcribePost,
  };
}
