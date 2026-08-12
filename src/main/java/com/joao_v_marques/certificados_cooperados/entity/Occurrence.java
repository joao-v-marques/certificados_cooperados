package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "occurrences")
@Getter
@Setter
@NoArgsConstructor
public class Occurrence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // Quando a ocorrência aconteceu, informado por quem lança. Não se confunde
    // com createdAt, que é quando a secretaria registrou no sistema.
    @Column(name = "occurrence_date", nullable = false)
    private LocalDate occurrenceDate;

    // Aqui a observação é o próprio conteúdo do registro, por isso obrigatória —
    // ao contrário de Course, onde ela só complementa o título.
    @Column(name = "observations", columnDefinition = "TEXT", nullable = false)
    private String observations;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "occurrence_type_id", nullable = false)
    private OccurrenceType occurrenceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_member_id", nullable = false)
    private CooperativeMember cooperativeMember;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
