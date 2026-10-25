import { withBasePath } from '@/lib/shared';

// The W mark shared with the panel and the apps; the dark variant swaps tile and stroke.
export function Mark({ className = '' }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBasePath('/mark.svg')} alt="" aria-hidden className={`w-auto dark:hidden ${className}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBasePath('/mark-dark.svg')} alt="" aria-hidden className={`hidden w-auto dark:block ${className}`} />
    </>
  );
}
