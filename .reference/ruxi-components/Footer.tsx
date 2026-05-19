import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';

const FOOTER_LINKS = {
  about: {
    title: '了解入戏',
    links: [
      { label: '关于入戏', href: '/about' },
      { label: '用户协议', href: '/terms' },
      { label: '隐私政策', href: '/privacy' },
    ],
  },
};

const FOOTER_BRAND_COPY = 'AI 驱动的互动叙事平台。世界、角色与故事开场，都在这里等你入戏。';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="mx-auto w-full max-w-[100rem] px-4 py-12 sm:px-6 xl:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {FOOTER_LINKS.about.title}
            </h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.about.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/luelan-icon.png"
                alt="入戏"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-cover"
              />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{SITE_CONFIG.name}</h3>
                <p className="text-xs text-gray-400">{SITE_CONFIG.brandSignature}</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-gray-500">
              {FOOTER_BRAND_COPY}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              联系掠蓝
            </h3>
            <div className="space-y-2 text-sm text-gray-500">
              <p>QQ：{SITE_CONFIG.contact.qq}</p>
              <p>微信：{SITE_CONFIG.contact.wechat}</p>
              <p>邮箱：{SITE_CONFIG.contact.email}</p>
              <p><a href={SITE_CONFIG.contact.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">GitHub</a></p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>{SITE_CONFIG.brandSignature}</p>
          <p className="mt-1">&copy; 2026 {SITE_CONFIG.name}</p>
        </div>
      </div>
    </footer>
  );
}
