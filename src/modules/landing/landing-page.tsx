'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Users, Wallet, BookOpen, Shield, Bell, Phone,
  ArrowRight, CheckCircle2, Building2, FileText, MessageSquare,
  TrendingUp, Calendar, Star, ChevronDown, PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ss/theme-toggle'

// ============================================================
// Données
// ============================================================

const WHATSAPP_NUMBER = '243999071754'
const CONTACT_PHONE = '+243 999 071 754'

const MODULES = [
  {
    icon: Building2,
    title: 'Administration Scolaire',
    color: 'blue',
    description: 'Inscriptions, élèves, classes, options, années scolaires et documents administratifs.',
    features: ['Inscriptions en ligne', 'Multi-directions', 'Années scolaires', 'Documents officiels'],
  },
  {
    icon: BookOpen,
    title: 'Pédagogie',
    color: 'teal',
    description: 'Horaires, présences, devoirs, notes, bulletins, palmarès et délibérations.',
    features: ['Emplois du temps', 'Appel & assiduité IQA', 'Bulletins PDF', 'Délibérations'],
  },
  {
    icon: Wallet,
    title: 'Finances',
    color: 'amber',
    description: 'Frais scolaires, échéanciers, paiements, reçus infalsifiables et rapports de caisse.',
    features: ['Mobile Money intégré', 'Reçus avec QR code', 'Comptabilité double entrée', 'Rapports temps réel'],
  },
  {
    icon: Users,
    title: 'Portail Famille',
    color: 'pink',
    description: 'Résultats, frais, absences, devoirs, communications et téléchargement de documents.',
    features: ['Résultats en temps réel', 'Paiement en ligne', 'Messagerie sécurisée', 'Bulletins téléchargeables'],
  },
]

const PROFILES = [
  { icon: Shield, label: 'Direction', description: 'Pilotage complet, rapports, audit' },
  { icon: FileText, label: 'Secrétariat', description: 'Inscriptions, listes, dossiers' },
  { icon: Wallet, label: 'Comptable', description: 'Encaissements, reçus, caisse' },
  { icon: BookOpen, label: 'Enseignant', description: 'Appel, notes, cahier de textes' },
  { icon: Users, label: 'Parent', description: 'Suivi enfants, paiement, messages' },
  { icon: GraduationCap, label: 'Élève', description: 'Cours, devoirs, résultats' },
]

const FAQ = [
  {
    q: 'Le logiciel fonctionne-t-il hors ligne ?',
    a: 'Oui. La version desktop fonctionne en mode offline-first. Les données sont stockées localement et synchronisées avec le cloud dès que la connexion est rétablie. Idéal pour les zones à connectivité instable.',
  },
  {
    q: 'Quels moyens de paiement sont supportés ?',
    a: 'Espèces (caisse), virement bancaire, et Mobile Money : M-Pesa, Orange Money, MTN Mobile Money, Airtel Money et Wave. Chaque paiement génère un reçu infalsifiable avec QR code de vérification.',
  },
  {
    q: 'Les données de mon école sont-elles sécurisées ?',
    a: 'Absolument. Chaque école a ses données cloisonnées (multi-tenant). Les reçus sont signés cryptographiquement (HMAC-SHA256). Toutes les actions sont journalisées dans un audit immuable. Aucune suppression de reçu n\'est possible — uniquement des avoirs tracés.',
  },
  {
    q: 'Puis-je adapter le logiciel à ma structure pédagogique ?',
    a: 'Oui, à 100%. Vous configurez vos directions (Maternelle, Primaire, Secondaire), sections, options (Scientifique, Commerciale, Coupe-Couture), matières, classes, périodes et frais selon votre établissement.',
  },
  {
    q: 'Comment fonctionne la démonstration ?',
    a: 'La démo web est accessible immédiatement avec 7 comptes de démonstration (Direction, Prof, Comptable, Secrétaire, Parent, Élève, Admin). Les données sont fictives et réinitialisées régulièrement. Pour une démonstration personnalisée, contactez-nous.',
  },
  {
    q: 'Le logiciel est-il adapté aux écoles africaines ?',
    a: 'SmartShule est conçu spécifiquement pour les réalités du continent africain : Mobile Money, multi-direction, structure pédagogique RDC, devise CDF/USD, locale fr-FR, timezone Africa/Kinshasa, et fonctionnement offline pour les coupures réseau.',
  },
]

