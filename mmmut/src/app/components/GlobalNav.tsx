"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/deadlines", label: "Deadlines" },
  { href: "/admin/notices", label: "Admin" },
];

export default function GlobalNav() {
  const pathname = usePathname();

  return (
    <header style={styles.nav}>
      <div style={styles.inner}>
        {/* Logo */}
        <Link href="/" style={styles.logo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="8" height="8" rx="2" fill="var(--color-apple-blue)" />
            <rect x="13" y="3" width="8" height="8" rx="2" fill="var(--color-signal-blue)" opacity="0.6" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="var(--color-signal-blue)" opacity="0.4" />
            <rect x="13" y="13" width="8" height="8" rx="2" fill="var(--color-apple-blue)" opacity="0.3" />
          </svg>
          <span style={styles.logoText}>MMMUT</span>
        </Link>

        {/* Center nav links */}
        <nav style={styles.links}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  ...styles.link,
                  ...(isActive ? styles.linkActive : {}),
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Admin CTA */}
        <div style={styles.right}>
          <Link href="/admin/notices" className="btn-primary btn-sm" style={styles.cta}>
            Upload Notice
          </Link>
        </div>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    width: "100%",
    background: "rgba(245, 245, 247, 0.85)",
    backdropFilter: "saturate(180%) blur(20px)",
    WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: "1px solid #d2d2d7",
  },
  inner: {
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "0 24px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textDecoration: "none",
    flexShrink: 0,
  },
  logoText: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "0.02em",
    fontFamily: "var(--font-sf-pro-display)",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flex: 1,
    justifyContent: "center",
  },
  link: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-regular)",
    color: "var(--color-carbon)",
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: "var(--radius-full)",
    transition: "background 0.15s ease",
    letterSpacing: "var(--tracking-caption)",
  },
  linkActive: {
    color: "var(--color-apple-blue)",
    background: "rgba(0, 113, 227, 0.08)",
  },
  right: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  cta: {
    fontSize: "var(--text-caption)",
    padding: "6px 14px",
  },
};
