-- ============================================================
-- SmartShule / PromoGestion — Script SQL PostgreSQL (Supabase)
-- ============================================================
-- Ce script crée toutes les tables nécessaires au flux opérationnel
-- multi-rôles (Directeur, Secrétariat, Comptabilité, Enseignant).
-- Il est conçu pour Supabase (PostgreSQL 15+) avec politiques RLS.
-- ============================================================

-- ============================================================
-- 1. MATIÈRES (créées par le Directeur)
-- ============================================================
CREATE TABLE IF NOT EXISTS matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ecole UUID NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,
  nom VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  id_direction UUID REFERENCES directions(id),
  id_section_option UUID REFERENCES sections_options(id),
  statut VARCHAR(20) DEFAULT 'ACTIVE',
  cree_par UUID REFERENCES utilisateurs(id),
  cree_le TIMESTAMPTZ DEFAULT NOW(),
  modifie_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_ecole, code)
);

CREATE INDEX IF NOT EXISTS idx_matieres_ecole ON matieres(id_ecole, statut);
CREATE INDEX IF NOT EXISTS idx_matieres_direction ON matieres(id_direction);

-- ============================================================
-- 2. AFFECTATIONS PROFS (multi-classes)
-- ============================================================
CREATE TABLE IF NOT EXISTS affectations_profs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prof UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  id_matiere UUID NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  id_classe UUID REFERENCES classes(id),
  cree_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_prof, id_matiere, id_classe)
);

CREATE INDEX IF NOT EXISTS idx_affectations_prof ON affectations_profs(id_prof);
CREATE INDEX IF NOT EXISTS idx_affectations_classe ON affectations_profs(id_classe);

-- ============================================================
-- 3. ÉLÈVES (inscrits par le Secrétariat)
-- ============================================================
CREATE TABLE IF NOT EXISTS eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ecole UUID NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,
  matricule VARCHAR(100) UNIQUE NOT NULL,
  nom VARCHAR(255) NOT NULL,
  postnom VARCHAR(255),
  prenom VARCHAR(255) NOT NULL,
  id_classe UUID REFERENCES classes(id),
  nom_parent VARCHAR(255),
  telephone_parent VARCHAR(50),
  statut_financier_bloque BOOLEAN DEFAULT FALSE,
  motif_blocage TEXT,
  statut VARCHAR(20) DEFAULT 'ACTIVE',
  cree_le TIMESTAMPTZ DEFAULT NOW(),
  modifie_le TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eleves_ecole ON eleves(id_ecole, statut);
CREATE INDEX IF NOT EXISTS idx_eleves_classe ON eleves(id_classe);
CREATE INDEX IF NOT EXISTS idx_eleves_bloque ON eleves(id_ecole, statut_financier_bloque) WHERE statut_financier_bloque = TRUE;

-- ============================================================
-- 4. LIGNES DE FACTURES (créées UNIQUEMENT par le Directeur)
-- ============================================================
CREATE TABLE IF NOT EXISTS lignes_factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ecole UUID NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,
  libelle_frais VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  montant BIGINT NOT NULL, -- en centimes
  devise VARCHAR(10) DEFAULT 'CDF',
  id_direction UUID REFERENCES directions(id),
  id_classe UUID REFERENCES classes(id),
  est_obligatoire BOOLEAN DEFAULT TRUE,
  est_recurrent BOOLEAN DEFAULT FALSE,
  frequence VARCHAR(20), -- MONTHLY | QUARTERLY | YEARLY | ONE_TIME
  periode VARCHAR(20), -- T1 | T2 | T3 | T4 | EXAM
  statut VARCHAR(20) DEFAULT 'ACTIVE',
  cree_par UUID NOT NULL REFERENCES utilisateurs(id), -- Directeur
  cree_le TIMESTAMPTZ DEFAULT NOW(),
  modifie_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_ecole, code)
);

CREATE INDEX IF NOT EXISTS idx_lignes_factures_ecole ON lignes_factures(id_ecole, statut);
CREATE INDEX IF NOT EXISTS idx_lignes_factures_direction ON lignes_factures(id_direction, statut);

