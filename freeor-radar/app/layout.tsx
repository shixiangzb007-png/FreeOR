import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { LangProvider } from '@/lib/i18n/lang-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'FreeOR Radar — OpenRouter 免费模型实时雷达',
  description: '实时发现 OpenRouter 最新免费 AI 模型 + 视频生成智能助手。零成本使用顶级 AI。',
  keywords: ['OpenRouter', '免费AI', '免费模型', 'LLM', '视频生成', 'AI工具'],
  openGraph: {
    title: 'FreeOR Radar',
    description: '一键发现 OpenRouter 最新免费资源',
    type: 'website',
    url: 'https://freeor.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreeOR Radar',
    description: '实时 OpenRouter 免费模型雷达',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app'),
};

// themeColor 必须放在 viewport export（Next.js 16 规范）
export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      {/* suppressHydrationWarning: 防止浏览器扩展修改 body class 导致的 hydration mismatch */}
      <body className={`${inter.variable} font-sans bg-[#0a0a0a] text-white antialiased`} suppressHydrationWarning>
        {/* P2: LangProvider 包裹全局，支持中英双语切换 */}
        <LangProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar — hidden on mobile */}
            <aside
              className="hidden lg:flex flex-col flex-shrink-0 border-r border-white/5"
              style={{ width: 'var(--sidebar-width)' }}
            >
              <Sidebar />
            </aside>

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              {/* Topbar */}
              <header
                className="flex-shrink-0 border-b border-white/5"
                style={{ height: 'var(--topbar-height)' }}
              >
                <Topbar />
              </header>

              {/* Page content */}
              <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 pb-20 lg:pb-8">
                {children}
              </main>
            </div>
          </div>

          {/* Mobile Bottom Nav */}
          <MobileNav />
        </LangProvider>
      </body>
    </html>
  );
}
