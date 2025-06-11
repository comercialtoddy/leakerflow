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
import type { TabCategory } from '@/app/(dashboard)/discover/page';

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
  { id: 2, name: 'Trends', href: '#trends', category: 'trends' as TabCategory },
  { id: 1, name: 'For You', href: '#for-you', category: 'for-you' as TabCategory },
  { id: 3, name: 'Official', href: '#official', category: 'official' as TabCategory },
  { id: 4, name: 'Rumor', href: '#rumor', category: 'rumor' as TabCategory },
  { id: 6, name: 'Community', href: '#community', category: 'community' as TabCategory },
];

interface DiscoverHeaderProps {
  activeTab?: TabCategory;
  onTabChange?: (tab: TabCategory) => void;
}

export function DiscoverHeader({ activeTab = 'for-you', onTabChange }: DiscoverHeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { scrollY } = useScroll();
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.onChange((latest) => {
      setHasScrolled(latest > 50);
    });
    return () => unsubscribe();
  }, [scrollY]);

  const handleTabClick = (category: TabCategory, event: React.MouseEvent) => {
    event.preventDefault();
    onTabChange?.(category);
  };

  // Get active tab index for indicator positioning
  const activeTabIndex = DISCOVER_NAV_LINKS.findIndex(link => link.category === activeTab);

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

            {/* Navigation Menu - Absolutely centered with active indicator */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
              <div className="relative flex items-center space-x-6">
                {DISCOVER_NAV_LINKS.map((link, index) => (
                  <button
                    key={link.id}
                    onClick={(e) => handleTabClick(link.category, e)}
                    className={cn(
                      "relative text-sm font-medium transition-colors duration-200 py-2 px-1",
                      activeTab === link.category
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.name}
                    {/* Active tab indicator */}
                    {activeTab === link.category && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right side spacer */}
            <div className="w-8"></div>

            {/* Mobile menu button - positioned absolutely */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden absolute right-4 top-1/2 transform -translate-y-1/2"
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
            >
              <div className="bg-background border border-border rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="h-5 w-5 text-primary" />
                    <span className="font-medium text-primary text-lg">
                      Discover
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <motion.ul className="flex flex-col text-sm mb-4 border border-border rounded-md">
                  {DISCOVER_NAV_LINKS.map((link) => (
                    <motion.li
                      key={link.id}
                      className="p-2.5 border-b border-border last:border-b-0"
                    >
                      <button
                        onClick={() => {
                          handleTabClick(link.category, {} as React.MouseEvent);
                          setIsDrawerOpen(false);
                        }}
                        className={cn(
                          "w-full text-left transition-colors relative",
                          activeTab === link.category
                            ? "text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {link.name}
                        {/* Mobile active indicator */}
                        {activeTab === link.category && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                        )}
                      </button>
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