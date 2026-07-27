-- Tabela de roles para controle de acesso de usuários
CREATE TABLE roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de usuários
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(155) NOT NULL UNIQUE,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Tabela de cooperados, realizar o cadastro desses cooperados para conseguir lançar um curso no nome deles
CREATE TABLE cooperative_members (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Tabela de cursos, é a fonte primaria de informações do nosso sistema, considerando que é uma aplicação para lançamento de cursos
CREATE TABLE courses (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    total_minutes INT NOT NULL,
    completion_date DATE NOT NULL,
    observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inserted_by INT NOT NULL, -- FK da tabela de users
    cooperative_member_id INT NOT NULL, -- FK da tabela cooperative_members

    CONSTRAINT fk_course_inserted_by FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_course_cooperative_member FOREIGN KEY (cooperative_member_id) REFERENCES cooperative_members(id),
    CONSTRAINT ck_course_total_minutes CHECK (total_minutes > 0)
);

-- Tabela utilizada para armazenar os certificados de um curso
CREATE TABLE course_certificates (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    original_filename TEXT NOT NULL,
    content_type TEXT,
    stored_path TEXT NOT NULL UNIQUE,
    size_bytes INT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    course_id INT NOT NULL, -- FK da tabela de courses

    CONSTRAINT fk_course_certificate_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);