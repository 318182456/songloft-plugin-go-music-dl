import type { HTTPRequest, HTTPResponse } from '@songloft/plugin-sdk'
import { getConfig } from './config'
import { buildDownloadUrl } from './client'
import {
  ACTION_RESOLVE,
  decodeToken,
  loopbackToLan,
} from './bridge-contract'
import router from './router'

// 向 miot 注册为「外部搜索源候选」（可选增强）。
// 延迟 + 重试调用，避免与 miot 同时启动时对方尚未就绪的竞态；
// miot 未安装 / host 不支持 comm 时静默跳过，绝不阻塞自身功能。
function registerSearchProviderToMiot(): void {
  let attempts = 0
  const tryRegister = async () => {
    attempts++
    try {
      const comm = (globalThis as any).songloft?.comm
      if (!comm || typeof comm.call !== 'function') return // 旧 host 无 comm
      await comm.call('miot', 'register-search-provider', {
        name: 'GoMusicDL',
        searchPath: '/api/search/topone',
      })
      console.log('[Go Music DL Plugin] 已向 miot 注册搜索源候选')
    } catch (e) {
      if (attempts < 5) {
        setTimeout(tryRegister, 3000)
      } else {
        console.log(
          '[Go Music DL Plugin] miot 未安装/未就绪，放弃注册: ' + String(e),
        )
      }
    }
  }
  setTimeout(tryRegister, 2000)
}

async function onInit(): Promise<void> {
  console.log('[Go Music DL Plugin] Mounted')
  try {
    ;(globalThis as any).songloft.lyrics.registerProvider()
    console.log('[Go Music DL Plugin] registered as lyric provider')
  } catch (e) {
    console.error(
      '[Go Music DL Plugin] failed to register lyric provider',
      String(e),
    )
  }
  registerSearchProviderToMiot()

  // 注册 Bridge 回源解析：Bridge 用 token 问我们要真实直链，由它转发给音箱。
  // 仅当 host 支持 comm 时注册；旧 host 静默跳过，功能零影响。
  const comm = (globalThis as any).songloft?.comm
  if (comm?.onMessage) {
    comm.onMessage(ACTION_RESOLVE, async (payload: any) => {
      const song = decodeToken<any>(payload?.token)
      if (!song?.id || !song?.source) throw new Error('invalid stream token')
      const config = await getConfig()
      // 回环地址会被 Bridge 的 SSRF 检查拒绝，重写成本机 LAN 可达 IP。
      const baseUrl = await loopbackToLan(config.baseUrl)
      // stream=1：实时流，Bridge 会透传 Range 头给上游。
      return { url: buildDownloadUrl(song, baseUrl, false) }
    })
    console.log('[Go Music DL Plugin] registered bridge resolve-stream-url')
  }
}

async function onDeinit(): Promise<void> {
  try {
    ;(globalThis as any).songloft.lyrics.unregisterProvider()
  } catch {
    /* ignore */
  }
  console.log('[Go Music DL Plugin] Unmounted')
}

async function onHTTPRequest(req: HTTPRequest): Promise<HTTPResponse> {
  return await router.handle(req)
}

;(globalThis as any).onInit = onInit
;(globalThis as any).onDeinit = onDeinit
;(globalThis as any).onHTTPRequest = onHTTPRequest