// ============================================================
// Composant principal
// ============================================================

export function LandingPage({ school }: { school: any }) {
  const router = useRouter()
  const [showDemoRequest, setShowDemoRequest] = React.useState(false)

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Bonjour SmartShule, je souhaite une démonstration du logiciel pour mon école.')}`

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg">SmartShule</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#modules" className="text-sm text-muted-foreground hover:text-foreground">Modules</a>
              <a href="#profils" className="text-sm text-muted-foreground hover:text-foreground">Profils</a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
              <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</a>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
                Se connecter
              </Button>
              <Button size="sm" onClick={() => setShowDemoRequest(true)} className="hidden sm:inline-flex">
                Demander une démo
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-soft to-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-white/10 text-white border-white/20 backdrop-blur">
                🎓 Plateforme de gestion scolaire adaptée à l'Afrique
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                L'intelligence qui rapproche <span className="text-amber-400">l'école et la famille</span>
              </h1>
              <p className="text-lg text-primary-foreground/80 max-w-xl">
                Gestion scolaire complète, finances sécurisées et communication parents-école
                dans un seul système. Conçu pour les réalités des établissements africains.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => setShowDemoRequest(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
                  Demander une démonstration gratuite
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/login')} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Essayer la démo
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-primary-foreground/60">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Mobile Money intégré</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Reçus infalsifiables</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Fonctionne hors ligne</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-teal-500/20 rounded-3xl blur-2xl" />
                <div className="relative bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                  <div className="grid grid-cols-2 gap-4">
                    {MODULES.map((m) => {
                      const Icon = m.icon
                      return (
                        <div key={m.title} className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <Icon className="h-8 w-8 text-amber-400 mb-2" />
                          <p className="text-sm font-semibold text-white">{m.title}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-card border-b border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">7</p>
              <p className="text-sm text-muted-foreground mt-1">Portails dédiés par rôle</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">3000+</p>
              <p className="text-sm text-muted-foreground mt-1">Élèves gérables</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">5</p>
              <p className="text-sm text-muted-foreground mt-1">Opérateurs Mobile Money</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">24/7</p>
              <p className="text-sm text-muted-foreground mt-1">Accès portail famille</p>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Modules</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Quatre piliers pour gérer toute l'école</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              De l'administration aux finances, en passant par la pédagogie et le portail famille — tout est intégré.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {MODULES.map((m) => {
              const Icon = m.icon
              const colors: Record<string, string> = {
                blue: 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20',
                teal: 'border-teal-200 bg-teal-50/50 dark:bg-teal-950/20',
                amber: 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20',
                pink: 'border-pink-200 bg-pink-50/50 dark:bg-pink-950/20',
              }
              const iconColors: Record<string, string> = {
                blue: 'bg-blue-500/10 text-blue-600',
                teal: 'bg-teal-500/10 text-teal-600',
                amber: 'bg-amber-500/10 text-amber-600',
                pink: 'bg-pink-500/10 text-pink-600',
              }
              return (
                <Card key={m.title} className={`border-2 ${colors[m.color]}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconColors[m.color]} shrink-0`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">{m.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                        <ul className="space-y-1.5">
                          {m.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Profils */}
      <section id="profils" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Profils</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Un espace dédié pour chaque acteur</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Chaque utilisateur dispose d'un portail adapté à son rôle, avec permissions granulaires.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {PROFILES.map((p) => {
              const Icon = p.icon
              return (
                <div key={p.label} className="bg-card rounded-xl p-4 text-center border border-border hover:border-primary/30 transition-colors">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-primary/10 mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-semibold text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Sécurité */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4">Sécurité</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Sécurité de niveau bancaire</h2>
              <p className="text-muted-foreground mb-6">
                Chaque transaction est traçable, vérifiable et irréversible. Vos données sont protégées
                par les mêmes standards que les institutions financières.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Shield, title: 'Reçus infalsifiables', desc: 'Numérotation chronologique stricte + signature HMAC-SHA256' },
                  { icon: CheckCircle2, title: 'QR Code vérifiable', desc: 'Chaque reçu contient un QR code scannable pour vérification' },
                  { icon: FileText, title: 'Audit immuable', desc: 'Toutes les actions sont journalisées — aucune suppression possible' },
                  { icon: Users, title: 'Permissions granulaires', desc: 'RBAC strict : chaque rôle ne voit que ce qu\'il doit voir' },
                ].map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.title} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary to-primary-soft rounded-2xl p-8 text-primary-foreground">
              <Shield className="h-12 w-12 text-amber-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Vos données vous appartiennent</h3>
              <p className="text-primary-foreground/80 text-sm mb-6">
                Cloisonnement strict entre établissements (multi-tenant). Sauvegardes automatiques.
                Séparation complète des données par école. Aucun accès externe sans autorisation.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Sauvegardes automatiques quotidiennes</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Cloisonnement multi-écoles</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Double validation financière</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Historique des modifications de notes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Questions fréquentes</h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <details key={i} className="group bg-card rounded-xl border border-border overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-semibold hover:bg-muted/30">
                  {item.q}
                  <ChevronDown className="h-5 w-5 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à transformer votre école ?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Demandez une démonstration gratuite et découvrez comment SmartShule peut simplifier
            la gestion de votre établissement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => setShowDemoRequest(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
              Demander une démonstration gratuite
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp : {CONTACT_PHONE}
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-primary-foreground/60">
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span>Assistance commerciale et technique : {CONTACT_PHONE}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="font-bold">SmartShule</span>
              </div>
              <p className="text-sm text-muted-foreground">
                La plateforme de gestion scolaire et de communication parents-école,
                adaptée aux réalités des établissements africains.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Modules</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Administration scolaire</li>
                <li>Pédagogie</li>
                <li>Finances</li>
                <li>Portail famille</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Essayer la démo</Link></li>
                <li><Link href="/register" className="hover:text-foreground">Inscription parent</Link></li>
                <li><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">WhatsApp</a></li>
                <li>FAQ</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> {CONTACT_PHONE}</li>
                <li className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp 24/7</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>SmartShule © 2026-2027 — L'intelligence qui rapproche l'école et la famille.</p>
            <p className="mt-1 text-xs">
              ⚠️ Cette plateforme web est une démonstration. Le logiciel est conçu pour ordinateur desktop.
              Contactez-nous pour adapter le programme à la vision de votre école.
            </p>
          </div>
        </div>
      </footer>

      {/* Bouton WhatsApp flottant */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors"
        title="Contactez-nous sur WhatsApp"
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      </a>

      {/* Modal demande de démo */}
      {showDemoRequest && (
        <DemoRequestModal onClose={() => setShowDemoRequest(false)} whatsappUrl={whatsappUrl} />
      )}
    </div>
  )
}

// ============================================================
// Modal demande de démo
// ============================================================

function DemoRequestModal({ onClose, whatsappUrl }: { onClose: () => void; whatsappUrl: string }) {
  const [pending, setPending] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [form, setForm] = React.useState({
    schoolName: '',
    directorName: '',
    email: '',
    phone: '',
    city: '',
    studentCount: '',
    message: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.schoolName || !form.email || !form.phone) {
      toast.error('Veuillez remplir les champs obligatoires.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) {
        setSubmitted(true)
        toast.success('Demande envoyée ! Nous vous contacterons sous 24h.')
      } else {
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4" onClick={onClose}>
        <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold">Demande reçue !</h3>
            <p className="text-sm text-muted-foreground">
              Merci pour votre intérêt. Notre équipe vous contactera sous 24h au {form.phone} ou {form.email}.
            </p>
            <p className="text-xs text-muted-foreground">
              Pour une réponse immédiate, contactez-nous sur WhatsApp.
            </p>
            <div className="flex gap-2 justify-center">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
                </Button>
              </a>
              <Button onClick={onClose}>Fermer</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4" onClick={onClose}>
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Demander une démonstration gratuite</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
          </div>
          <p className="text-sm text-muted-foreground">
            Remplissez ce formulaire et nous vous contacterons sous 24h pour planifier une démonstration personnalisée.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Nom de l'école *</Label>
              <Input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} required placeholder="Institution SmartShule" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom du responsable</Label>
                <Input value={form.directorName} onChange={(e) => setForm({ ...form, directorName: e.target.value })} placeholder="M. / Mme" />
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Kinshasa" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="direction@ecole.cd" />
              </div>
              <div>
                <Label>Téléphone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+243 ..." />
              </div>
            </div>
            <div>
              <Label>Nombre d'élèves</Label>
              <Input value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} placeholder="Ex: 500" />
            </div>
            <div>
              <Label>Message (optionnel)</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={2} placeholder="Vos besoins spécifiques..." />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
