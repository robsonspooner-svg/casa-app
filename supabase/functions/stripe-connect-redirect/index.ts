// Stripe Connect Redirect - Supabase Edge Function
// Serves as an HTTPS redirect endpoint for Stripe Account Links.
//
// Stripe's Account Links API requires refresh_url and return_url to be
// valid HTTPS URLs. Mobile apps use custom URL schemes (casa-owner://)
// which Stripe doesn't accept. This function bridges the gap:
//   1. Stripe redirects the browser to this HTTPS endpoint
//   2. This endpoint redirects to the app's custom URL scheme
//   3. The app receives the deep link and handles the return

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'return'; // 'return' or 'refresh'

  // Deep link back into the owner app
  const appScheme = 'casa-owner://payments/onboard';
  const deepLink = type === 'refresh'
    ? `${appScheme}?refresh=true`
    : `${appScheme}?success=true`;

  // Return an HTML page that immediately redirects to the app deep link.
  // This works because SFSafariViewController / Chrome Custom Tabs can
  // handle custom URL scheme redirects from page navigation.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting to Casa...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #F8F7F4;
      color: #1a1a1a;
      text-align: center;
    }
    .container { padding: 2rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.9rem; }
    a {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #1a1a1a;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Returning to Casa...</h1>
    <p>You should be redirected automatically.</p>
    <a href="${deepLink}">Open Casa App</a>
  </div>
  <script>
    // Try to redirect immediately
    window.location.href = "${deepLink}";
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
