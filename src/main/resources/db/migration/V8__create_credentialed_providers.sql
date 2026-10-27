-- Tabela de tipos de provedores credenciados
CREATE TABLE credentialed_provider_types (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Inserção dos tipos iniciais de provedores credenciados.
INSERT INTO credentialed_provider_types (name)
VALUES
    ('Laboratório'),
    ('Diagnóstico'),
    ('Hospital'),
    ('Médico Credenciado');

-- Tabela de provedores credenciados, médicos, laboratórios, etc. NÃO vamos fazer a inserção inicial dos credenciados, será adicionado apenas pelo sistema
CREATE TABLE credentialed_providers (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    type_id INT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_credentialed_provider_type FOREIGN KEY (type_id) REFERENCES credentialed_provider_types(id)
);