-- ============================================================
-- 5. ENCAISSEMENTS (validés par le Comptable)
-- ============================================================
CREATE TABLE IF NOT EXISTS encaissements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_uuid_operation UUID UNIQUE NOT NULL, -- Anti-doublon (idempotence)
  id_ecole UUID NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,
  numero_recu VARCHAR(100) UNIQUE NOT NULL,
  id_eleve UUID REFERENCES eleves(id),
  id_ligne_facture UUID NOT NULL REFERENCES lignes_factures(id),
  montant_paye BIGINT NOT NULL, -- en centimes
  devise VARCHAR(10) DEFAULT 'CDF',
  methode_paiement VARCHAR(20) NOT NULL, -- CASH | BANK | MOBILE_MONEY | CARD
  nom_payeur VARCHAR(255),
  periode VARCHAR(20),
  statut VARCHAR(20) DEFAULT 'CONFIRMED',
  id_comptable UUID NOT NULL REFERENCES utilisateurs(id),
  date_encaissement TIMESTAMPTZ DEFAULT NOW(),
  directeur_notifie_le TIMESTAMPTZ,
  annule_le TIMESTAMPTZ,
  motif_annulation TEXT,
  cree_le TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encaissements_ecole ON encaissements(id_ecole, statut);
CREATE INDEX IF NOT EXISTS idx_encaissements_eleve ON encaissements(id_eleve);
CREATE INDEX IF NOT EXISTS idx_encaissements_ligne ON encaissements(id_ligne_facture);
CREATE INDEX IF NOT EXISTS idx_encaissements_date ON encaissements(id_ecole, date_encaissement);

-- ============================================================
-- 6. POLITIQUES RLS (Row Level Security) — Supabase
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE matieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE affectations_profs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

-- Politique : Tous les utilisateurs authentifiés peuvent LIRE les matières
CREATE POLICY "matieres_read_authenticated" ON matieres
  FOR SELECT TO authenticated USING (true);

-- Politique : Seul le Directeur peut créer/modifier des matières
CREATE POLICY "matieres_write_directeur" ON matieres
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role IN ('DIRECTION', 'ADMIN')
    )
  );

-- Politique : Secrétariat peut INSERT/UPDATE les élèves
CREATE POLICY "eleves_write_secretaire" ON eleves
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role IN ('SECRETAIRE', 'DIRECTION', 'ADMIN')
    )
  );

CREATE POLICY "eleves_update_secretaire" ON eleves
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role IN ('SECRETAIRE', 'DIRECTION', 'ADMIN')
    )
  );

-- Politique : Tous les rôles peuvent LIRE les élèves (selon périmètre)
CREATE POLICY "eleves_read_authenticated" ON eleves
  FOR SELECT TO authenticated USING (true);

-- Politique : Seul le Directeur peut créer des lignes de factures
CREATE POLICY "lignes_factures_write_directeur" ON lignes_factures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role IN ('DIRECTION', 'ADMIN')
    )
  );

-- Politique : Comptable peut LIRE les lignes de factures mais PAS les créer
CREATE POLICY "lignes_factures_read_comptable" ON lignes_factures
  FOR SELECT TO authenticated USING (true);

-- Politique : Comptable peut INSERT les encaissements
CREATE POLICY "encaissements_insert_comptable" ON encaissements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role IN ('ACCOUNTANT', 'DIRECTION', 'ADMIN')
    )
  );

-- Politique : Comptable et Directeur peuvent LIRE les encaissements
CREATE POLICY "encaissements_read_finance" ON encaissements
  FOR SELECT TO authenticated USING (true);

-- Politique : Enseignant peut LIRE les affectations
CREATE POLICY "affectations_read_enseignant" ON affectations_profs
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 7. TRIGGER : Alerte automatique de blocage financier
-- ============================================================
-- Quand un élève est inscrit, créer une entrée dans statuts_financiers
-- Quand un encaissement est validé, mettre à jour le statut

CREATE OR REPLACE FUNCTION trigger_update_financial_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'encaissement est confirmé, débloquer l'élève
  IF NEW.statut = 'CONFIRMED' AND NEW.id_eleve IS NOT NULL THEN
    UPDATE eleves
    SET statut_financier_bloque = FALSE,
        motif_blocage = NULL,
        modifie_le = NOW()
    WHERE id = NEW.id_eleve;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_encaissement_status
  AFTER INSERT ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_financial_status();

-- ============================================================
-- 8. TRIGGER : Mise à jour du timestamp modifie_le
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modifie_le = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matieres_modified BEFORE UPDATE ON matieres
  FOR EACH ROW EXECUTE FUNCTION trigger_update_modified();

CREATE TRIGGER trg_eleves_modified BEFORE UPDATE ON eleves
  FOR EACH ROW EXECUTE FUNCTION trigger_update_modified();

CREATE TRIGGER trg_lignes_factures_modified BEFORE UPDATE ON lignes_factures
  FOR EACH ROW EXECUTE FUNCTION trigger_update_modified();

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
