package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "bonus_event_participation")
@Getter
@Setter
@NoArgsConstructor
public class BonusEventParticipation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bonus_event_id", nullable = false)
    private BonusEvent bonusEvent;

    @JoinColumn(name = "cooperative_member_id", nullable = false)
    @ManyToOne(fetch = FetchType.LAZY)
    private CooperativeMember cooperativeMember;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
