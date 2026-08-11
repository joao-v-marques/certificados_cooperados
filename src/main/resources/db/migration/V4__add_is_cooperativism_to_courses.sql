-- Adicionado nova coluna na tabela de cursos para identificar se esse curso é ou não de cooperativismo
-- Usado para análise no dashboard da ESG e na própria aplicação
ALTER TABLE courses
ADD COLUMN is_cooperativism BOOLEAN NOT NULL DEFAULT FALSE;