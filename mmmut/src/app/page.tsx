import Link from 'next/link';
import GlobalNav from './components/GlobalNav';
import Footer from './components/Footer';

// ─── Inline Style Objects ────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // ── Page Shell
  pageShell: {
    backgroundColor: '#f5f5f7',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    color: '#1d1d1f',
    overflowX: 'hidden',
  },

  // ── Hero Section
  heroSection: {
    backgroundColor: '#f5f5f7',
    paddingTop: '120px',
    paddingBottom: '120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    position: 'relative',
  },

  heroInner: {
    maxWidth: '800px',
    width: '100%',
    paddingLeft: '24px',
    paddingRight: '24px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  // Badge
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #d2d2d7',
    borderRadius: '980px',
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#1d1d1f',
    marginBottom: '32px',
    letterSpacing: '0.1px',
    animation: 'fadeInUp 0.4s ease both',
    animationDelay: '0s',
    position: 'relative',
    overflow: 'hidden',
  },

  heroBadgeAccent: {
    display: 'inline-block',
    width: '3px',
    height: '16px',
    backgroundColor: '#2997ff',
    borderRadius: '2px',
    marginRight: '4px',
    flexShrink: 0,
  },

  // Headline
  heroHeadline: {
    fontSize: '56px',
    fontWeight: 600,
    color: '#1d1d1f',
    letterSpacing: '0.616px',
    lineHeight: 1.07,
    fontFamily: "'Inter', -apple-system, 'SF Pro Display', sans-serif",
    margin: '0 0 24px 0',
    animation: 'fadeInUp 0.6s ease both',
    animationDelay: '0.1s',
  },

  heroHeadlineLine2: {
    display: 'block',
    color: '#2997ff',
  },

  // Tagline
  heroTagline: {
    fontSize: '21px',
    fontWeight: 300,
    color: '#1d1d1f',
    maxWidth: '600px',
    lineHeight: 1.6,
    margin: '0 auto 40px auto',
    animation: 'fadeInUp 0.6s ease both',
    animationDelay: '0.2s',
  },

  // Button row
  heroButtonRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
    animation: 'fadeInUp 0.6s ease both',
    animationDelay: '0.3s',
    flexWrap: 'wrap',
  },

  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0071e3',
    color: '#ffffff',
    border: '1px solid #0071e3',
    borderRadius: '980px',
    padding: '12px 28px',
    fontSize: '17px',
    fontWeight: 500,
    textDecoration: 'none',
    letterSpacing: '0.2px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.15s ease',
    whiteSpace: 'nowrap',
  },

  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#0066cc',
    border: '1px solid #0066cc',
    borderRadius: '980px',
    padding: '12px 28px',
    fontSize: '17px',
    fontWeight: 500,
    textDecoration: 'none',
    letterSpacing: '0.2px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.15s ease',
    whiteSpace: 'nowrap',
  },

  heroCaption: {
    fontSize: '12px',
    color: '#707070',
    animation: 'fadeInUp 0.6s ease both',
    animationDelay: '0.4s',
    letterSpacing: '0.3px',
  },

  // ── Stats Row
  statsSection: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid #d2d2d7',
    borderBottom: '1px solid #d2d2d7',
    paddingTop: '48px',
    paddingBottom: '48px',
  },

  statsInner: {
    maxWidth: '980px',
    margin: '0 auto',
    paddingLeft: '24px',
    paddingRight: '24px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '48px',
    flexWrap: 'wrap',
  },

  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
    minWidth: '140px',
  },

  statEmoji: {
    fontSize: '40px',
    lineHeight: 1,
    marginBottom: '4px',
  },

  statLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1d1d1f',
    letterSpacing: '0.2px',
  },

  statSub: {
    fontSize: '14px',
    fontWeight: 400,
    color: '#707070',
    lineHeight: 1.4,
    maxWidth: '140px',
  },

  // ── Feature Tiles
  featuresSection: {
    backgroundColor: '#f5f5f7',
    paddingTop: '64px',
    paddingBottom: '64px',
  },

  featuresInner: {
    maxWidth: '980px',
    margin: '0 auto',
    paddingLeft: '24px',
    paddingRight: '24px',
  },

  featuresSectionHeading: {
    fontSize: '40px',
    fontWeight: 600,
    color: '#1d1d1f',
    textAlign: 'center',
    letterSpacing: '0.4px',
    margin: '0 0 12px 0',
    fontFamily: "'Inter', -apple-system, 'SF Pro Display', sans-serif",
  },

  featuresSectionSubtitle: {
    fontSize: '21px',
    fontWeight: 300,
    color: '#1d1d1f',
    textAlign: 'center',
    margin: '0 auto 48px auto',
    maxWidth: '540px',
    lineHeight: 1.5,
  },

  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },

  featureCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #d2d2d7',
    borderRadius: '8px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: 'transform 0.2s ease',
    cursor: 'default',
  },

  featureCardIcon: {
    width: '44px',
    height: '44px',
    flexShrink: 0,
  },

  featureCardTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1d1d1f',
    letterSpacing: '0.3px',
    margin: 0,
  },

  featureCardDesc: {
    fontSize: '15px',
    fontWeight: 400,
    color: '#484848',
    lineHeight: 1.6,
    margin: 0,
    flexGrow: 1,
  },

  featureCardLink: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#0066cc',
    textDecoration: 'none',
    letterSpacing: '0.1px',
    marginTop: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },

  // ── CTA Block
  ctaSection: {
    backgroundColor: '#f4f8fb',
    paddingTop: '96px',
    paddingBottom: '96px',
    textAlign: 'center',
  },

  ctaInner: {
    maxWidth: '640px',
    margin: '0 auto',
    paddingLeft: '24px',
    paddingRight: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },

  ctaHeadline: {
    fontSize: '40px',
    fontWeight: 600,
    color: '#1d1d1f',
    letterSpacing: '0.4px',
    margin: 0,
    lineHeight: 1.1,
    fontFamily: "'Inter', -apple-system, 'SF Pro Display', sans-serif",
  },

  ctaTagline: {
    fontSize: '21px',
    fontWeight: 300,
    color: '#1d1d1f',
    margin: 0,
    lineHeight: 1.5,
  },
};

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function DocumentIcon() {
  return (
    <svg
      style={styles.featureCardIcon}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="10" fill="#f0f7ff" />
      <path
        d="M14 12h10l6 6v14a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z"
        stroke="#2997ff"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M24 12v6h6"
        stroke="#2997ff"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M17 22h10M17 26h7"
        stroke="#2997ff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      style={styles.featureCardIcon}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="10" fill="#f0f7ff" />
      <rect x="12" y="26" width="5" height="8" rx="1" fill="#2997ff" opacity="0.4" />
      <rect x="19.5" y="20" width="5" height="14" rx="1" fill="#2997ff" opacity="0.7" />
      <rect x="27" y="14" width="5" height="20" rx="1" fill="#2997ff" />
      <path
        d="M12 32h20"
        stroke="#2997ff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      style={styles.featureCardIcon}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="10" fill="#f0f7ff" />
      <rect
        x="11"
        y="14"
        width="22"
        height="19"
        rx="2"
        stroke="#2997ff"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M11 20h22"
        stroke="#2997ff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M17 11v6M27 11v6"
        stroke="#2997ff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="18" cy="26" r="1.5" fill="#2997ff" />
      <circle cx="22" cy="26" r="1.5" fill="#2997ff" />
      <circle cx="26" cy="26" r="1.5" fill="#2997ff" />
    </svg>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .feature-card-hover:hover {
          transform: translateY(-2px);
        }

        .btn-primary-link:hover {
          background-color: #0077ed !important;
        }

        .btn-secondary-link:hover {
          background-color: #f0f6ff !important;
        }

        .feature-ghost-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .hero-headline-responsive {
            font-size: 36px !important;
          }
          .hero-tagline-responsive {
            font-size: 18px !important;
          }
          .feature-grid-responsive {
            grid-template-columns: 1fr !important;
          }
          .stats-inner-responsive {
            gap: 32px !important;
          }
          .cta-headline-responsive {
            font-size: 30px !important;
          }
          .features-section-heading-responsive {
            font-size: 30px !important;
          }
        }

        @media (max-width: 600px) {
          .feature-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }

        @media (min-width: 601px) and (max-width: 900px) {
          .feature-grid-responsive {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      <div style={styles.pageShell}>
        {/* ── Global Nav ── */}
        <GlobalNav />

        {/* ════════════════════════════════════════════════
            1. HERO SECTION
        ════════════════════════════════════════════════ */}
        <section style={styles.heroSection} aria-label="Hero">
          <div style={styles.heroInner}>
            {/* Badge */}
            <div style={styles.heroBadge}>
              <span style={styles.heroBadgeAccent} aria-hidden="true" />
              🤖 AI-Powered · Zero Cost Infrastructure
            </div>

            {/* Headline */}
            <h1
              style={styles.heroHeadline}
              className="hero-headline-responsive"
            >
              MMMUT Notice
              <span style={styles.heroHeadlineLine2}>
                Intelligence Platform
              </span>
            </h1>

            {/* Tagline */}
            <p
              style={styles.heroTagline}
              className="hero-tagline-responsive"
            >
              The automated pipeline that scrapes, processes and distributes
              university notices via AI.
            </p>

            {/* CTA Buttons */}
            <div style={styles.heroButtonRow}>
              <Link
                href="/admin/notices"
                style={styles.btnPrimary}
                className="btn-primary-link"
              >
                Admin Dashboard →
              </Link>
              <Link
                href="/history"
                style={styles.btnSecondary}
                className="btn-secondary-link"
              >
                View Notice History
              </Link>
            </div>

            {/* Caption */}
            <p style={styles.heroCaption}>
              3 pages · AI Pipeline · WhatsApp · Email Alerts
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            2. STATS ROW
        ════════════════════════════════════════════════ */}
        <section style={styles.statsSection} aria-label="Platform stats">
          <div
            style={styles.statsInner}
            className="stats-inner-responsive"
          >
            {/* Stat 1 */}
            <div style={styles.statBlock}>
              <span style={styles.statEmoji} role="img" aria-label="Robot">
                🤖
              </span>
              <span style={styles.statLabel}>AI-Powered OCR</span>
              <span style={styles.statSub}>Extract text from Hindi PDFs</span>
            </div>

            {/* Stat 2 */}
            <div style={styles.statBlock}>
              <span style={styles.statEmoji} role="img" aria-label="Zero cost">
                ₹0
              </span>
              <span style={styles.statLabel}>Zero Cost</span>
              <span style={styles.statSub}>Free-tier Supabase + Vercel</span>
            </div>

            {/* Stat 3 */}
            <div style={styles.statBlock}>
              <span style={styles.statEmoji} role="img" aria-label="Chat bubble">
                💬
              </span>
              <span style={styles.statLabel}>WhatsApp Ready</span>
              <span style={styles.statSub}>Instant formatted messages</span>
            </div>

            {/* Stat 4 */}
            <div style={styles.statBlock}>
              <span style={styles.statEmoji} role="img" aria-label="Email">
                📧
              </span>
              <span style={styles.statLabel}>Email Alerts</span>
              <span style={styles.statSub}>Deadline reminders auto-sent</span>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            3. FEATURE TILES
        ════════════════════════════════════════════════ */}
        <section style={styles.featuresSection} aria-label="Features">
          <div style={styles.featuresInner}>
            {/* Section heading */}
            <h2
              style={styles.featuresSectionHeading}
              className="features-section-heading-responsive"
            >
              Everything you need
            </h2>
            <p style={styles.featuresSectionSubtitle}>
              One platform to capture, process, track and distribute every
              notice from MMMUT.
            </p>

            {/* Card grid */}
            <div
              style={styles.featureGrid}
              className="feature-grid-responsive"
            >
              {/* Card 1 — Notice Pipeline */}
              <article
                style={styles.featureCard}
                className="feature-card-hover"
              >
                <DocumentIcon />
                <h3 style={styles.featureCardTitle}>Notice Pipeline</h3>
                <p style={styles.featureCardDesc}>
                  Upload PDFs, run OCR, process with Gemini AI, save to
                  database. Fully automated end-to-end ingestion with one
                  click.
                </p>
                <Link
                  href="/admin/notices"
                  style={styles.featureCardLink}
                  className="feature-ghost-link"
                >
                  Learn more →
                </Link>
              </article>

              {/* Card 2 — History & Tracking */}
              <article
                style={styles.featureCard}
                className="feature-card-hover"
              >
                <ChartIcon />
                <h3 style={styles.featureCardTitle}>History &amp; Tracking</h3>
                <p style={styles.featureCardDesc}>
                  Track every notice through the pipeline. Know the status at
                  each stage — from scrape to distribution — in real time.
                </p>
                <Link
                  href="/history"
                  style={styles.featureCardLink}
                  className="feature-ghost-link"
                >
                  Learn more →
                </Link>
              </article>

              {/* Card 3 — Deadline Manager */}
              <article
                style={styles.featureCard}
                className="feature-card-hover"
              >
                <CalendarIcon />
                <h3 style={styles.featureCardTitle}>Deadline Manager</h3>
                <p style={styles.featureCardDesc}>
                  Set deadlines, get email alerts 1 day before, and share via
                  WhatsApp automatically. Never miss an important notice again.
                </p>
                <Link
                  href="/admin/notices"
                  style={styles.featureCardLink}
                  className="feature-ghost-link"
                >
                  Learn more →
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            4. CTA BLOCK
        ════════════════════════════════════════════════ */}
        <section style={styles.ctaSection} aria-label="Call to action">
          <div style={styles.ctaInner}>
            <h2
              style={styles.ctaHeadline}
              className="cta-headline-responsive"
            >
              Ready to process notices?
            </h2>
            <p style={styles.ctaTagline}>
              Upload your first notice PDF and let AI do the rest.
            </p>
            <Link
              href="/admin/notices"
              style={styles.btnPrimary}
              className="btn-primary-link"
            >
              Get Started →
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <Footer />
      </div>
    </>
  );
}
