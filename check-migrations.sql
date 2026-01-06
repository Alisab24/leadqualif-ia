-- SCRIPT DE VÉRIFICATION DES MIGRATIONS SUPABASE
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Vérifier si la table documents existe
SELECT 
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'documents';

-- 2. Vérifier la structure de la table documents
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'documents'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.documents'::regclass;

-- 4. Vérifier les index
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'documents';

-- 5. Vérifier les politiques RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'documents';

-- 6. Vérifier si RLS est activé
SELECT 
    relname as table_name,
    rowsecurity as rls_enabled
FROM pg_class 
WHERE relname = 'documents';

-- 7. Compter les documents existants
SELECT COUNT(*) as total_documents FROM documents;

-- 8. Vérifier les documents par agence
SELECT 
    agency_id,
    COUNT(*) as count,
    MAX(created_at) as last_created
FROM documents 
GROUP BY agency_id;

-- 9. Vérifier les types de documents
SELECT 
    type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT status, ', ') as statuses
FROM documents 
GROUP BY type;

-- 10. Vérifier la table crm_events
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'crm_events';
