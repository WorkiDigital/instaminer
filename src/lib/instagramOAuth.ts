import toast from 'react-hot-toast';

const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'instagram_business_content_publish',
];

export function startInstagramOAuth() {
  const appId = import.meta.env.VITE_META_APP_ID;
  const redirectUri = import.meta.env.VITE_META_REDIRECT_URI;

  if (!appId || !redirectUri) {
    toast.error('Configure VITE_META_APP_ID e VITE_META_REDIRECT_URI no ambiente do front');
    return;
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem('instagram_oauth_state', state);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_SCOPES.join(','),
    state,
    enable_fb_login: '0',
    force_authentication: '1',
  });

  window.location.assign(`https://www.instagram.com/oauth/authorize?${params.toString()}`);
}
