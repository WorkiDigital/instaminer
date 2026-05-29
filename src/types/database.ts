/* ============================================================
   WORKI CONTENTMINER — Database Types
   Generated from Supabase schema
   ============================================================ */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          brand_name: string | null;
          brand_tone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          brand_name?: string | null;
          brand_tone?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string | null;
          brand_name?: string | null;
          brand_tone?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      instagram_connections: {
        Row: {
          id: string;
          user_id: string;
          ig_user_id: string;
          ig_username: string | null;
          account_type: string | null;
          access_token: string;
          token_expires_at: string | null;
          connected_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ig_user_id: string;
          ig_username?: string | null;
          account_type?: string | null;
          access_token: string;
          token_expires_at?: string | null;
        };
        Update: {
          ig_username?: string | null;
          account_type?: string | null;
          access_token?: string;
          token_expires_at?: string | null;
        };
        Relationships: [];
      };
      target_audiences: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          pain_points: string | null;
          desires: string | null;
          awareness_level: string | null;
          objections: string | null;
          language_tone: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          pain_points?: string | null;
          desires?: string | null;
          awareness_level?: string | null;
          objections?: string | null;
          language_tone?: string | null;
          is_default?: boolean;
        };
        Update: {
          name?: string;
          pain_points?: string | null;
          desires?: string | null;
          awareness_level?: string | null;
          objections?: string | null;
          language_tone?: string | null;
          is_default?: boolean;
        };
        Relationships: [];
      };
      mined_profiles: {
        Row: {
          id: string;
          user_id: string;
          ig_username: string;
          display_name: string | null;
          followers_count: number | null;
          media_count: number | null;
          profile_picture_url: string | null;
          avg_likes: number | null;
          avg_comments: number | null;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ig_username: string;
          display_name?: string | null;
          followers_count?: number | null;
          media_count?: number | null;
          profile_picture_url?: string | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          last_synced_at?: string | null;
        };
        Update: {
          ig_username?: string;
          display_name?: string | null;
          followers_count?: number | null;
          media_count?: number | null;
          profile_picture_url?: string | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          last_synced_at?: string | null;
        };
        Relationships: [];
      };
      mined_posts: {
        Row: {
          id: string;
          mined_profile_id: string;
          ig_media_id: string | null;
          permalink: string;
          media_type: string | null;
          media_product_type: string | null;
          caption: string | null;
          like_count: number | null;
          comments_count: number | null;
          posted_at: string | null;
          thumbnail_url: string | null;
          transcript: string | null;
          transcript_source: string | null;
          analysis: PostAnalysis | null;
          performance_ratio: number | null;
          is_analyzed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          mined_profile_id: string;
          ig_media_id?: string | null;
          permalink: string;
          media_type?: string | null;
          media_product_type?: string | null;
          caption?: string | null;
          like_count?: number | null;
          comments_count?: number | null;
          posted_at?: string | null;
          thumbnail_url?: string | null;
          transcript?: string | null;
          transcript_source?: string | null;
          analysis?: PostAnalysis | null;
          performance_ratio?: number | null;
          is_analyzed?: boolean;
        };
        Update: {
          transcript?: string | null;
          transcript_source?: string | null;
          analysis?: PostAnalysis | null;
          performance_ratio?: number | null;
          is_analyzed?: boolean;
          like_count?: number | null;
          comments_count?: number | null;
          thumbnail_url?: string | null;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          user_id: string;
          status: ContentStatus;
          position: number;
          source_mined_post_id: string | null;
          source_analysis: PostAnalysis | null;
          target_audience_id: string | null;
          title: string | null;
          generated_script: string | null;
          funnel_stage: FunnelStage | null;
          hook: string | null;
          headline: string | null;
          cta: string | null;
          video_storage_path: string | null;
          ig_media_id: string | null;
          posted_permalink: string | null;
          posted_at: string | null;
          publish_method: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: ContentStatus;
          position?: number;
          source_mined_post_id?: string | null;
          source_analysis?: PostAnalysis | null;
          target_audience_id?: string | null;
          title?: string | null;
          generated_script?: string | null;
          funnel_stage?: FunnelStage | null;
          hook?: string | null;
          headline?: string | null;
          cta?: string | null;
          video_storage_path?: string | null;
        };
        Update: {
          status?: ContentStatus;
          position?: number;
          target_audience_id?: string | null;
          title?: string | null;
          generated_script?: string | null;
          funnel_stage?: FunnelStage | null;
          hook?: string | null;
          headline?: string | null;
          cta?: string | null;
          video_storage_path?: string | null;
          ig_media_id?: string | null;
          posted_permalink?: string | null;
          posted_at?: string | null;
          publish_method?: string | null;
        };
        Relationships: [];
      };
      content_metrics: {
        Row: {
          id: string;
          content_item_id: string;
          snapshot_at: string;
          reach: number | null;
          impressions: number | null;
          likes: number | null;
          comments: number | null;
          saves: number | null;
          shares: number | null;
          video_views: number | null;
          avg_watch_time: number | null;
          raw: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          reach?: number | null;
          impressions?: number | null;
          likes?: number | null;
          comments?: number | null;
          saves?: number | null;
          shares?: number | null;
          video_views?: number | null;
          avg_watch_time?: number | null;
          raw?: Record<string, unknown> | null;
        };
        Update: {
          reach?: number | null;
          impressions?: number | null;
          likes?: number | null;
          comments?: number | null;
          saves?: number | null;
          shares?: number | null;
          video_views?: number | null;
          avg_watch_time?: number | null;
          raw?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* ============================================================
   Domain types
   ============================================================ */

export type ContentStatus = 'idea_bank' | 'modeled' | 'in_production' | 'posted';

export type FunnelStage = 'top' | 'middle' | 'bottom';

export type AwarenessLevel =
  | 'inconsciente'
  | 'consciente_problema'
  | 'consciente_solucao'
  | 'consciente_produto';

export type TranscriptSource = 'caption' | 'public' | 'manual_upload' | 'whisper' | 'none';

export type HookTechnique =
  | 'pergunta'
  | 'afirmacao_polemica'
  | 'numero'
  | 'promessa'
  | 'quebra_de_padrao';

export type BodyStructure =
  | 'lista'
  | 'passo-a-passo'
  | 'antes-depois'
  | 'mito-vs-verdade'
  | 'narrativa';

export type CTAType = 'explicito' | 'implicito' | 'ausente';

// PostAnalysis é JSONB — aceita strings livres (extrator de código + IA)
export interface PostAnalysis {
  headline: string;
  hook: {
    text: string;
    technique: string;
  };
  promise: string;
  authority_arc: string;
  body_structure: string[] | string;
  cta: {
    text: string;
    type: string;
  };
  funnel_stage: string; // 'TOFU' | 'MOFU' | 'BOFU' (análise) ou 'top'|'middle'|'bottom' (pipeline)
  main_theme: string;
}

/* ============================================================
   Convenience row types
   ============================================================ */

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type InstagramConnection = Database['public']['Tables']['instagram_connections']['Row'];
export type TargetAudience = Database['public']['Tables']['target_audiences']['Row'];
export type TargetAudienceInsert = Database['public']['Tables']['target_audiences']['Insert'];
export type TargetAudienceUpdate = Database['public']['Tables']['target_audiences']['Update'];
export type MinedProfile = Database['public']['Tables']['mined_profiles']['Row'];
export type MinedPost = Database['public']['Tables']['mined_posts']['Row'];
export type ContentItem = Database['public']['Tables']['content_items']['Row'];
export type ContentItemInsert = Database['public']['Tables']['content_items']['Insert'];
export type ContentItemUpdate = Database['public']['Tables']['content_items']['Update'];
export type ContentMetric = Database['public']['Tables']['content_metrics']['Row'];
