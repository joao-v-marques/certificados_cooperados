package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "courses")
@Getter
@Setter
@NoArgsConstructor
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "total_minutes", nullable = false)
    private int totalMinutes;

    @Column(name = "completion_date", nullable = false)
    private LocalDate completionDate;

    @Column(name = "observations", columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_member_id", nullable = false)
    private CooperativeMember cooperativeMember;
}
