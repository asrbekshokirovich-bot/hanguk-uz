import { useEffect, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
import { signReceiptUrl } from '@/lib/receiptUrl';

/** Resolves a stored receipt value to a signed URL (null while loading or on failure). */
export function useSignedReceiptUrl(value: string | null | undefined): string | null {
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSigned(null);
    if (!value) return;
    // blob:/data: previews of a file that is still uploading need no signing.
    if (/^(?:blob|data):/.test(value)) {
      setSigned(value);
      return;
    }
    signReceiptUrl(value).then((url) => {
      if (alive) setSigned(url);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return signed;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> & {
  url: string;
  children: ReactNode | ((href: string | null) => ReactNode);
};

/** An <a> that opens a receipt through a signed URL. */
export function SignedReceiptLink({ url, children, target = '_blank', rel = 'noreferrer', ...rest }: LinkProps) {
  const href = useSignedReceiptUrl(url);
  return (
    <a {...rest} href={href ?? undefined} target={target} rel={rel} aria-disabled={!href || undefined}>
      {typeof children === 'function' ? children(href) : children}
    </a>
  );
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { url: string | null | undefined };

/** An <img> whose source is a signed receipt URL. */
export function SignedReceiptImg({ url, alt = '', ...rest }: ImgProps) {
  const src = useSignedReceiptUrl(url);
  if (!src) return <span className={rest.className} aria-hidden="true" />;
  return <img {...rest} src={src} alt={alt} />;
}
