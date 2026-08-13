package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "occurrence_types")
@Getter
@Setter
@NoArgsConstructor
public class OccurrenceType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    // Campo de isActive para soft delete, remover das lógicas sem excluir
    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
