-- ============================================================
-- SmartShule / PromoGestion — Extension Portail Prof (Étape 4 RDC)
-- IQA, Émargements, Cahier de textes, Incidents, Offline Queue
-- Compatible PostgreSQL / Supabase avec RLS + triggers + vues IQA
-- ============================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- A. AGENDA DES PROFESSEURS (agendas_profs)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_agendas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id),
    course_id      UUID REFERENCES courses(id),
    start_date_time TIMESTAMPTZ NOT NULL,
    end_date_time   TIMESTAMPTZ NOT NULL,
    room            TEXT,
    status          TEXT NOT NULL DEFAULT 'PLANIFIED'
                    CHECK (status IN ('PLANIFIED','IN_PROGRESS','DONE','CANCELLED')),
    cancelled_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agendas_school_teacher_time ON teacher_agendas(school_id, teacher_id, start_date_time);
CREATE INDEX IF NOT EXISTS idx_agendas_school_classroom   ON teacher_agendas(school_id, classroom_id, start_date_time);
CREATE INDEX IF NOT EXISTS idx_agendas_status             ON teacher_agendas(school_id, status);

-- ============================================================
-- B. ÉMARGEMENTS DES PROFESSEURS (emargements_profs)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_emargements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    agenda_id       UUID NOT NULL REFERENCES teacher_agendas(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id),
    signature_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT','LATE')),
    ip_address      INET,
    user_agent      TEXT,
    director_notified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agenda_id)  -- Un seul émargement par séance
);
CREATE INDEX IF NOT EXISTS idx_emargements_school_teacher_time ON teacher_emargements(school_id, teacher_id, signature_at);
CREATE INDEX IF NOT EXISTS idx_emargements_school_classroom   ON teacher_emargements(school_id, classroom_id, signature_at);

