/**
 * Vercel Serverless Function — GitHub 仓库数据代理
 *
 * 作为 GitHub API 的中间代理层：
 *  - 服务端持有 GITHUB_TOKEN，享受 5000 req/hr 的高速率
 *  - 通过 CDN 缓存减少对 GitHub API 的重复调用
 *  - 客户端调用 /api/github-repo 即可获取最新数据
 *
 * 响应头 Cache-Control 控制 Vercel CDN 缓存策略：
 *  - s-maxage=300：CDN 层缓存 5 分钟
 *  - stale-while-revalidate=60：缓存过期后 60 秒内仍返回旧数据，同时后台刷新
 */

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'tech-MeLD';
const GITHUB_REPO = process.env.GITHUB_REPO || 'LiteASCII';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const REPO_PATH = `${GITHUB_USERNAME}/${GITHUB_REPO}`;
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_PATH}`;

export default async function handler(request) {
  // 限制请求方法
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fetchHeaders = {
    'User-Agent': 'LiteASCII-Vercel-Proxy',
    Accept: 'application/vnd.github.v3+json',
  };

  if (GITHUB_TOKEN) {
    fetchHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const ghRes = await fetch(GITHUB_API_URL, { headers: fetchHeaders });

    if (!ghRes.ok) {
      const errData = await ghRes.json().catch(() => ({}));
      console.error(
        `[github-repo] GitHub API error ${ghRes.status}: ${errData.message || ghRes.statusText}`,
      );
      return new Response(
        JSON.stringify({
          error: 'GitHub API unavailable',
          status: ghRes.status,
          message: errData.message || ghRes.statusText,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            // 错误时缓存较短时间，避免长时间返回错误
            'Cache-Control': 'public, s-maxage=60',
          },
        },
      );
    }

    const data = await ghRes.json();

    // 只返回前端需要的字段，减小响应体积
    const filtered = {
      name: data.name,
      full_name: data.full_name,
      html_url: data.html_url,
      description: data.description,
      language: data.language,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      updated_at: data.updated_at,
    };

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // CDN 缓存 5 分钟，过期后 60 秒内仍返回旧数据并后台刷新
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[github-repo] fetch failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: err.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=30',
        },
      },
    );
  }
}
