'use client';

import { useEffect, useState } from 'react';
import { Search, User, Settings, Menu, X, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/home/theme-toggle';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useScroll } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/AuthProvider';

const INITIAL_WIDTH = '70rem';
const MAX_WIDTH = '800px';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const drawerVariants = {
  hidden: { opacity: 0, y: 100 },
  visible: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      type: 'spring',
      damping: 15,
      stiffness: 200,
      staggerChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    y: 100,
    transition: { duration: 0.1 },
  },
};

// Navigation links específicos para Discovery
const DISCOVER_NAV_LINKS = [
  { id: 1, name: 'Featured', href: '#featured' },
  { id: 2, name: 'Trending', href: '#trending' },
  { id: 3, name: 'AI & Automation', href: '#ai-automation' },
  { id: 4, name: 'Productivity', href: '#productivity' },
];

export function DiscoverHeader() {
  const { scrollY } = useScroll();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      setHasScrolled(latest > 10);
    });
    return unsubscribe;
  }, [scrollY]);

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);
  const handleOverlayClick = () => setIsDrawerOpen(false);

  const logoSrc = !mounted
    ? '/kortix-logo.svg'
    : resolvedTheme === 'dark'
      ? '/kortix-logo-white.svg'
      : '/kortix-logo.svg';

  return (
    <header
      className={cn(
        'sticky z-50 mx-4 flex justify-center transition-all duration-300 md:mx-0',
        hasScrolled ? 'top-6' : 'top-4 mx-0',
      )}
    >
      <motion.div
        initial={{ width: INITIAL_WIDTH }}
        animate={{ width: hasScrolled ? MAX_WIDTH : INITIAL_WIDTH }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div
          className={cn(
            'mx-auto max-w-7xl rounded-2xl transition-all duration-300 xl:px-0',
            hasScrolled
              ? 'px-2 border border-border backdrop-blur-lg bg-background/75'
              : 'shadow-none px-7',
          )}
        >
                    <div className="flex h-[56px] items-center justify-between p-4">
            {/* Logo/Branding - Left side with icon */}
            <Link href="/discover" className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary text-lg">
                Discover
              </span>
            </Link>

            {/* Navigation Menu - Absolutely centered */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
              <div className="flex items-center space-x-6">
                {DISCOVER_NAV_LINKS.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Right side spacer */}
            <div className="w-8"></div>

            {/* Mobile menu button - positioned absolutely */}
            <button
              className="md:hidden border border-border size-8 rounded-md cursor-pointer flex items-center justify-center absolute right-4"
              onClick={toggleDrawer}
            >
              {isDrawerOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Drawer - Adaptado da home */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={overlayVariants}
              transition={{ duration: 0.2 }}
              onClick={handleOverlayClick}
            />

            <motion.div
              className="fixed inset-x-0 w-[95%] mx-auto bottom-3 bg-background border border-border p-4 rounded-xl shadow-lg"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={drawerVariants}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Link href="/discover" className="flex items-center gap-3">
                    <Image
                      src={logoSrc}
                      alt="Kortix Logo"
                      width={120}
                      height={22}
                      priority
                    />
                    <span className="font-medium text-primary text-sm">
                      / Discover
                    </span>
                  </Link>
                  <button
                    onClick={toggleDrawer}
                    className="border border-border rounded-md p-1 cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Mobile Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="search"
                    placeholder="Search insights..."
                    className="pl-10 bg-muted/40 border-muted-foreground/20"
                  />
                </div>

                {/* Mobile Navigation */}
                <motion.ul className="flex flex-col text-sm mb-4 border border-border rounded-md">
                  {DISCOVER_NAV_LINKS.map((link) => (
                    <motion.li
                      key={link.id}
                      className="p-2.5 border-b border-border last:border-b-0"
                    >
                      <a
                        href={link.href}
                        onClick={() => setIsDrawerOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.name}
                      </a>
                    </motion.li>
                  ))}
                </motion.ul>

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  {user ? (
                    <Link
                      href="/dashboard"
                      className="bg-secondary h-8 flex items-center justify-center text-sm font-normal tracking-wide rounded-full text-primary-foreground dark:text-secondary-foreground w-full px-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)] border border-white/[0.12] hover:bg-secondary/80 transition-all ease-out active:scale-95"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/auth"
                      className="bg-secondary h-8 flex items-center justify-center text-sm font-normal tracking-wide rounded-full text-primary-foreground dark:text-secondary-foreground w-full px-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)] border border-white/[0.12] hover:bg-secondary/80 transition-all ease-out active:scale-95"
                    >
                      Get Started
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
} 