-- ============================================================
-- C. APPEL DES ÉLÈVES (appels_eleves)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_attendance_calls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    emargement_id   UUID NOT NULL REFERENCES teacher_emargements(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id),
    status          TEXT NOT NULL CHECK (status IN ('PRESENT','ABSENT','LATE','EXCUSED')),
    late_minutes    INTEGER NOT NULL DEFAULT 0,
    justified       BOOLEAN NOT NULL DEFAULT false,
    justification   TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by_id  UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (emargement_id, student_id)  -- Anti-doublon par séance
);
CREATE INDEX IF NOT EXISTS idx_appels_student ON student_attendance_calls(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_appels_status  ON student_attendance_calls(school_id, status);

-- ============================================================
-- D. CAHIER DE TEXTES ENRICHI (cahier_de_textes)
-- ============================================================
CREATE TABLE IF NOT EXISTS lesson_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    emargement_id    UUID NOT NULL UNIQUE REFERENCES teacher_emargements(id) ON DELETE CASCADE,
    agenda_id        UUID NOT NULL REFERENCES teacher_agendas(id) ON DELETE CASCADE,
    teacher_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    classroom_id     UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    subject_id       UUID REFERENCES subjects(id),
    session_date     TIMESTAMPTZ NOT NULL,
    lesson_title     TEXT NOT NULL,
    summary          TEXT NOT NULL,
    homework_published TEXT,
    resources_url    TEXT,  -- JSON array string
    status           TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','AUDITED')),
    audited_at       TIMESTAMPTZ,
    audited_by_id    UUID,
    audit_comment    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_school_teacher_date ON lesson_logs(school_id, teacher_id, session_date);
CREATE INDEX IF NOT EXISTS idx_lessons_school_classroom    ON lesson_logs(school_id, classroom_id, session_date);
CREATE INDEX IF NOT EXISTS idx_lessons_school_subject      ON lesson_logs(school_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status             ON lesson_logs(school_id, status);

-- ============================================================
-- E. INCIDENTS DE CLASSE (incidents_classes)
-- Avec support Offline Queue (sync_status, client_uuid)
-- ============================================================
CREATE TABLE IF NOT EXISTS class_incidents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    agenda_id         UUID REFERENCES teacher_agendas(id) ON DELETE SET NULL,
    teacher_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    classroom_id      UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id        UUID REFERENCES students(id) ON DELETE SET NULL,
    severity          TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    category          TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('DISCIPLINE','MATERIAL','ABSENCE','BEHAVIOR','SAFETY','OTHER')),
    description       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','ARCHIVED')),
    resolved_at       TIMESTAMPTZ,
    resolved_by_id    UUID REFERENCES employees(id),
    resolution        TEXT,
    director_notified_at TIMESTAMPTZ,
    client_uuid       UUID NOT NULL UNIQUE,    -- idempotence offline
    sync_status       TEXT NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('PENDING','SYNCED','FAILED')),
    synced_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidents_status   ON class_incidents(school_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON class_incidents(school_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_teacher  ON class_incidents(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_classroom ON class_incidents(school_id, classroom_id);

-- ============================================================
-- F. SNAPSHOTS IQA (iqa_snapshots)
-- Calcul persisté pour éviter de surcharger le runtime
-- ============================================================
CREATE TABLE IF NOT EXISTS iqa_snapshots (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id         UUID REFERENCES subjects(id) ON DELETE CASCADE,  -- NULL = global
    classroom_id       UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    period             TEXT NOT NULL,    -- '2026-09' ou '2026-W38' ou 'T1'
    iqa_value          DOUBLE PRECISION NOT NULL,
    level              TEXT NOT NULL CHECK (level IN ('EXCELLENT','WARNING','CRITICAL')),
    total_sessions     INTEGER NOT NULL DEFAULT 0,
    absences_unexcused INTEGER NOT NULL DEFAULT 0,
    absences_excused   INTEGER NOT NULL DEFAULT 0,
    late_count         INTEGER NOT NULL DEFAULT 0,
    computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, subject_id, period)
);
CREATE INDEX IF NOT EXISTS idx_iqa_school_period ON iqa_snapshots(school_id, period);
CREATE INDEX IF NOT EXISTS idx_iqa_student         ON iqa_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_iqa_level           ON iqa_snapshots(school_id, level);

-- ============================================================
-- VUE IQA GLOBAL — Calcul en temps réel par élève
-- IQA = MAX(0, 100 - ((100 * A_non_exc + 50 * A_exc + 15 * R) / Total_Heures))
-- ============================================================
CREATE OR REPLACE VIEW v_iqa_global AS
SELECT
    s.school_id,
    s.student_id,
    DATE_TRUNC('month', s.session_date) AS period_month,
    COUNT(DISTINCT s.emargement_id) AS total_sessions,
    COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false) AS absences_unexcused,
    COUNT(*) FILTER (WHERE s.status = 'EXCUSED') AS absences_excused,
    COUNT(*) FILTER (WHERE s.status = 'LATE') AS late_count,
    GREATEST(0.0,
        100.0 - (
            (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
            + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
            + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
        ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
    ) AS iqa_global,
    CASE
        WHEN GREATEST(0.0,
            100.0 - (
                (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
                + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
                + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
            ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
        ) >= 90 THEN 'EXCELLENT'
        WHEN GREATEST(0.0,
            100.0 - (
                (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
                + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
                + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
            ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
        ) >= 75 THEN 'WARNING'
        ELSE 'CRITICAL'
    END AS level
FROM student_attendance_calls s
GROUP BY s.school_id, s.student_id, DATE_TRUNC('month', s.session_date);

-- ============================================================
-- VUE IQA PAR MATIÈRE — Calcul par élève et matière
-- ============================================================
CREATE OR REPLACE VIEW v_iqa_by_subject AS
SELECT
    s.school_id,
    s.student_id,
    s.subject_id,
    DATE_TRUNC('month', s.session_date) AS period_month,
    COUNT(DISTINCT s.emargement_id) AS total_sessions,
    COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false) AS absences_unexcused,
    COUNT(*) FILTER (WHERE s.status = 'EXCUSED') AS absences_excused,
    COUNT(*) FILTER (WHERE s.status = 'LATE') AS late_count,
    GREATEST(0.0,
        100.0 - (
            (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
            + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
            + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
        ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
    ) AS iqa_subject,
    CASE
        WHEN GREATEST(0.0,
            100.0 - (
                (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
                + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
                + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
            ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
        ) >= 90 THEN 'EXCELLENT'
        WHEN GREATEST(0.0,
            100.0 - (
                (100.0 * COUNT(*) FILTER (WHERE s.status = 'ABSENT' AND s.justified = false))
                + (50.0 * COUNT(*) FILTER (WHERE s.status = 'EXCUSED'))
                + (15.0 * COUNT(*) FILTER (WHERE s.status = 'LATE'))
            ) / NULLIF(COUNT(DISTINCT s.emargement_id), 0)
        ) >= 75 THEN 'WARNING'
        ELSE 'CRITICAL'
    END AS level
FROM student_attendance_calls s
WHERE s.subject_id IS NOT NULL
GROUP BY s.school_id, s.student_id, s.subject_id, DATE_TRUNC('month', s.session_date);

-- ============================================================
-- VUE TEMPS RÉEL DIRECTION — Professeurs actuellement en cours
-- ============================================================
CREATE OR REPLACE VIEW v_profs_en_cours AS
SELECT
    e.id AS agenda_id,
    e.school_id,
    emp.id AS teacher_id,
    emp.first_name || ' ' || emp.last_name AS teacher_name,
    c.name AS classroom_name,
    sub.name AS subject_name,
    e.start_date_time,
    e.end_date_time,
    e.room,
    em.signature_at,
    em.status AS emargement_status,
    CASE
        WHEN em.id IS NULL THEN 'PLANIFIED'
        WHEN em.id IS NOT NULL AND now() < e.end_date_time THEN 'IN_PROGRESS'
        ELSE 'DONE'
    END AS live_status,
    CASE
        WHEN em.id IS NULL THEN 'PENDING'
        WHEN em.director_notified_at IS NULL THEN 'NOTIFYING'
        ELSE 'NOTIFIED'
    END AS notification_status
FROM teacher_agendas e
JOIN employees   emp ON emp.id = e.teacher_id
JOIN classrooms c   ON c.id = e.classroom_id
LEFT JOIN subjects sub ON sub.id = e.subject_id
LEFT JOIN teacher_emargements em ON em.agenda_id = e.id
WHERE e.status IN ('PLANIFIED','IN_PROGRESS')
  AND e.start_date_time <= now()
  AND e.end_date_time >= now();

-- ============================================================
-- TRIGGER 1 — Émargement = Notification automatique au Directeur
-- ============================================================
CREATE OR REPLACE FUNCTION notify_director_on_emargement()
RETURNS TRIGGER AS $$
BEGIN
    -- Marque l'émargement comme "notification envoyée"
    NEW.director_notified_at := now();

    -- Insertion d'une notification pour tous les utilisateurs DIRECTION de l'école
    INSERT INTO notifications (user_id, type, title, message, read, created_at)
    SELECT
        u.id,
        'EMARGEMENT_REALTIME',
        'Cours démarré',
        'Le prof ' || emp.first_name || ' ' || emp.last_name
            || ' vient de démarrer le cours de ' || COALESCE(sub.name, '—')
            || ' en ' || c.name
            || ' à ' || to_char(NEW.signature_at, 'HH24:MI'),
        false,
        now()
    FROM teacher_emargements em
    JOIN teacher_agendas    a   ON a.id = em.agenda_id
    JOIN employees          emp ON emp.id = em.teacher_id
    JOIN classrooms         c   ON c.id = em.classroom_id
    LEFT JOIN subjects      sub ON sub.id = em.subject_id
    JOIN users              u   ON u.school_id = em.school_id AND u.role = 'DIRECTION'
    WHERE em.id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emargement_notify ON teacher_emargements;
CREATE TRIGGER trg_emargement_notify
    AFTER INSERT ON teacher_emargements
    FOR EACH ROW EXECUTE FUNCTION notify_director_on_emargement();

-- ============================================================
-- TRIGGER 2 — Incident critique = Notification immédiate au Directeur
-- ============================================================
CREATE OR REPLACE FUNCTION notify_director_on_critical_incident()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity IN ('HIGH','CRITICAL') AND NEW.director_notified_at IS NULL THEN
        NEW.director_notified_at := now();

        INSERT INTO notifications (user_id, type, title, message, read, created_at)
        SELECT
            u.id,
            'INCIDENT_CRITICAL',
            '⚠️ Incident ' || NEW.severity,
            'Incident signalé par ' || emp.first_name || ' ' || emp.last_name
                || ' en ' || c.name
                || ' : ' || LEFT(NEW.description, 100),
            false,
            now()
        FROM employees emp
        JOIN classrooms c ON c.id = NEW.classroom_id
        JOIN users u ON u.school_id = NEW.school_id AND u.role = 'DIRECTION'
        WHERE emp.id = NEW.teacher_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incident_notify ON class_incidents;
CREATE TRIGGER trg_incident_notify
    BEFORE INSERT OR UPDATE ON class_incidents
    FOR EACH ROW EXECUTE FUNCTION notify_director_on_critical_incident();

-- ============================================================
-- TRIGGER 3 — Mise à jour automatique du statut agenda
-- ============================================================
CREATE OR REPLACE FUNCTION update_agenda_status_on_emargement()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE teacher_agendas
    SET status = 'IN_PROGRESS', updated_at = now()
    WHERE id = NEW.agenda_id AND status = 'PLANIFIED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agenda_status ON teacher_emargements;
CREATE TRIGGER trg_agenda_status
    AFTER INSERT ON teacher_emargements
    FOR EACH ROW EXECUTE FUNCTION update_agenda_status_on_emargement();

-- ============================================================
-- FONCTION : Refresh IQA snapshots pour un élève / période
-- Appelable manuellement ou via cron
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_iqa_snapshots(p_school_id UUID, p_period TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Supprime les anciens snapshots pour cette période
    DELETE FROM iqa_snapshots
    WHERE school_id = p_school_id AND period = p_period;

    -- Insère les snapshots IQA Global (subject_id NULL)
    INSERT INTO iqa_snapshots (
        school_id, student_id, subject_id, classroom_id, period,
        iqa_value, level, total_sessions, absences_unexcused, absences_excused,
        late_count, computed_at, created_at
    )
    SELECT
        v.school_id,
        v.student_id,
        NULL,
        NULL,
        p_period,
        v.iqa_global,
        v.level,
        v.total_sessions,
        v.absences_unexcused,
        v.absences_excused,
        v.late_count,
        now(),
        now()
    FROM v_iqa_global v
    WHERE v.school_id = p_school_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Insère les snapshots IQA par matière (subject_id non NULL)
    INSERT INTO iqa_snapshots (
        school_id, student_id, subject_id, classroom_id, period,
        iqa_value, level, total_sessions, absences_unexcused, absences_excused,
        late_count, computed_at, created_at
    )
    SELECT
        v.school_id,
        v.student_id,
        v.subject_id,
        NULL,
        p_period,
        v.iqa_subject,
        v.level,
        v.total_sessions,
        v.absences_unexcused,
        v.absences_excused,
        v.late_count,
        now(),
        now()
    FROM v_iqa_by_subject v
    WHERE v.school_id = p_school_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS (Row Level Security) — Activée pour Supabase
-- ============================================================
ALTER TABLE teacher_agendas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_emargements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_incidents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE iqa_snapshots            ENABLE ROW LEVEL SECURITY;

-- Politique : un utilisateur ne voit que les données de son école
CREATE POLICY p_teacher_agendas_school ON teacher_agendas
    USING (school_id = current_setting('app.school_id', true)::uuid);
CREATE POLICY p_teacher_emargements_school ON teacher_emargements
    USING (school_id = current_setting('app.school_id', true)::uuid);
CREATE POLICY p_student_attendance_calls_school ON student_attendance_calls
    USING (school_id = current_setting('app.school_id', true)::uuid);
CREATE POLICY p_lesson_logs_school ON lesson_logs
    USING (school_id = current_setting('app.school_id', true)::uuid);
CREATE POLICY p_class_incidents_school ON class_incidents
    USING (school_id = current_setting('app.school_id', true)::uuid);
CREATE POLICY p_iqa_snapshots_school ON iqa_snapshots
    USING (school_id = current_setting('app.school_id', true)::uuid);

-- ============================================================
-- FIN DU SCRIPT — Extension Portail Prof complète
-- ============================================================
