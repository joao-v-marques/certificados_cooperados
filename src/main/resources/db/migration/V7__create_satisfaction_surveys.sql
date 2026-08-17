-- Tabela para relatórios de pesquisa de satisfação. Neste primeiro momento será apenas o resultado final e não a pesquisa detalhada
CREATE TABLE satisfaction_surveys (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    survey_year INT NOT NULL UNIQUE,
    total_members INT NOT NULL, -- Total de Cooperados na época da pesquisa
    respondents INT NOT NULL,
    satisfaction_index NUMERIC(5, 2) NOT NULL, -- 0% a 100%

    inserted_by INT NOT NULL, -- FK de users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- FOREIGN KEYS
    CONSTRAINT fk_survey_user FOREIGN KEY (inserted_by) REFERENCES users(id),

    -- CONSTRAINTS DE CHECAGEM
    CONSTRAINT ck_survey_year CHECK (survey_year >= 2000),
    CONSTRAINT ck_total_members_positive CHECK (total_members > 0),
    CONSTRAINT ck_satisfaction_index_range CHECK (satisfaction_index BETWEEN 0 AND 100),
    CONSTRAINT ck_respondents_range CHECK (respondents >= 0 AND respondents <= total_members)
);