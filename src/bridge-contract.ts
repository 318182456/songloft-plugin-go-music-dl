// 与 songloft-plugin-bridge 的 contract.ts 保持**算法一致**的最小副本，
// 避免跨插件包依赖。Bridge 对 token 不透明（只透传），本文件仅用于在
// go-music-dl 内部把歌曲元数据打包 / 解包成 URL 安全的 base64url。

/** 契约动作：源插件实现 —— 把不透明 token 解析为真实回源直链（Bridge 调用）。 */
export const ACTION_RESOLVE = 'resolve-stream-url'

/** 契约动作：桥接实现 —— 把 (source, token) 拼成音箱可直连的完整对外 URL。 */
export const ACTION_MAKE_URL = 'make-url'

/** 本插件在 Bridge 侧的 source 路由键（也是 comm 伙伴名）。 */
export const BRIDGE_SOURCE = 'go-music-dl'

function b64encode(s: string): string {
  const btoaFn = (globalThis as any).btoa
  if (typeof btoaFn !== 'function') {
    throw new Error('btoa unavailable in runtime')
  }
  return btoaFn(unescape(encodeURIComponent(s)))
}

function b64decode(s: string): string {
  const atobFn = (globalThis as any).atob
  if (typeof atobFn !== 'function') {
    throw new Error('atob unavailable in runtime')
  }
  return decodeURIComponent(escape(atobFn(s)))
}

/**
 * 把任意对象/字符串编码为 URL 安全的 base64url token（无填充）。
 * 与 Bridge contract 的 encodeToken 算法一致，确保 token 在两端自洽。
 */
export function encodeToken(obj: unknown): string {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj)
  return b64encode(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 解码 base64url token，还原为原始对象。 */
export function decodeToken<T = unknown>(tok: string): T {
  const b64 = tok.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(b64decode(b64))
}

/**
 * Bridge 回源时不能指向回环地址（其 SSRF 检查会拒绝 127.0.0.1 / localhost），
 * 故把 baseUrl 里的回环主机重写为本机在 LAN 上的可达 IP（取第一个网段地址）。
 * 仅当 baseUrl 确为回环时才重写，其余情况原样返回，零破坏。
 */
export async function loopbackToLan(raw: string): Promise<string> {
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
      const addrs = await (globalThis as any).songloft?.plugin?.getNetworkAddresses?.()
      const lan = addrs && addrs[0]
      if (lan) {
        u.hostname = lan
        return u.toString()
      }
    }
  } catch {
    /* 解析失败则原样返回 */
  }
  return raw
}
