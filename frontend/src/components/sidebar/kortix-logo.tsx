'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface KortixLogoProps {
  size?: number;
}

export function KortixLogo({ size = 24 }: KortixLogoProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mount, we can access the theme
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <Image
      src="/kortix-symbol.svg"
      alt="Kortix Logo"
      width={size}
      height={size}
      className="dark:invert"
    />
  );
}