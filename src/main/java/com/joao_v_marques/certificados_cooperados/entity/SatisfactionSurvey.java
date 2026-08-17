package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "satisfaction_surveys")
@Getter
@Setter
@NoArgsConstructor
public class SatisfactionSurvey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "survey_year", nullable = false, unique = true)
    private int surveyYear;

    @Column(name = "total_members", nullable = false)
    private int totalMembers;

    @Column(name = "respondents", nullable = false)
    private int respondents;

    @Column(name = "satisfaction_index", nullable = false, precision = 5, scale = 2)
    private BigDecimal satisfactionIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
