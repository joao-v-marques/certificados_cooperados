package com.joao_v_marques.certificados_cooperados.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;


@Entity
@Table(name = "course_certificates")
@Getter
@Setter
@NoArgsConstructor
public class CourseCertificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "original_filename", nullable = false, columnDefinition = "TEXT")
    private String originalFilename;

    @Column(name = "content_type", columnDefinition = "TEXT")
    private String contentType;

    @Column(name = "stored_path", nullable = false, unique = true, columnDefinition = "TEXT")
    private String storedPath;

    @Column(name = "size_bytes")
    private Integer sizeBytes;

    @Column(name = "uploaded_at", nullable = false)
    private OffsetDateTime uploadedAt = OffsetDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;
}
