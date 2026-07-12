import Link from "next/link";

const footerLinks = [
  {
    heading: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Notice History", href: "/history" },
      { label: "Deadlines", href: "/deadlines" },
    ],
  },
  {
    heading: "Admin",
    links: [
      { label: "Upload Notice", href: "/admin/notices" },
      { label: "Pipeline Tracker", href: "/history" },
      { label: "Manage Deadlines", href: "/deadlines" },
    ],
  },
  {
    heading: "System",
    links: [
      { label: "AI Pipeline", href: "/history" },
      { label: "OCR Processing", href: "/admin/notices" },
      { label: "WhatsApp Alerts", href: "/deadlines" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "MMMUT University", href: "https://mmmut.ac.in", external: true },
      { label: "Documentation", href: "#" },
      { label: "GitHub", href: "#", external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <hr style={styles.divider} />
        <div style={styles.grid}>
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <p style={styles.heading}>{col.heading}</p>
              <ul style={styles.list}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={styles.link}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <hr style={styles.divider} />
        <p style={styles.fine}>
          Copyright © 2026 MMMUT Notice Intelligence Platform. Built with Next.js, Supabase & Gemini AI.
        </p>
      </div>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    background: "var(--surface-canvas)",
    marginTop: "auto",
  },
  inner: {
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "0 24px 20px",
  },
  divider: {
    borderTop: "1px solid #d2d2d7",
    margin: "0 0 20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "24px",
    marginBottom: "20px",
  },
  heading: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-caption)",
    marginBottom: "10px",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  link: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-regular)",
    color: "var(--color-ash)",
    textDecoration: "none",
    letterSpacing: "var(--tracking-caption)",
    transition: "color 0.15s ease",
  },
  fine: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    letterSpacing: "var(--tracking-caption)",
  },
};
