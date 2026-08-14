-- Tabela de eventos que valem pontuação premiada. Cada ano têm seus próprios eventos e valores
CREATE TABLE bonus_events (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    points INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- faz soft delete em vez de simplesmente excluir

    inserted_by INT NOT NULL, -- FK de users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- FOREIGN KEYS
    CONSTRAINT fk_bonus_event_user FOREIGN KEY (inserted_by) REFERENCES users(id),

    -- Constraints de checagem
    CONSTRAINT ck_point_positive CHECK (points > 0),
    CONSTRAINT uq_bonus_event_date UNIQUE (name, event_date) -- Impede lançar um evento com o exato mesmo nome na mesma data
);

-- Tabela de lista de presença nos eventos, só é inserido aqui se o Cooperado participar do evento
CREATE TABLE bonus_event_participation (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bonus_event_id INT NOT NULL,        -- FK bonus_event
    cooperative_member_id INT NOT NULL, -- FK cooperative_members

    inserted_by INT NOT NULL,           -- FK users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- FOREIGN KEYS
    CONSTRAINT fk_participation_event FOREIGN KEY (bonus_event_id) REFERENCES bonus_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_participation_member FOREIGN KEY (cooperative_member_id) REFERENCES cooperative_members(id),
    CONSTRAINT fk_participation_user FOREIGN KEY (inserted_by) REFERENCES users(id),

    -- Constraints de checagem
    CONSTRAINT uq_participation UNIQUE (bonus_event_id, cooperative_member_id)
);