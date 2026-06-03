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

// Vercel Node.js runtime: 默认导出签名为 (req, res) => void
export default async function handler(req, res) {
  // 限制请求方法
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
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

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.status(502).json({
        error: 'GitHub API unavailable',
        status: ghRes.status,
        message: errData.message || ghRes.statusText,
      });
      return;
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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.status(200).json(filtered);
  } catch (err) {
    console.error('[github-repo] fetch failed:', err.message);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
