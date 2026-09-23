// SmartShule — Page de login Staging (pré-production)
// ============================================================
// Page simple avec mot de passe pour protéger l'environnement de staging

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export default async function StagingLoginPage(req: { searchParams: { redirect?: string } }) {
  const redirect = req.searchParams.redirect || '/'

  return (
    <html>
      <head>
        <title>SmartShule — Staging (Pré-production)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #0F172A, #1E293B);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
          }
          .container {
            max-width: 400px;
            width: 90%;
            padding: 40px;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 24px;
          }
          .logo h1 {
            font-size: 24px;
            font-weight: 700;
            margin-top: 8px;
          }
          .logo .badge {
            display: inline-block;
            padding: 4px 12px;
            background: rgba(245, 158, 11, 0.2);
            color: #F59E0B;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
          }
          .form-group {
            margin-bottom: 16px;
          }
          label {
            display: block;
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 6px;
          }
          input {
            width: 100%;
            padding: 12px 16px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            color: #fff;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
          }
          input:focus {
            border-color: #2563EB;
          }
          button {
            width: 100%;
            padding: 12px;
            background: #2563EB;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover {
            background: #1D4ED8;
          }
          .error {
            color: #EF4444;
            font-size: 13px;
            margin-top: 12px;
            text-align: center;
            display: none;
          }
          .info {
            margin-top: 16px;
            padding: 12px;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 8px;
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            text-align: center;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="logo">
            <div style={{ fontSize: '48px' }}>🎓</div>
            <h1>SmartShule</h1>
            <div className="badge">🔒 Environnement de Staging</div>
          </div>
          <form action="/api/staging-auth" method="POST">
            <input type="hidden" name="redirect" value={redirect} />
            <div className="form-group">
              <label>Mot de passe d'accès</label>
              <input type="password" name="password" placeholder="••••••••••" autoFocus required />
            </div>
            <button type="submit">Accéder au staging</button>
            <div className="error" id="error">Mot de passe incorrect</div>
          </form>
          <div className="info">
            Cet environnement est protégé. Les modifications ici n'affectent pas le site de production.
          </div>
        </div>
      </body>
    </html>
  )
}
