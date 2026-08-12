-- Tabela de tipos de ocorrências, serão utilizadas para o novo módulo de ocorrências de Cooperados
CREATE TABLE occurrence_types (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE -- Soft delete para evitar lançamentos em tipos de ocorrências desabilitados
);

INSERT INTO occurrence_types (name)
VALUES
    ('CANCELAMENTO PF'),
    ('DUVIDA'),
    ('EMPRÉSTIMO AUDITÓRIO'),
    ('ENVIO DE CERTIFICADO'),
    ('EPI'),
    ('FATES'),
    ('FÉRIAS'),
    ('OUTROS'),
    ('PG ANUIDADE ESPECIALIDADE'),
    ('PG INSCRIÇÃO DE CONGRESSO'),
    ('REAJUSTE'),
    ('RECLAMAÇÃO'),
    ('SOLICITAÇÃO DE COMPROVANTES PARA IR'),
    ('SOLICITAÇÃO DE COOPERATIVAÇÃO'),
    ('SOLICITAÇÃO DE CREDENCIAMENTO NOVO EXAME/PROCEDIME'),
    ('SOLICITAÇÃO DE DEMONSTRATIVO DA PRODUÇÃO MÉDICA'),
    ('SOLICITAÇÃO DE DESLIGAMENTO'),
    ('SOLICITAÇÃO DO TERMO FATES');

-- Tabela de ocorrências da aplicação, solicitada pelo cooperado externamente e cadastrada pela secretaria executiva
CREATE TABLE occurrences (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    occurrence_date DATE NOT NULL,
    observations TEXT NOT NULL,

    occurrence_type_id INT NOT NULL,     -- FK occurrence_types
    cooperative_member_id INT NOT NULL, -- FK cooperative_members

    inserted_by INT NOT NULL,           -- FK users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign Keys
    CONSTRAINT fk_occurrence_user FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_occurrence_type FOREIGN KEY (occurrence_type_id) REFERENCES occurrence_types(id),
    CONSTRAINT fk_occurrence_cooperative_member FOREIGN KEY (cooperative_member_id) REFERENCES cooperative_members(id)
);